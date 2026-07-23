import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:logger/logger.dart';
import 'package:pointycastle/export.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/socket_service.dart';
import '../../../core/utils/storage_service.dart';
import '../../../crypto/crypto_engine.dart';
import '../../../crypto/key_sync_service.dart';
import 'message_event.dart';
import 'message_state.dart';

class MessageBloc extends Bloc<MessageEvent, MessageState> {
  final ApiClient _apiClient;
  final SocketService _socketService;
  final StorageService _storageService;
  final KeySyncService _keySyncService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  String? _targetUserId;
  String? _groupId;
  String? _channelId;
  String? _currentUserId;

  // ECDH Key pair for current chat session
  AsymmetricKeyPair<ECPublicKey, ECPrivateKey>? _ecdhKeyPair;
  Uint8List? _derivedE2eKey;
  bool _secretChatEnabled = false;

  // Pending messages waiting for E2E Key agreement completion
  final List<MessageSendEvent> _pendingE2eMessages = [];

  MessageBloc(
    this._apiClient,
    this._socketService,
    this._storageService,
    this._keySyncService,
  ) : super(MessageInitialState()) {
    on<MessageLoadHistoryEvent>(_onLoadHistory);
    on<MessageSendEvent>(_onSendMessage);
    on<MessageReceiveEvent>(_onReceiveMessage);
    on<MessageDeleteEvent>(_onDeleteMessage);
    on<MessageEditEvent>(_onEditMessage);
    on<MessageSendTypingEvent>(_onSendTyping);
    on<MessageReceivedTypingEvent>(_onReceivedTyping);
    on<MessageToggleE2eEvent>(_onToggleE2e);
    on<MessageReadUpdateEvent>(_onMessageReadUpdate);
    on<_MessageKeyExchangeCompletedEvent>(_onKeyExchangeCompleted);

    _setupSocketListeners();
  }

  String? get e2eKeyId {
    if (_targetUserId == null || _currentUserId == null) return null;
    return _keySyncService.normalizeE2eKeyId('$_currentUserId:$_targetUserId');
  }

  void _setupSocketListeners() {
    _socketService.on('receive_message', _onReceiveMessageSocket);
    _socketService.on('message_sent', _onMessageSentSocket);
    _socketService.on('typing', _onTypingSocket);
    _socketService.on('message_deleted', _onMessageDeletedSocket);
    _socketService.on('message_edited', _onMessageEditedSocket);
    _socketService.on('messages_read_update', _onMessagesReadUpdateSocket);
    _socketService.on('e2e_key_exchange', _onE2eKeyExchangeSocket);
  }

  void _onReceiveMessageSocket(dynamic data) {
    if (_isMessageForCurrentChat(data)) {
      final msgId = data['id']?.toString() ?? '';
      final senderId = data['sender_id']?.toString() ?? '';
      if (msgId.isNotEmpty && senderId != _currentUserId) {
        _socketService.emit('message_read', {
          'target_sender_id': senderId,
          'message_ids': [msgId],
        });
      }
      add(MessageReceiveEvent(data));
    }
  }

  void _onMessagesReadUpdateSocket(dynamic data) {
    if (data == null) return;
    add(MessageReadUpdateEvent(Map<String, dynamic>.from(data as Map)));
  }

  void _onMessageSentSocket(dynamic data) {
    final msg = data['message'] ?? data;
    if (_isMessageForCurrentChat(msg)) {
      add(MessageReceiveEvent(msg));
    }
  }

  void _onTypingSocket(dynamic data) {
    if (data == null) return;
    final senderId = data['sender_id']?.toString() ?? '';
    
    final isForUs = (_targetUserId != null && senderId == _targetUserId && data['target_user_id']?.toString() == _currentUserId) ||
        (_groupId != null && data['group_id']?.toString() == _groupId) ||
        (_channelId != null && data['channel_id']?.toString() == _channelId);

    if (isForUs) {
      add(MessageReceivedTypingEvent(senderId, true));
    }
  }

  void _onMessageDeletedSocket(dynamic data) {
    if (data == null) return;
    final msgId = data['message_id']?.toString() ?? '';
    if (msgId.isNotEmpty) {
      add(MessageDeleteEvent(msgId));
    }
  }

  void _onMessageEditedSocket(dynamic data) {
    if (data == null) return;
    final msgId = data['id']?.toString() ?? '';
    final newContent = data['content']?.toString() ?? '';
    if (msgId.isNotEmpty) {
      add(MessageEditEvent(msgId, newContent));
    }
  }

