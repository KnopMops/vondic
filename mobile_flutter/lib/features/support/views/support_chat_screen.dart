import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';

class SupportChatScreen extends StatefulWidget {
  final bool isAnon;
  final String? escalationId;
  final String? anonToken;

  const SupportChatScreen({
    super.key,
    required this.isAnon,
    this.escalationId,
    this.anonToken,
  });

  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  final List<dynamic> _messages = [];
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;
  bool _sending = false;
  String? _error;
  String _status = 'open';
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    // Auto polling every 5 seconds for live support updates
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadMessages(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = _messages.isEmpty;
        _error = null;
      });
    }

    try {
      final apiClient = context.read<ApiClient>();
      if (widget.isAnon) {
        // Anonymous messages endpoint
        final res = await apiClient.get<Map<String, dynamic>>(
          '/support/anon/${widget.escalationId}/messages?token=${widget.anonToken}',
        );
        final list = res.data?['messages'] as List? ?? [];
        final status = res.data?['status']?.toString() ?? 'open';

        setState(() {
          _messages.clear();
          _messages.addAll(list);
          _status = status;
          _loading = false;
        });
      } else {
        // Authenticated escalation messages endpoint
        final res = await apiClient.get<Map<String, dynamic>>(
          '/support/messenger/${widget.escalationId}/messages',
        );
        final list = res.data?['messages'] as List? ?? [];
        final status = res.data?['status']?.toString() ?? 'open';

        setState(() {
          _messages.clear();
          _messages.addAll(list);
          _status = status;
          _loading = false;
        });
      }
      _scrollToBottom();
    } catch (e) {
      debugPrint('[SupportChat] Load error: $e');
      if (!silent) {
        setState(() {
          _error = 'Не удалось загрузить сообщения';
          _loading = false;
        });
      }
    }
  }

  Future<void> _sendMessage() async {
    final text = _msgController.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() {
      _sending = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      if (widget.isAnon) {
        await apiClient.post('/support/anon/${widget.escalationId}/send', data: {
          'token': widget.anonToken,
          'message': text,
        });
      } else {
        await apiClient.post('/support/chat/send', data: {
          'esc_id': widget.escalationId,
          'message': text,
        });
      }

      setState(() {
        _msgController.clear();
      });
      _loadMessages(silent: true);
    } catch (e) {
      debugPrint('[SupportChat] Send error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка отправки: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _sending = false;
        });
      }
    }
  }

  Future<void> _deleteTicket() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF11111A),
        title: const Text('Удалить обращение?', style: TextStyle(color: Colors.white)),
        content: Text('Удалить закрытое обращение #${widget.escalationId}?', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Удалить', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/support/chats/${widget.escalationId}/delete');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Обращение удалено'), backgroundColor: Color(0xFF00FF87)),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      debugPrint('[SupportChat] Delete error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось удалить: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatTime(String raw) {
    if (raw.isEmpty) return '';
    try {
      final parsed = DateTime.parse(raw);
      return DateFormat('HH:mm').format(parsed);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isClosed = _status.toLowerCase() == 'closed';
    final escId = widget.escalationId ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Обращение #${escId.isNotEmpty ? escId : "..."}',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: isClosed ? Colors.white38 : const Color(0xFF00FF87),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  isClosed ? 'Чат закрыт' : 'В работе оператора',
                  style: TextStyle(fontSize: 11, color: isClosed ? Colors.white38 : const Color(0xFF00FF87)),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF00C2FF)),
            onPressed: () => _loadMessages(),
          ),
          if (isClosed && !widget.isAnon)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
              tooltip: 'Удалить обращение',
              onPressed: _deleteTicket,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                      const SizedBox(height: 16),
                      Text(_error!, style: const TextStyle(color: Colors.white70)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => _loadMessages(),
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                        child: const Text('Повторить'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: _messages.isEmpty
                          ? const Center(
                              child: Text(
                                'Сообщений пока нет. Напишите ваш вопрос ниже.',
                                style: TextStyle(color: Colors.white24, fontSize: 13),
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.all(16),
                              itemCount: _messages.length,
                              itemBuilder: (context, index) {
                                final msg = _messages[index];
                                final content = msg['content']?.toString() ?? '';
                                final sender = msg['sender']?.toString() ?? 'admin';
                                final time = _formatTime(msg['created_at']?.toString() ?? '');

                                final isMe = sender == 'user';

                                return Align(
                                  alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 12),
                                    constraints: BoxConstraints(
                                      maxWidth: MediaQuery.of(context).size.width * 0.78,
                                    ),
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: isMe
                                          ? const Color(0xFF7000FF).withOpacity(0.2)
                                          : const Color(0xFF1C1C1E),
                                      borderRadius: BorderRadius.only(
                                        topLeft: const Radius.circular(16),
                                        topRight: const Radius.circular(16),
                                        bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
                                        bottomRight: isMe ? Radius.zero : const Radius.circular(16),
                                      ),
                                      border: Border.all(
                                        color: isMe
                                            ? const Color(0xFF7000FF).withOpacity(0.3)
                                            : Colors.white.withOpacity(0.04),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        if (!isMe) ...[
                                          Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.headset_mic_outlined, size: 12, color: Color(0xFF00C2FF)),
                                              const SizedBox(width: 4),
                                              Text(
                                                sender == 'support' || sender == 'admin' ? 'Поддержка Vondic' : sender,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF00C2FF),
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                        ],
                                        Text(
                                          content,
                                          style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                                        ),
                                        const SizedBox(height: 6),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.end,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              time,
                                              style: const TextStyle(color: Colors.white24, fontSize: 10),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                    if (isClosed)
                      Container(
                        width: double.infinity,
                        color: Colors.redAccent.withOpacity(0.1),
                        padding: const EdgeInsets.all(12),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.lock_outline, color: Colors.redAccent, size: 18),
                            SizedBox(width: 8),
                            Text(
                              'Этот диалог закрыт оператором',
                              style: TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF11111A),
                        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.04))),
                      ),
                      padding: EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 12,
                        bottom: 12 + MediaQuery.of(context).padding.bottom,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.02),
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(color: Colors.white.withOpacity(0.06)),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              child: TextField(
                                controller: _msgController,
                                enabled: !isClosed,
                                maxLines: null,
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: isClosed ? 'Чат закрыт' : 'Написать оператору...',
                                  hintStyle: const TextStyle(color: Colors.white24),
                                  border: InputBorder.none,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          IconButton(
                            icon: const Icon(Icons.send, color: Color(0xFF00C2FF)),
                            onPressed: isClosed || _sending ? null : _sendMessage,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}
