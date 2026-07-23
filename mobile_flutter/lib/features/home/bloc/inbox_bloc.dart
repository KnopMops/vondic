import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:audioplayers/audioplayers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/socket_service.dart';
import '../../../core/utils/storage_service.dart';
import '../../../crypto/crypto_engine.dart';
import '../../../crypto/key_sync_service.dart';
import 'inbox_event.dart';
import 'inbox_state.dart';

class InboxBloc extends Bloc<InboxEvent, InboxState> {
  final ApiClient _apiClient;
  final SocketService _socketService;
  final StorageService _storageService;
  final KeySyncService _keySyncService;
  StreamSubscription? _socketSubscription;
  final AudioPlayer _audioPlayer = AudioPlayer();

  InboxBloc(
    this._apiClient,
    this._socketService,
    this._storageService,
    this._keySyncService,
  ) : super(InboxInitialState()) {
    on<InboxLoadEvent>(_onLoadInbox);
    on<InboxUpdateLastMessageEvent>(_onUpdateLastMessage);
    on<InboxUserStatusChangedEvent>(_onUserStatusChanged);
    on<InboxTogglePinChatEvent>(_onTogglePinChat);
    on<InboxMovePinnedChatEvent>(_onMovePinnedChat);
    on<InboxSetPinnedChatsEvent>(_onSetPinnedChats);

    _setupSocketListeners();
  }

  void _setupSocketListeners() {
    _socketService.on('receive_message', _onReceiveMessageSocket);
    _socketService.on('message_sent', _onMessageSentSocket);
    _socketService.on('user_status_changed', _onUserStatusChangedSocket);
  }

  void _onReceiveMessageSocket(dynamic data) {
    _handleIncomingSocketMessage(data);
  }

  void _onMessageSentSocket(dynamic data) {
    final msg = data['message'] ?? data;
    _handleIncomingSocketMessage(msg);
  }

  void _handleIncomingSocketMessage(dynamic data) {
    if (data == null) return;
    
    final senderId = data['sender_id']?.toString() ?? '';
    final targetUserId = (data['target_user_id'] ?? data['target_id'])?.toString() ?? '';
    final groupId = data['group_id']?.toString() ?? '';
    final channelId = data['channel_id']?.toString() ?? '';
    
    final content = data['content']?.toString() ?? '';
    final timestamp = data['timestamp']?.toString() ?? data['created_at']?.toString() ?? DateTime.now().toIso8601String();

    String chatId = '';
    String type = 'dm';

    if (groupId.isNotEmpty) {
      chatId = groupId;
      type = 'group';
    } else if (channelId.isNotEmpty) {
      chatId = channelId;
      type = 'channel';
    } else {
      final myUserStr = _storageService.readString('user');
      final myId = myUserStr != null ? jsonDecode(myUserStr)['id']?.toString() ?? '' : '';
      chatId = (senderId == myId) ? targetUserId : senderId;
      type = 'dm';
    }

    if (chatId.isNotEmpty) {
      add(InboxUpdateLastMessageEvent(
        chatId: chatId,
        messageText: content,
        timestamp: timestamp,
        type: type,
      ));
      _playNotificationSound();
    }
  }

  Future<void> _playNotificationSound() async {
    try {
      await _audioPlayer.stop();
      await _audioPlayer.play(AssetSource('static/message.mp3'));
    } catch (e) {
      debugPrint('[InboxBloc] Error playing message sound: $e');
    }
  }