  void _onE2eKeyExchangeSocket(dynamic data) async {
    await _handleE2eKeyExchangeSocket(data);
  }

  bool _isMessageForCurrentChat(dynamic data) {
    if (data == null) return false;
    final senderId = data['sender_id']?.toString() ?? '';
    final targetUserId = (data['target_user_id'] ?? data['target_id'])?.toString() ?? '';
    final groupId = data['group_id']?.toString() ?? '';
    final channelId = data['channel_id']?.toString() ?? '';

    if (_groupId != null && groupId == _groupId) return true;
    if (_channelId != null && channelId == _channelId) return true;
    if (_targetUserId != null && _currentUserId != null) {
      if ((senderId == _currentUserId && targetUserId == _targetUserId) ||
          (senderId == _targetUserId && targetUserId == _currentUserId)) {
        return true;
      }
    }
    return false;
  }

  Future<void> _onLoadHistory(
    MessageLoadHistoryEvent event,
    Emitter<MessageState> emit,
  ) async {
    emit(MessageLoadingState());

    _targetUserId = event.targetUserId;
    _groupId = event.groupId;
    _channelId = event.channelId;

    final myUserStr = _storageService.readString('user');
    if (myUserStr != null) {
      _currentUserId = jsonDecode(myUserStr)['id']?.toString();
    }

    try {
      // 1. Fetch DM Settings to check if Secret Chat is enabled on the server
      if (_targetUserId != null) {
        try {
          final settingsRes = await _apiClient.get<Map<String, dynamic>>('/dm/$_targetUserId/settings');
          _secretChatEnabled = settingsRes.data?['is_secret'] == true;
        } catch (e) {
          _logger.w('[MessageBloc] Failed to fetch DM settings: $e');
        }
      }

      // 2. Load locally persisted E2EE key if any
      final kid = e2eKeyId;
      if (kid != null) {
        _derivedE2eKey = await _keySyncService.getPersistedKeyLocally(kid);
      }

      // 3. Initiate Key Exchange if E2EE is enabled and we don't have the key
      if (_secretChatEnabled && _derivedE2eKey == null) {
        await _initiateE2eKeyExchange();
      }

      // 4. Load Message History from API
      String endpoint = '';
      if (_targetUserId != null) {
        endpoint = '/dm/$_targetUserId/messages?page=1&per_page=50';
      } else if (_groupId != null) {
        endpoint = '/groups/$_groupId/messages?page=1&per_page=50';
      } else if (_channelId != null) {
        endpoint = '/channels/$_channelId/messages?page=1&per_page=50';
      }

      final List<ChatMessage> chatMessages = [];
      if (endpoint.isNotEmpty) {
        final historyRes = await _apiClient.get<Map<String, dynamic>>(endpoint);
        final rawItems = historyRes.data?['items'] as List? ?? historyRes.data?['messages'] as List? ?? [];

        for (final item in rawItems) {
          chatMessages.add(_parseAndDecryptMessage(item));
        }

        // Emit message_read for all unread incoming messages in the chat history
        final List<String> unreadIds = [];
        for (final msg in chatMessages) {
          if (!msg.isRead && msg.senderId != _currentUserId) {
            unreadIds.add(msg.id);
          }
        }
        if (unreadIds.isNotEmpty && _targetUserId != null) {
          _socketService.emit('message_read', {
            'target_sender_id': _targetUserId,
            'message_ids': unreadIds,
          });
        }
      }

      emit(MessageLoadedState(
        messages: chatMessages,
        secretChatEnabled: _secretChatEnabled,
        isKeyExchangePending: _secretChatEnabled && _derivedE2eKey == null,
        e2eKeyId: kid,
      ));
    } catch (e) {
      emit(MessageErrorState('Не удалось загрузить историю сообщений: $e'));
    }
  }

