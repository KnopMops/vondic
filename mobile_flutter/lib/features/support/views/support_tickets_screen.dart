import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';
import 'support_init_dialog.dart';

class SupportTicketsScreen extends StatefulWidget {
  const SupportTicketsScreen({super.key});

  @override
  State<SupportTicketsScreen> createState() => _SupportTicketsScreenState();
}

class _SupportTicketsScreenState extends State<SupportTicketsScreen> {
  List<dynamic> _tickets = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchTickets();
  }

  Future<void> _fetchTickets() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.get<Map<String, dynamic>>('/support/messenger/chats');
      final list = res.data?['chats'] as List? ?? [];
      setState(() {
        _tickets = list;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[SupportTickets] Fetch error: $e');
      setState(() {
        _error = 'Не удалось загрузить список обращений';
        _loading = false;
      });
    }
  }

  Future<void> _deleteTicket(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF11111A),
        title: const Text('Удалить обращение?', style: TextStyle(color: Colors.white)),
        content: Text('Вы действительно хотите удалить закрытое обращение #$id?', style: const TextStyle(color: Colors.white70)),
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
      await apiClient.post('/support/chats/$id/delete');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Обращение удалено'), backgroundColor: Color(0xFF00FF87)),
        );
        _fetchTickets();
      }
    } catch (e) {
      debugPrint('[SupportTickets] Delete error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось удалить: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  void _openCreateTicketDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const SupportInitDialog(),
    ).then((_) {
      _fetchTickets();
    });
  }

  String _formatTime(String raw) {
    if (raw.isEmpty) return '';
    try {
      final parsed = DateTime.parse(raw);
      final now = DateTime.now();
      final diff = now.difference(parsed);
      if (diff.inMinutes < 60) {
        return '${diff.inMinutes} мин. назад';
      } else if (diff.inHours < 24) {
        return '${diff.inHours} ч. назад';
      }
      return DateFormat('dd.MM HH:mm').format(parsed);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        title: const Text(
          'Служба поддержки',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_comment_outlined, color: Color(0xFF00C2FF)),
            tooltip: 'Новое обращение',
            onPressed: _openCreateTicketDialog,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF00C2FF),
        backgroundColor: const Color(0xFF11111A),
        onRefresh: _fetchTickets,
        child: _loading
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
                          onPressed: _fetchTickets,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                          child: const Text('Повторить'),
                        ),
                      ],
                    ),
                  )
                : _tickets.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.headset_mic_outlined, size: 64, color: Colors.white.withOpacity(0.2)),
                            const SizedBox(height: 16),
                            const Text(
                              'У вас пока нет обращений в поддержку',
                              style: TextStyle(color: Colors.white38, fontSize: 15),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF7000FF),
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              icon: const Icon(Icons.add, color: Colors.white),
                              label: const Text(
                                'Создать обращение',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                              ),
                              onPressed: _openCreateTicketDialog,
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _tickets.length,
                        itemBuilder: (context, index) {
                          final ticket = _tickets[index];
                          final id = ticket['id']?.toString() ?? '';
                          final question = ticket['question']?.toString() ?? 'Обращение';
                          final status = (ticket['status']?.toString() ?? 'open').toLowerCase();
                          final isClosed = status == 'closed';
                          final lastMsg = ticket['last_message']?.toString() ?? question;
                          final timeStr = _formatTime(ticket['last_message_at']?.toString() ?? ticket['created_at']?.toString() ?? '');
                          final unreadCount = ticket['unread_count'] as int? ?? 0;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF11111A),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: unreadCount > 0 ? const Color(0xFF00C2FF).withOpacity(0.3) : Colors.white.withOpacity(0.04),
                              ),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              leading: CircleAvatar(
                                radius: 24,
                                backgroundColor: isClosed
                                    ? Colors.white.withOpacity(0.05)
                                    : const Color(0xFF7000FF).withOpacity(0.15),
                                child: Icon(
                                  isClosed ? Icons.lock_outline : Icons.support_agent_rounded,
                                  color: isClosed ? Colors.white38 : const Color(0xFF00C2FF),
                                  size: 24,
                                ),
                              ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Обращение #$id',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isClosed
                                          ? Colors.white.withOpacity(0.08)
                                          : const Color(0xFF00FF87).withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      isClosed ? 'Закрыто' : 'В работе',
                                      style: TextStyle(
                                        color: isClosed ? Colors.white38 : const Color(0xFF00FF87),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const SizedBox(height: 4),
                                  Text(
                                    question,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    lastMsg,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: Colors.white38, fontSize: 12),
                                  ),
                                ],
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        timeStr,
                                        style: const TextStyle(color: Colors.white24, fontSize: 11),
                                      ),
                                      if (unreadCount > 0) ...[
                                        const SizedBox(height: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF7000FF),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            '$unreadCount',
                                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  if (isClosed) ...[
                                    const SizedBox(width: 4),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                      tooltip: 'Удалить обращение',
                                      onPressed: () => _deleteTicket(id),
                                    ),
                                  ],
                                ],
                              ),
                              onTap: () {
                                context.push('/support/ticket/$id');
                              },
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