  List<String> _getPinnedChatIds() {
    final raw = _storageService.readString('pinned_chats');
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw);
      if (list is List) {
        return list.map((e) => e.toString()).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<void> _savePinnedChatIds(List<String> pinnedIds) async {
    await _storageService.writeString('pinned_chats', jsonEncode(pinnedIds));
    try {
      await _apiClient.post('/users/pinned-chats', data: {'pinned_chats': pinnedIds});
    } catch (_) {}
  }

  List<ChatPreview> _applyPinnedSort(List<ChatPreview> inputChats, List<String> pinnedIds) {
    final List<ChatPreview> mapped = inputChats.map((c) {
      final isPinned = pinnedIds.contains(c.id);
      final pinIndex = isPinned ? pinnedIds.indexOf(c.id) : -1;
      return c.copyWith(isPinned: isPinned, pinIndex: pinIndex);
    }).toList();

    mapped.sort((a, b) {
      if (a.isPinned && b.isPinned) {
        return a.pinIndex.compareTo(b.pinIndex);
      }
      if (a.isPinned) return -1;
      if (b.isPinned) return 1;
      return b.timestamp.compareTo(a.timestamp);
    });

    return mapped;
  }

  Future<void> _onLoadInbox(InboxLoadEvent event, Emitter<InboxState> emit) async {
    emit(InboxLoadingState());
    try {
      // 1. Fetch DMs
      final recentRes = await _apiClient.get<Map<String, dynamic>>('/dm/recent');
      final recentItems = recentRes.data?['items'] as List? ?? [];
      final List<ChatPreview> chats = [];

      final myUserStr = _storageService.readString('user');
      final myId = myUserStr != null ? jsonDecode(myUserStr)['id']?.toString() ?? '' : '';

      for (final r in recentItems) {
        final dmId = r['id']?.toString() ?? r['target_id']?.toString() ?? '';
        var lastMsg = r['last_message_text']?.toString() ?? '';
        final unread = r['unread_count'] as int? ?? 0;
        final timestamp = r['last_message_at']?.toString() ?? '';

        // Try decrypting preview if it's E2E
        if (lastMsg.startsWith('e2e:') && myId.isNotEmpty && dmId.isNotEmpty) {
          final keyId = _keySyncService.normalizeE2eKeyId('$myId:$dmId');
          final localKey = await _keySyncService.getPersistedKeyLocally(keyId);
          if (localKey != null) {
            final plain = CryptoEngine.mtDecrypt(lastMsg, localKey);
            if (plain != null) {
              lastMsg = plain;
            }
          }
        }

        chats.add(ChatPreview(
          id: dmId,
          name: r['username']?.toString() ?? r['name']?.toString() ?? 'Пользователь',
          avatarUrl: r['avatar_url']?.toString(),
          type: 'dm',
          lastMessage: lastMsg,
          unreadCount: unread,
          timestamp: timestamp,
          isOnline: r['status']?.toString() == 'online',
        ));
      }

      // 2. Fetch Groups & Channels & Communities
      final groupsRes = await _apiClient.post<List<dynamic>>('/groups/my', data: {});
      final groupsItems = groupsRes.data ?? [];
      for (final g in groupsItems) {
        chats.add(ChatPreview(
          id: g['id']?.toString() ?? '',
          name: g['name']?.toString() ?? 'Группа',
          avatarUrl: g['avatar_url']?.toString(),
          type: 'group',
          lastMessage: g['last_message']?.toString() ?? '',
          unreadCount: 0,
          timestamp: g['updated_at']?.toString() ?? '',
        ));
      }

      final channelsRes = await _apiClient.post<List<dynamic>>('/channels/my', data: {});
      final channelsItems = channelsRes.data ?? [];
      for (final c in channelsItems) {
        chats.add(ChatPreview(
          id: c['id']?.toString() ?? '',
          name: c['name']?.toString() ?? 'Канал',
          avatarUrl: c['avatar_url']?.toString(),
          type: 'channel',
          lastMessage: c['last_message']?.toString() ?? '',
          unreadCount: 0,
          timestamp: c['updated_at']?.toString() ?? '',
          communityId: c['community_id']?.toString(),
        ));
      }

      final communitiesRes = await _apiClient.post<List<dynamic>>('/communities/my', data: {});
      final communitiesItems = communitiesRes.data ?? [];

      final pinnedIds = _getPinnedChatIds();
      final sortedChats = _applyPinnedSort(chats, pinnedIds);

      emit(InboxLoadedState(chats: sortedChats, communities: communitiesItems));
    } catch (e) {
      emit(InboxErrorState('Ошибка загрузки списка чатов: $e'));
    }
  }

  Future<void> _onUpdateLastMessage(
    InboxUpdateLastMessageEvent event,
    Emitter<InboxState> emit,
  ) async {
    if (state is InboxLoadedState) {
      final loaded = state as InboxLoadedState;
      final chats = List<ChatPreview>.from(loaded.chats);
      
      final index = chats.indexWhere((c) => c.id == event.chatId && c.type == event.type);
      
      var lastMsg = event.messageText;
      // Try decrypting if it is E2E
      if (lastMsg.startsWith('e2e:') && event.type == 'dm') {
        final myUserStr = _storageService.readString('user');
        if (myUserStr != null) {
          final myId = jsonDecode(myUserStr)['id']?.toString() ?? '';
          final keyId = _keySyncService.normalizeE2eKeyId('$myId:${event.chatId}');
          final localKey = await _keySyncService.getPersistedKeyLocally(keyId);
          if (localKey != null) {
            final plain = CryptoEngine.mtDecrypt(lastMsg, localKey);
            if (plain != null) {
              lastMsg = plain;
            }
          }
        }
      }

      if (index != -1) {
        final updated = chats[index].copyWith(
          lastMessage: lastMsg,
          timestamp: event.timestamp,
          unreadCount: chats[index].unreadCount + 1,
        );
        chats[index] = updated;
      } else {
        // Chat not found in list, trigger reload
        add(InboxLoadEvent());
        return;
      }

      final pinnedIds = _getPinnedChatIds();
      final sortedChats = _applyPinnedSort(chats, pinnedIds);
      emit(InboxLoadedState(chats: sortedChats, communities: loaded.communities));
    }
  }

  void _onTogglePinChat(InboxTogglePinChatEvent event, Emitter<InboxState> emit) {
    final currentState = state;
    if (currentState is InboxLoadedState) {
      final pinnedIds = _getPinnedChatIds();
      if (pinnedIds.contains(event.chatId)) {
        pinnedIds.remove(event.chatId);
      } else {
        pinnedIds.insert(0, event.chatId);
      }
      _savePinnedChatIds(pinnedIds);
      final updatedChats = _applyPinnedSort(currentState.chats, pinnedIds);
      emit(InboxLoadedState(chats: updatedChats, communities: currentState.communities));
    }
  }

  void _onMovePinnedChat(InboxMovePinnedChatEvent event, Emitter<InboxState> emit) {
    final currentState = state;
    if (currentState is InboxLoadedState) {
      final pinnedIds = _getPinnedChatIds();
      final idx = pinnedIds.indexOf(event.chatId);
      if (idx == -1) return;

      if (event.moveUp && idx > 0) {
        final temp = pinnedIds[idx];
        pinnedIds[idx] = pinnedIds[idx - 1];
        pinnedIds[idx - 1] = temp;
      } else if (!event.moveUp && idx < pinnedIds.length - 1) {
        final temp = pinnedIds[idx];
        pinnedIds[idx] = pinnedIds[idx + 1];
        pinnedIds[idx + 1] = temp;
      } else {
        return;
      }

      _savePinnedChatIds(pinnedIds);
      final updatedChats = _applyPinnedSort(currentState.chats, pinnedIds);
      emit(InboxLoadedState(chats: updatedChats, communities: currentState.communities));
    }
  }

  void _onSetPinnedChats(InboxSetPinnedChatsEvent event, Emitter<InboxState> emit) {
    final currentState = state;
    if (currentState is InboxLoadedState) {
      final pinnedIds = List<String>.from(event.pinnedChatIds);
      _savePinnedChatIds(pinnedIds);
      final updatedChats = _applyPinnedSort(currentState.chats, pinnedIds);
      emit(InboxLoadedState(chats: updatedChats, communities: currentState.communities));
    }
  }

  void _onUserStatusChangedSocket(dynamic data) {
    if (data == null) return;
    final userId = data['user_id']?.toString() ?? '';
    final status = data['status']?.toString() ?? '';
    if (userId.isNotEmpty) {
      add(InboxUserStatusChangedEvent(userId: userId, isOnline: status == 'online'));
    }
  }

  void _onUserStatusChanged(InboxUserStatusChangedEvent event, Emitter<InboxState> emit) {
    final state = this.state;
    if (state is InboxLoadedState) {
      final List<ChatPreview> chats = List.from(state.chats);
      bool updatedAny = false;
      for (int i = 0; i < chats.length; i++) {
        if (chats[i].type == 'dm' && chats[i].id == event.userId) {
          chats[i] = chats[i].copyWith(isOnline: event.isOnline);
          updatedAny = true;
        }
      }
      if (updatedAny) {
        final pinnedIds = _getPinnedChatIds();
        final sortedChats = _applyPinnedSort(chats, pinnedIds);
        emit(InboxLoadedState(chats: sortedChats, communities: state.communities));
      }
    }
  }

  @override
  Future<void> close() {
    _socketSubscription?.cancel();
    _socketService.off('receive_message', _onReceiveMessageSocket);
    _socketService.off('message_sent', _onMessageSentSocket);
    _socketService.off('user_status_changed', _onUserStatusChangedSocket);
    _audioPlayer.dispose();
    return super.close();
  }
}