  ChatMessage _parseAndDecryptMessage(dynamic item) {
    final id = item['id']?.toString() ?? '';
    final senderId = item['sender_id']?.toString() ?? '';
    var content = item['content']?.toString() ?? '';
    final type = item['type']?.toString() ?? 'text';
    final timestamp = item['timestamp']?.toString() ?? item['created_at']?.toString() ?? DateTime.now().toIso8601String();
    final isRead = item['is_read'] == true;
    final isEdited = item['is_edited'] == true;

    var isDecrypted = false;
    if (content.startsWith('e2e:') && _targetUserId != null) {
      // Attempt decryption with derived key
      if (_derivedE2eKey != null) {
        final plain = CryptoEngine.mtDecrypt(content, _derivedE2eKey!);
        if (plain != null) {
          content = plain;
          isDecrypted = true;
        }
      }
    }

    return ChatMessage(
      id: id,
      senderId: senderId,
      content: content,
      type: type,
      replyToId: item['reply_to_id']?.toString() ?? item['reply_to']?.toString(),
      attachments: item['attachments'],
      timestamp: timestamp,
      isRead: isRead,
      isEdited: isEdited,
      isE2ee: content.startsWith('e2e:') || isDecrypted,
    );
  }

  Future<void> _onSendMessage(
    MessageSendEvent event,
    Emitter<MessageState> emit,
  ) async {
    if (state is! MessageLoadedState) return;
    final loadedState = state as MessageLoadedState;

    if (_secretChatEnabled && _targetUserId != null) {
      if (_derivedE2eKey == null) {
        // Queue message and wait for key exchange
        _pendingE2eMessages.add(event);
        emit(loadedState.copyWith(isKeyExchangePending: true));
        await _initiateE2eKeyExchange();
        return;
      }

      // Encrypt with E2E key
      final encryptedContent = CryptoEngine.mtEncrypt(event.content, _derivedE2eKey!);
      final Map<String, dynamic> messagePayload = {
        'content': encryptedContent,
        'type': event.type,
        'target_user_id': _targetUserId,
      };
      if (event.attachments != null) {
        messagePayload['attachments'] = event.attachments;
      }
      if (event.replyToId != null) {
        messagePayload['reply_to'] = event.replyToId;
      }

      _socketService.emit('send_message', messagePayload);
    } else {
      // Plain text chat
      final Map<String, dynamic> messagePayload = {
        'content': event.content,
        'type': event.type,
        'sender_id': _currentUserId,
      };
      if (_targetUserId != null) messagePayload['target_user_id'] = _targetUserId!;
      if (_groupId != null) messagePayload['group_id'] = _groupId!;
      if (_channelId != null) messagePayload['channel_id'] = _channelId!;
      if (event.attachments != null) {
        messagePayload['attachments'] = event.attachments;
      }
      if (event.replyToId != null) {
        messagePayload['reply_to'] = event.replyToId;
      }

      _socketService.emit('send_message', messagePayload);
    }
  }

  Future<void> _onReceiveMessage(
    MessageReceiveEvent event,
    Emitter<MessageState> emit,
  ) async {
    if (state is! MessageLoadedState) return;
    final loadedState = state as MessageLoadedState;

    final parsed = _parseAndDecryptMessage(event.messageData);
    final messages = List<ChatMessage>.from(loadedState.messages);

    final existsIndex = messages.indexWhere((m) => m.id == parsed.id);
    if (existsIndex != -1) {
      messages[existsIndex] = parsed;
    } else {
      messages.insert(0, parsed);
    }

    emit(loadedState.copyWith(messages: messages));
  }

  Future<void> _onDeleteMessage(
    MessageDeleteEvent event,
    Emitter<MessageState> emit,
  ) async {
    if (state is! MessageLoadedState) return;
    final loadedState = state as MessageLoadedState;

    _socketService.emit('delete_message', {'message_id': event.messageId});

    final messages = loadedState.messages.where((m) => m.id != event.messageId).toList();
    emit(loadedState.copyWith(messages: messages));
  }

  Future<void> _onEditMessage(
    MessageEditEvent event,
    Emitter<MessageState> emit,
  ) async {
    if (state is! MessageLoadedState) return;
    final loadedState = state as MessageLoadedState;

    if (_secretChatEnabled && _derivedE2eKey != null) {
      final encryptedContent = CryptoEngine.mtEncrypt(event.newContent, _derivedE2eKey!);
      _socketService.emit('edit_message', {
        'message_id': event.messageId,
        'content': encryptedContent,
      });
    } else {
      _socketService.emit('edit_message', {
        'message_id': event.messageId,
        'content': event.newContent,
      });
    }

    final messages = loadedState.messages.map((m) {
      if (m.id == event.messageId) {
        return m.copyWith(content: event.newContent, isEdited: true);
      }
      return m;
    }).toList();

    emit(loadedState.copyWith(messages: messages));
  }

