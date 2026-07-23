import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/socket_service.dart';
import '../../../core/utils/storage_service.dart';
import '../../../core/utils/url_helper.dart';
import '../../../crypto/key_sync_service.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../calls/bloc/call_bloc.dart';
import '../../calls/bloc/call_event.dart';
import '../bloc/message_bloc.dart';
import '../bloc/message_event.dart';
import '../bloc/message_state.dart';
import '../../home/bloc/inbox_bloc.dart';
import '../../home/bloc/inbox_state.dart';

class ChatScreen extends StatefulWidget {
  final String type;
  final String id;
  final String name;
  final String? avatarUrl;

  const ChatScreen({
    super.key,
    required this.type,
    required this.id,
    required this.name,
    this.avatarUrl,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  late final MessageBloc _messageBloc;
  bool _isTypingEventSent = false;
  bool _isOnline = false;

  @override
  void initState() {
    super.initState();
    _messageBloc = MessageBloc(
      context.read<ApiClient>(),
      context.read<SocketService>(),
      context.read<StorageService>(),
      context.read<KeySyncService>(),
    )..add(MessageLoadHistoryEvent(
        targetUserId: widget.type == 'dm' ? widget.id : null,
        groupId: widget.type == 'group' ? widget.id : null,
        channelId: widget.type == 'channel' ? widget.id : null,
      ));

    _messageController.addListener(_onTextChanged);
    _loadInitialStatusAndSubscribe();
  }

  @override
  void dispose() {
    _messageController.removeListener(_onTextChanged);
    _messageController.dispose();
    _scrollController.dispose();
    _messageBloc.close();
    if (widget.type == 'dm') {
      try {
        context.read<SocketService>().off('user_status_changed', _onUserStatusChangedSocket);
      } catch (_) {}
    }
    super.dispose();
  }

  void _loadInitialStatusAndSubscribe() {
    if (widget.type != 'dm') return;

    // 1. Try to get status from InboxBloc
    try {
      final inboxBloc = context.read<InboxBloc>();
      if (inboxBloc.state is InboxLoadedState) {
        final loaded = inboxBloc.state as InboxLoadedState;
        final chat = loaded.chats.firstWhere(
          (c) => c.id == widget.id && c.type == 'dm',
          orElse: () => const ChatPreview(
            id: '',
            name: '',
            type: 'dm',
            lastMessage: '',
            unreadCount: 0,
            timestamp: '',
            isOnline: false,
          ),
        );
        if (chat.id.isNotEmpty) {
          setState(() {
            _isOnline = chat.isOnline;
          });
        }
      }
    } catch (_) {}

    // 2. Fetch fresh user status from API /users/get
    try {
      final apiClient = context.read<ApiClient>();
      apiClient.post<Map<String, dynamic>>('/users/get', data: {'user_id': widget.id}).then((res) {
        if (res.data != null) {
          final isOnline = res.data?['status']?.toString() == 'online';
          if (mounted) {
            if (isOnline || !_isOnline) {
              setState(() {
                _isOnline = isOnline;
              });
            }
          }
        }
      }).catchError((_) {});
    } catch (_) {}

    // 3. Listen to socket updates
    try {
      context.read<SocketService>().on('user_status_changed', _onUserStatusChangedSocket);
    } catch (_) {}
  }

  void _onUserStatusChangedSocket(dynamic data) {
    if (data == null || !mounted) return;
    final userId = data['user_id']?.toString() ?? '';
    final status = data['status']?.toString() ?? '';
    if (userId == widget.id) {
      setState(() {
        _isOnline = status == 'online';
      });
    }
  }

  void _onTextChanged() {
    if (_messageController.text.trim().isNotEmpty && !_isTypingEventSent) {
      _isTypingEventSent = true;
      _messageBloc.add(MessageSendTypingEvent());
      // Reset typing throttle after 2 seconds
      Future.delayed(const Duration(seconds: 2), () {
        _isTypingEventSent = false;
      });
    }
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    _messageBloc.add(MessageSendEvent(content: text));
    _messageController.clear();
    
    // Smooth scroll to bottom
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _startVoiceCall(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    if (authState.user != null) {
      context.read<CallBloc>().add(CallStartEvent(
        targetUserId: widget.id,
        targetUserName: widget.name,
      ));
      context.push('/call');
    }
  }

  void _startVideoCall(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    if (authState.user != null) {
      context.read<CallBloc>().add(CallStartEvent(
        targetUserId: widget.id,
        targetUserName: widget.name,
      ));
      context.push('/call');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.read<AuthBloc>().state;
    final myId = authState.user?.id ?? '';

    return BlocProvider.value(
      value: _messageBloc,
      child: Scaffold(
        backgroundColor: const Color(0xFF09090E),
        appBar: AppBar(
          backgroundColor: const Color(0xFF11111A),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white70, size: 20),
            onPressed: () => context.pop(),
          ),
          title: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: const Color(0xFF7000FF).withOpacity(0.15),
                    backgroundImage: widget.avatarUrl != null && widget.avatarUrl!.isNotEmpty
                        ? NetworkImage(widget.avatarUrl!.toAbsoluteUrl)
                        : null,
                    child: widget.avatarUrl == null || widget.avatarUrl!.isEmpty
                        ? Text(
                            widget.name.isNotEmpty ? widget.name.substring(0, 1).toUpperCase() : '?',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00C2FF), fontSize: 16),
                          )
                        : null,
                  ),
                  if (widget.type == 'dm' && _isOnline)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: const Color(0xFF00FF87),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF11111A), width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.name,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                      overflow: TextOverflow.ellipsis,
                    ),
                    BlocBuilder<MessageBloc, MessageState>(
                      builder: (context, state) {
                        if (state is MessageLoadedState && state.isTyping) {
                          return const Text(
                            'печатает...',
                            style: TextStyle(fontSize: 11, color: Color(0xFF00FF87), fontWeight: FontWeight.w500),
                          );
                        }
                        return Text(
                          widget.type == 'dm' 
                              ? (_isOnline ? 'в сети' : 'не в сети') 
                              : 'чат',
                          style: TextStyle(
                            fontSize: 11, 
                            color: widget.type == 'dm' && _isOnline 
                                ? const Color(0xFF00FF87).withOpacity(0.8) 
                                : Colors.white.withOpacity(0.3),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            // E2EE Lock Switch for DMs
            if (widget.type == 'dm')
              BlocBuilder<MessageBloc, MessageState>(
                builder: (context, state) {
                  final e2eEnabled = state is MessageLoadedState && state.secretChatEnabled;
                  return IconButton(
                    icon: Icon(
                      e2eEnabled ? Icons.lock : Icons.lock_open,
                      color: e2eEnabled ? const Color(0xFF00C2FF) : Colors.white38,
                    ),
                    onPressed: () {
                      _messageBloc.add(MessageToggleE2eEvent(!e2eEnabled));
                    },
                  );
                },
              ),
            if (widget.type == 'dm') ...[
              IconButton(
                icon: const Icon(Icons.phone_outlined, color: Colors.white70),
                onPressed: () => _startVoiceCall(context),
              ),
              IconButton(
                icon: const Icon(Icons.videocam_outlined, color: Colors.white70),
                onPressed: () => _startVideoCall(context),
              ),
            ],
            const SizedBox(width: 8),
          ],
        ),
        body: Column(
          children: [
            // Secret Chat Key Exchange Pending Header
            BlocBuilder<MessageBloc, MessageState>(
              builder: (context, state) {
                if (state is MessageLoadedState && state.secretChatEnabled && state.isKeyExchangePending) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                    color: const Color(0xFF7000FF).withOpacity(0.15),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
                        ),
                        SizedBox(width: 10),
                        Text(
                          'Генерация ключей шифрования...',
                          style: TextStyle(color: Color(0xFF00C2FF), fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  );
                }
                return const SizedBox();
              },
            ),

            // Messages View Binded to MessageBloc
            Expanded(
              child: BlocBuilder<MessageBloc, MessageState>(
                builder: (context, state) {
                  if (state is MessageLoadingState) {
                    return const Center(
                      child: CircularProgressIndicator(color: Color(0xFF00C2FF)),
                    );
                  }

                  if (state is MessageErrorState) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                          const SizedBox(height: 16),
                          Text(state.message, style: const TextStyle(color: Colors.white70)),
                        ],
                      ),
                    );
                  }

                  if (state is MessageLoadedState) {
                    final messages = state.messages;

                    if (messages.isEmpty) {
                      return Center(
                        child: Text(
                          state.secretChatEnabled
                              ? '🔒 Секретный E2EE чат начат.\nСообщения защищены сквозным шифрованием.'
                              : 'Сообщений пока нет',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white.withOpacity(0.3), height: 1.4),
                        ),
                      );
                    }

                    return ListView.builder(
                      controller: _scrollController,
                      reverse: true,
                      padding: const EdgeInsets.all(16),
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final msg = messages[index];
                        final isMe = msg.senderId == myId;

                        return _buildMessageBubble(msg, isMe);
                      },
                    );
                  }

                  return const SizedBox();
                },
              ),
            ),

            // Floating Input Panel Overhauled to Glassmorphism Pill Look
            _buildInputPanel(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, bool isMe) {
    final timeStr = _formatMessageTime(msg.timestamp);
    final isVoice = msg.type == 'voice';
    final isVideoNote = msg.type == 'video_note';

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: BoxConstraints(
          maxWidth: isVideoNote ? 160 : MediaQuery.of(context).size.width * 0.75,
        ),
        decoration: BoxDecoration(
          gradient: isMe && !isVideoNote
              ? const LinearGradient(
                  colors: [Color(0xFF7000FF), Color(0xFF00C2FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: isMe
              ? (isVideoNote ? Colors.transparent : null)
              : (isVideoNote ? Colors.transparent : Colors.white.withOpacity(0.04)),
          borderRadius: isVideoNote
              ? BorderRadius.circular(80)
              : BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
                  bottomRight: isMe ? Radius.zero : const Radius.circular(16),
                ),
          border: isMe || isVideoNote
              ? null
              : Border.all(color: Colors.white.withOpacity(0.04), width: 1),
        ),
        padding: isVideoNote
            ? EdgeInsets.zero
            : const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (msg.attachments is List && (msg.attachments as List).isNotEmpty) ...[
              for (final attachment in msg.attachments as List)
                _buildAttachmentWidget(attachment, isMe),
              if (msg.content.isNotEmpty && !msg.content.startsWith('http')) ...[
                const SizedBox(height: 8),
                Text(
                  msg.content,
                  style: const TextStyle(fontSize: 15, color: Colors.white, height: 1.3),
                ),
              ],
            ] else if (isVoice)
              VoiceMessageWidget(url: msg.content, isMe: isMe)
            else if (isVideoNote)
              VideoNoteWidget(url: msg.content)
            else
              Text(
                msg.content,
                style: const TextStyle(fontSize: 15, color: Colors.white, height: 1.3),
              ),
            if (!isVideoNote) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (msg.isE2ee)
                    const Padding(
                      padding: EdgeInsets.only(right: 4.0),
                      child: Icon(Icons.security, color: Color(0xFF00FF87), size: 12),
                    ),
                  Text(
                    timeStr,
                    style: TextStyle(
                      fontSize: 10,
                      color: isMe ? Colors.white70 : Colors.white30,
                    ),
                  ),
                  if (isMe) ...[
                    const SizedBox(width: 4),
                    Icon(
                      msg.isRead ? Icons.done_all : Icons.done,
                      size: 14,
                      color: const Color(0xFF00FF87),
                    ),
                  ]
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentWidget(dynamic attachment, bool isMe) {
    if (attachment is! Map) return const SizedBox.shrink();
    final url = attachment['url']?.toString() ?? '';
    final name = attachment['name']?.toString() ?? 'Файл';
    final ext = (attachment['ext']?.toString() ?? name.split('.').last).toLowerCase();
    final size = attachment['size'] as int? ?? 0;
    
    final isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext);
    final isVideo = ['mp4', 'mov', 'avi', 'mkv', '3gp'].contains(ext);
    final isAudio = ['mp3', 'wav', 'm4a', 'ogg', 'opus'].contains(ext);

    if (isImage && url.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6.0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: GestureDetector(
            onTap: () => _openUrl(url),
            child: Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  color: Colors.white10,
                  child: Row(
                    children: [
                      const Icon(Icons.broken_image_outlined, color: Colors.white30),
                      const SizedBox(width: 8),
                      Expanded(child: Text(name, style: const TextStyle(color: Colors.white70, fontSize: 13))),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      );
    }

    if (isVideo && url.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6.0),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white10,
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.video_collection_outlined, color: Color(0xFF00C2FF)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      name,
                      style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 120,
                width: double.infinity,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(color: Colors.black45),
                      IconButton(
                        icon: const Icon(Icons.play_circle_outline, color: Colors.white, size: 48),
                        onPressed: () => _openUrl(url),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (isAudio && url.isNotEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 6.0),
        child: VoiceMessageWidget(url: url, isMe: isMe),
      );
    }

    // Default document/file
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.04)),
        ),
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF00C2FF).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.insert_drive_file_outlined, color: Color(0xFF00C2FF), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatBytes(size.toDouble()),
                    style: const TextStyle(color: Colors.white30, fontSize: 11),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.download_for_offline_outlined, color: Colors.white70),
              onPressed: () => _openUrl(url),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openUrl(String urlString) async {
    try {
      final uri = Uri.parse(urlString);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        throw 'Could not launch $urlString';
      }
    } catch (e) {
      _showErrorSnackBar('Не удалось открыть ссылку: $e');
    }
  }

  Widget _buildInputPanel() {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF11111A),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05), width: 1)),
        ),
        child: Row(
          children: [
            // Attach Button
            Container(
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: const Icon(Icons.add, color: Color(0xFF00C2FF)),
                onPressed: _showAttachmentMenu,
              ),
            ),
            const SizedBox(width: 12),

            // Text Input Pill
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.06), width: 1),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _messageController,
                  maxLines: null,
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                  decoration: const InputDecoration(
                    hintText: 'Сообщение...',
                    hintStyle: TextStyle(color: Colors.white24),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),

            // Send Button with glowing brand circle
            GestureDetector(
              onTap: _sendMessage,
              child: Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [Color(0xFF7000FF), Color(0xFF00C2FF)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x3D7000FF),
                      blurRadius: 10,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAttachmentMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF13131A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFF7000FF).withOpacity(0.15), shape: BoxShape.circle),
                  child: const Icon(Icons.videocam_outlined, color: Color(0xFF00C2FF)),
                ),
                title: const Text('Записать видеосообщение (кружок)', style: TextStyle(color: Colors.white)),
                subtitle: const Text('Снять короткое видео на камеру', style: TextStyle(color: Colors.white30, fontSize: 12)),
                onTap: () {
                  Navigator.pop(context);
                  _sendVideoNote();
                },
              ),
               ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFF7000FF).withOpacity(0.15), shape: BoxShape.circle),
                  child: const Icon(Icons.mic_none_outlined, color: Color(0xFF00C2FF)),
                ),
                title: const Text('Отправить голосовое сообщение', style: TextStyle(color: Colors.white)),
                subtitle: const Text('Выбрать и отправить аудиозапись', style: TextStyle(color: Colors.white30, fontSize: 12)),
                onTap: () {
                  Navigator.pop(context);
                  _sendVoiceMessage();
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: const Color(0xFF7000FF).withOpacity(0.15), shape: BoxShape.circle),
                  child: const Icon(Icons.insert_drive_file_outlined, color: Color(0xFF00C2FF)),
                ),
                title: const Text('Отправить файл', style: TextStyle(color: Colors.white)),
                subtitle: const Text('Выбрать фото, документ или архив', style: TextStyle(color: Colors.white30, fontSize: 12)),
                onTap: () {
                  Navigator.pop(context);
                  _pickAndSendFile();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  final ImagePicker _picker = ImagePicker();

  Future<void> _sendVideoNote() async {
    try {
      final XFile? video = await _picker.pickVideo(
        source: ImageSource.camera,
        maxDuration: const Duration(seconds: 60),
      );
      if (video == null) return;
      await _uploadAndSendMedia(video.path, 'video_note');
    } catch (e) {
      _showErrorSnackBar('Не удалось записать видеосообщение: $e');
    }
  }

  Future<void> _sendVoiceMessage() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.audio,
        allowMultiple: false,
      );
      if (result == null || result.files.single.path == null) return;
      await _uploadAndSendMedia(result.files.single.path!, 'voice');
    } catch (e) {
      _showErrorSnackBar('Не удалось выбрать аудио: $e');
    }
  }

  Future<void> _pickAndSendFile() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.any,
        allowMultiple: false,
      );
      if (result == null || result.files.single.path == null) return;
      await _uploadAndSendMedia(result.files.single.path!, 'file');
    } catch (e) {
      _showErrorSnackBar('Не удалось выбрать файл: $e');
    }
  }

  Future<void> _uploadAndSendMedia(String filePath, String type) async {
    // Show uploading snackbar
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
            ),
            const SizedBox(width: 12),
            Text(type == 'voice' 
                ? 'Загрузка голосового сообщения...' 
                : (type == 'video_note' ? 'Загрузка видеосообщения...' : 'Загрузка файла...')),
          ],
        ),
        duration: const Duration(days: 1),
      ),
    );

    try {
      final file = File(filePath);
      final fileBytes = await file.readAsBytes();
      final base64Data = base64.encode(fileBytes);
      final ext = filePath.split('.').last;
      final filename = filePath.split(Platform.isWindows ? '\\' : '/').last;

      final apiClient = context.read<ApiClient>();
      final endpoint = type == 'voice' 
          ? '/upload/voice' 
          : (type == 'video_note' ? '/upload/video' : '/upload/file');

      final response = await apiClient.post<Map<String, dynamic>>(
        endpoint,
        data: {
          'file': base64Data,
          'filename': filename,
        },
        options: Options(
          connectTimeout: const Duration(minutes: 5),
          sendTimeout: const Duration(minutes: 5),
          receiveTimeout: const Duration(minutes: 5),
        ),
      );

      final url = response.data?['url']?.toString();
      ScaffoldMessenger.of(context).removeCurrentSnackBar();

      if (url != null) {
        final attachmentObj = {
          'url': url,
          'name': response.data?['original_filename'] ?? filename,
          'ext': response.data?['ext'] ?? ext,
          'size': response.data?['size_bytes'] ?? fileBytes.length,
        };

        _messageBloc.add(MessageSendEvent(
          content: url, // Fallback URL for backwards compatibility
          type: type == 'video_note' ? 'video_note' : (type == 'voice' ? 'voice' : 'text'),
          attachments: [attachmentObj],
        ));

        _showSuccessSnackBar(type == 'voice' 
            ? 'Голосовое сообщение отправлено' 
            : (type == 'video_note' ? 'Видеосообщение отправлено' : 'Файл отправлен'));
      } else {
        throw Exception('Server did not return file URL');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).removeCurrentSnackBar();
      _showErrorSnackBar('Не удалось загрузить файл: $e');
    }
  }

  String _formatBytes(double bytes) {
    if (bytes <= 0) return '0 Б';
    const suffixes = ["Б", "КБ", "МБ", "ГБ"];
    var i = 0;
    var value = bytes;
    while (value >= 1024 && i < suffixes.length - 1) {
      value /= 1024;
      i++;
    }
    return '${value.toStringAsFixed(1)} ${suffixes[i]}';
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.redAccent),
    );
  }

  void _showSuccessSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: const Color(0xFF00FF87)),
    );
  }

  String _formatMessageTime(String timestamp) {
    if (timestamp.isEmpty) return '';
    try {
      final parsed = DateTime.parse(timestamp);
      return DateFormat('HH:mm').format(parsed);
    } catch (_) {
      return '';
    }
  }
}

