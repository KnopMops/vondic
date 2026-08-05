import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/url_helper.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.get<dynamic>('/notifications');
      
      List<dynamic> list = [];
      if (res.data is List) {
        list = res.data as List;
      } else if (res.data is Map && res.data['notifications'] is List) {
        list = res.data['notifications'] as List;
      }

      final unread = list.where((n) => n['read'] == false || n['is_read'] == false).length;

      setState(() {
        _notifications = list;
        _unreadCount = unread;
      });
    } catch (e) {
      // Fallback empty list
      setState(() {
        _notifications = [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _markAllRead() async {
    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/notifications/read-all');
      setState(() {
        _notifications = _notifications.map((n) {
          final copy = Map<String, dynamic>.from(n as Map);
          copy['read'] = true;
          copy['is_read'] = true;
          return copy;
        }).toList();
        _unreadCount = 0;
      });
    } catch (_) {}
  }

  IconData _getIconForType(String? type) {
    switch (type) {
      case 'friend_request':
        return Icons.person_add_rounded;
      case 'like':
        return Icons.favorite_rounded;
      case 'comment':
        return Icons.chat_bubble_rounded;
      case 'call':
        return Icons.phone_in_talk_rounded;
      case 'support':
        return Icons.headset_mic_rounded;
      default:
        return Icons.notifications_active_rounded;
    }
  }

  Color _getColorForType(String? type) {
    switch (type) {
      case 'friend_request':
        return const Color(0xFF00C2FF);
      case 'like':
        return const Color(0xFFFF2D55);
      case 'comment':
        return const Color(0xFF00FF87);
      case 'call':
        return const Color(0xFF9D4EDD);
      case 'support':
        return const Color(0xFFFFB800);
      default:
        return const Color(0xFF6C5CE7);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F1524),
        elevation: 0,
        title: Row(
          children: [
            const Text(
              'Уведомления',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            if (_unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF6C5CE7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_unreadCount',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (_notifications.isNotEmpty)
            TextButton.icon(
              onPressed: _markAllRead,
              icon: const Icon(Icons.done_all_rounded, size: 16, color: Color(0xFF00C2FF)),
              label: const Text(
                'Прочитать все',
                style: TextStyle(color: Color(0xFF00C2FF), fontSize: 12),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF6C5CE7)))
          : RefreshIndicator(
              color: const Color(0xFF6C5CE7),
              onRefresh: _fetchNotifications,
              child: _notifications.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_off_outlined,
                            size: 64,
                            color: Colors.white.withValues(alpha: 0.2),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Уведомлений пока нет',
                            style: TextStyle(color: Colors.white70, fontSize: 16, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Здесь будут появляться новые события и сообщения',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 13),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                        final item = _notifications[index] as Map<String, dynamic>;
                        final title = item['title']?.toString() ?? 'Уведомление';
                        final message = item['message']?.toString() ?? item['body']?.toString() ?? '';
                        final type = item['type']?.toString();
                        final isRead = item['read'] == true || item['is_read'] == true;
                        final createdAt = item['created_at']?.toString() ?? item['createdAt']?.toString();

                        final icon = _getIconForType(type);
                        final color = _getColorForType(type);

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: isRead ? const Color(0xFF0F1524) : color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isRead ? Colors.white.withValues(alpha: 0.05) : color.withValues(alpha: 0.3),
                            ),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.15),
                                shape: BoxShape.circle,
                                border: Border.all(color: color.withValues(alpha: 0.3)),
                              ),
                              child: Icon(icon, color: color, size: 20),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    title,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: isRead ? FontWeight.w600 : FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                                if (createdAt != null)
                                  Text(
                                    _formatTime(createdAt),
                                    style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 11),
                                  ),
                              ],
                            ),
                            subtitle: message.isNotEmpty
                                ? Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      message,
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.7),
                                        fontSize: 13,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                        );
                      },
                    ),
            ),
    );
  }

  String _formatTime(String raw) {
    try {
      final dt = DateTime.parse(raw);
      final now = DateTime.now();
      if (dt.day == now.day && dt.month == now.month && dt.year == now.year) {
        return DateFormat('HH:mm').format(dt);
      }
      return DateFormat('dd.MM HH:mm').format(dt);
    } catch (_) {
      return '';
    }
  }
}