  void _onSendTyping(MessageSendTypingEvent event, Emitter<MessageState> emit) {
    if (_currentUserId == null) return;
    final payload = {'sender_id': _currentUserId};
    if (_targetUserId != null) payload['target_user_id'] = _targetUserId!;
    if (_groupId != null) payload['group_id'] = _groupId!;
    if (_channelId != null) payload['channel_id'] = _channelId!;

    _socketService.emit('typing', payload);
  }

  void _onReceivedTyping(MessageReceivedTypingEvent event, Emitter<MessageState> emit) {
    if (state is! MessageLoadedState) return;
    final loadedState = state as MessageLoadedState;
    emit(loadedState.copyWith(isTyping: event.isTyping));

    if (event.isTyping) {
      // Reset typing status after 3 seconds
      Timer(const Duration(seconds: 3), () {
        add(MessageReceivedTypingEvent(event.senderId, false));
      });
    }
  }

  Future<void> _onToggleE2e(MessageToggleE2eEvent event, Emitter<MessageState> emit) async {
    if (_targetUserId == null) return;
    
    try {
      await _apiClient.post('/dm/$_targetUserId/settings', data: {'is_secret': event.enabled});
      _secretChatEnabled = event.enabled;

      if (_secretChatEnabled && _derivedE2eKey == null) {
        await _initiateE2eKeyExchange();
      }

      if (state is MessageLoadedState) {
        final loadedState = state as MessageLoadedState;
        emit(loadedState.copyWith(
          secretChatEnabled: _secretChatEnabled,
          isKeyExchangePending: _secretChatEnabled && _derivedE2eKey == null,
        ));
      }
    } catch (e) {
      _logger.e('[MessageBloc] Failed to toggle E2EE settings: $e');
    }
  }

  void _onKeyExchangeCompleted(
    _MessageKeyExchangeCompletedEvent event,
    Emitter<MessageState> emit,
  ) {
    if (state is MessageLoadedState) {
      final loadedState = state as MessageLoadedState;
      final decryptedMessages = loadedState.messages.map((m) {
        if (m.content.startsWith('e2e:') && !m.isE2ee) {
          final plain = CryptoEngine.mtDecrypt(m.content, event.key);
          if (plain != null) {
            return m.copyWith(content: plain, isE2ee: true);
          }
        }
        return m;
      }).toList();

      emit(loadedState.copyWith(
        messages: decryptedMessages,
        isKeyExchangePending: false,
      ));
    }
  }

  // --- ECDH E2EE Key Exchange Implementation ---

  Future<void> _initiateE2eKeyExchange() async {
    if (_targetUserId == null || _currentUserId == null || e2eKeyId == null) return;

    try {
      _logger.d('[E2EE] Initiating Key Exchange with user $_targetUserId');
      
      // Generate keypair
      final domainParams = ECDomainParameters('prime256v1');
      final secureRandom = FortunaRandom();
      secureRandom.seed(KeyParameter(CryptoEngine.getRandomBytes(32)));

      final generator = KeyGenerator('EC');
      generator.init(ParametersWithRandom(
        ECKeyGeneratorParameters(domainParams),
        secureRandom,
      ));

      _ecdhKeyPair = generator.generateKeyPair() as AsymmetricKeyPair<ECPublicKey, ECPrivateKey>;
      final pubKeyBytes = _ecdhKeyPair!.publicKey.Q!.getEncoded(false);

      _socketService.emit('e2e_key_exchange', {
        'target_user_id': _targetUserId,
        'public_key': base64.encode(pubKeyBytes),
        'key_id': e2eKeyId,
        'type': 'offer',
      });
    } catch (e) {
      _logger.e('[E2EE] Key exchange generation failed: $e');
    }
  }