class VoiceMessageWidget extends StatefulWidget {
  final String url;
  final bool isMe;

  const VoiceMessageWidget({super.key, required this.url, required this.isMe});

  @override
  State<VoiceMessageWidget> createState() => _VoiceMessageWidgetState();
}

class _VoiceMessageWidgetState extends State<VoiceMessageWidget> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  @override
  void initState() {
    super.initState();
    final cleanUrl = widget.url.startsWith('/') ? 'https://vondic.ru${widget.url}' : widget.url;
    _controller = VideoPlayerController.networkUrl(Uri.parse(cleanUrl))
      ..initialize().then((_) {
        if (mounted) {
          setState(() {
            _isInitialized = true;
            _duration = _controller.value.duration;
          });
        }
      });

    _controller.addListener(() {
      if (mounted) {
        setState(() {
          _isPlaying = _controller.value.isPlaying;
          _position = _controller.value.position;
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (!_isInitialized) return;
    if (_isPlaying) {
      _controller.pause();
    } else {
      _controller.play();
    }
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: Icon(
            _isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
            color: widget.isMe ? Colors.white : const Color(0xFF00C2FF),
            size: 32,
          ),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          onPressed: _togglePlay,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_isInitialized)
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 2,
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                    overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                    activeTrackColor: widget.isMe ? Colors.white : const Color(0xFF00C2FF),
                    inactiveTrackColor: Colors.white24,
                    thumbColor: widget.isMe ? Colors.white : const Color(0xFF00C2FF),
                  ),
                  child: Slider(
                    value: _position.inMilliseconds.toDouble().clamp(0.0, _duration.inMilliseconds.toDouble()),
                    max: _duration.inMilliseconds.toDouble(),
                    onChanged: (val) {
                      _controller.seekTo(Duration(milliseconds: val.toInt()));
                    },
                  ),
                )
              else
                Container(
                  height: 2,
                  color: Colors.white24,
                  margin: const EdgeInsets.symmetric(vertical: 8),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatDuration(_position),
                    style: const TextStyle(fontSize: 10, color: Colors.white60),
                  ),
                  Text(
                    _formatDuration(_duration),
                    style: const TextStyle(fontSize: 10, color: Colors.white60),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class VideoNoteWidget extends StatefulWidget {
  final String url;

  const VideoNoteWidget({super.key, required this.url});

  @override
  State<VideoNoteWidget> createState() => _VideoNoteWidgetState();
}

class _VideoNoteWidgetState extends State<VideoNoteWidget> {
  late VideoPlayerController _controller;
  bool _isInitialized = false;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    final cleanUrl = widget.url.startsWith('/') ? 'https://vondic.ru${widget.url}' : widget.url;
    _controller = VideoPlayerController.networkUrl(Uri.parse(cleanUrl))
      ..initialize().then((_) {
        if (mounted) {
          setState(() {
            _isInitialized = true;
          });
        }
      })
      ..setLooping(true);

    _controller.addListener(() {
      if (mounted) {
        setState(() {
          _isPlaying = _controller.value.isPlaying;
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (!_isInitialized) return;
    if (_isPlaying) {
      _controller.pause();
    } else {
      _controller.play();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _togglePlay,
      child: Container(
        width: 140,
        height: 140,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.black,
          border: Border.all(color: const Color(0xFF00C2FF).withOpacity(0.4), width: 2),
        ),
        child: ClipOval(
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (_isInitialized)
                SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _controller.value.size.width,
                      height: _controller.value.size.height,
                      child: VideoPlayer(_controller),
                    ),
                  ),
                )
              else
                const Center(
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
                ),
              if (!_isPlaying && _isInitialized)
                Container(
                  color: Colors.black38,
                  child: const Center(
                    child: Icon(Icons.play_arrow_rounded, color: Colors.white, size: 40),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