  Future<void> _handleE2eKeyExchangeSocket(dynamic data) async {
    if (!_secretChatEnabled) return;
    if (_currentUserId == null || _targetUserId == null || e2eKeyId == null) return;
    if (data == null || data['key_id']?.toString() != e2eKeyId) return;
    if (data['from_user_id']?.toString() != _targetUserId) return;

    final type = data['type']?.toString();
    final otherPubKeyB64 = data['public_key']?.toString() ?? '';
    if (otherPubKeyB64.isEmpty) return;

    try {
      _logger.d('[E2EE] Key exchange socket message received: $type');
      
      final domainParams = ECDomainParameters('prime256v1');
      final otherPubKeyBytes = base64.decode(otherPubKeyB64);
      final otherPoint = domainParams.curve.decodePoint(otherPubKeyBytes);
      final otherPubKey = ECPublicKey(otherPoint, domainParams);

      if (_ecdhKeyPair == null) {
        // Generate our pair if not generated yet
        final secureRandom = FortunaRandom();
        secureRandom.seed(KeyParameter(CryptoEngine.getRandomBytes(32)));
        final generator = KeyGenerator('EC');
        generator.init(ParametersWithRandom(
          ECKeyGeneratorParameters(domainParams),
          secureRandom,
        ));
        _ecdhKeyPair = generator.generateKeyPair() as AsymmetricKeyPair<ECPublicKey, ECPrivateKey>;
      }

      // Compute shared secret
      final agreement = ECDHBasicAgreement()..init(_ecdhKeyPair!.privateKey);
      final sharedSecretBigInt = agreement.calculateAgreement(otherPubKey);
      
      // Convert BigInt to 32 bytes array
      final sharedSecretBytes = _bigIntToBytes(sharedSecretBigInt, 32);

      // PBKDF2/SHA-256 derive key with seed = key_id
      final derived = _deriveKey(sharedSecretBytes, e2eKeyId!);
      _derivedE2eKey = derived;

      // Save locally
      await _keySyncService.persistKeyLocally(e2eKeyId!, derived);

      if (type == 'offer') {
        // Send our public key answer
        final pubKeyBytes = _ecdhKeyPair!.publicKey.Q!.getEncoded(false);
        _socketService.emit('e2e_key_exchange', {
          'target_user_id': _targetUserId,
          'public_key': base64.encode(pubKeyBytes),
          'key_id': e2eKeyId,
          'type': 'answer',
        });
      }

      _logger.d('[E2EE] Key exchange completed and stored for $e2eKeyId');

      add(_MessageKeyExchangeCompletedEvent(derived));

      // Flush pending messages
      if (_pendingE2eMessages.isNotEmpty) {
        for (final item in _pendingE2eMessages) {
          add(item);
        }
        _pendingE2eMessages.clear();
      }
    } catch (e) {
      _logger.e('[E2EE] Key exchange agreement derivation failed: $e');
    }
  }

  Uint8List _deriveKey(Uint8List sharedBytes, String keyId) {
    final salt = utf8.encode(_keySyncService.normalizeE2eKeyId(keyId));
    final combined = Uint8List(sharedBytes.length + salt.length);
    combined.setRange(0, sharedBytes.length, sharedBytes);
    combined.setRange(sharedBytes.length, combined.length, salt);
    return CryptoEngine.sha256(combined);
  }

  Uint8List _bigIntToBytes(BigInt number, int length) {
    final bytes = number.toRadixString(16).padLeft(length * 2, '0');
    final result = Uint8List(length);
    for (var i = 0; i < length; i++) {
      result[i] = int.parse(bytes.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }

  void _onMessageReadUpdate(MessageReadUpdateEvent event, Emitter<MessageState> emit) {
    final s = state;
    if (s is MessageLoadedState) {
      final updated = s.messages.map((m) {
        final data = event.data;
        final isForThisChat = (_targetUserId != null) ||
            (_groupId != null && data['group_id']?.toString() == _groupId) ||
            (_channelId != null && data['channel_id']?.toString() == _channelId);

        if (isForThisChat) {
          return m.copyWith(isRead: true);
        }
        return m;
      }).toList();
      emit(s.copyWith(messages: updated));
    }
  }

  @override
  Future<void> close() {
    _socketService.off('receive_message', _onReceiveMessageSocket);
    _socketService.off('message_sent', _onMessageSentSocket);
    _socketService.off('typing', _onTypingSocket);
    _socketService.off('message_deleted', _onMessageDeletedSocket);
    _socketService.off('message_edited', _onMessageEditedSocket);
    _socketService.off('messages_read_update', _onMessagesReadUpdateSocket);
    _socketService.off('e2e_key_exchange', _onE2eKeyExchangeSocket);
    return super.close();
  }
}

class _MessageKeyExchangeCompletedEvent extends MessageEvent {
  final Uint8List key;
  const _MessageKeyExchangeCompletedEvent(this.key);

  @override
  List<Object?> get props => [key];
}
