import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';
import '../../auth/models/user.dart';
import '../bloc/inbox_bloc.dart';
import '../bloc/inbox_event.dart';
import '../bloc/inbox_state.dart';
import '../../../core/utils/storage_service.dart';
import '../../../core/utils/url_helper.dart';
import '../../../core/network/api_client.dart';
import '../../../core/socket/socket_service.dart';
import '../../calls/bloc/call_bloc.dart';
import '../../calls/bloc/call_event.dart';
import '../../feed/views/feed_screen.dart';
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  String _activeFilter = 'direct'; // 'direct', 'group', 'channel'

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthBloc>().state.user;
    if (user != null) {
      final socketService = context.read<SocketService>();
      socketService.connect();
      socketService.on('receive_message', _onReceiveMessageGlobal);
      context.read<CallBloc>().add(CallInitializeEvent(
        userId: user.id,
        userName: user.displayName ?? user.username,
        avatarUrl: user.avatarUrl,
      ));
    }
  }

  @override
  void dispose() {
    try {
      context.read<SocketService>().off('receive_message', _onReceiveMessageGlobal);
    } catch (_) {}
    super.dispose();
  }

  void _onReceiveMessageGlobal(dynamic data) {
    if (data == null) return;
    final senderId = data['sender_id']?.toString() ?? '';
    final senderName = data['sender_name']?.toString() ?? data['username']?.toString() ?? 'Новое сообщение';
    final content = data['content']?.toString() ?? '';

    if (!mounted) return;

    final myUserStr = context.read<StorageService>().readString('user');
    String myId = '';
    if (myUserStr != null) {
      myId = jsonDecode(myUserStr)['id']?.toString() ?? '';
    }

    if (senderId.isNotEmpty && myId.isNotEmpty && senderId != myId) {
      final state = GoRouterState.of(context);
      final currentUri = state.uri.toString();
      
      if (currentUri.contains('/chat/') && currentUri.contains(senderId)) {
        return;
      }
      
      final displayText = content.startsWith('e2e:') ? 'Зашифрованное сообщение' : content;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF11111A),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          content: InkWell(
            onTap: () {
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
              context.push('/chat/dm/$senderId/$senderName');
            },
            child: Row(
              children: [
                const Icon(Icons.message_outlined, color: Color(0xFF00C2FF)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(senderName, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(
                        displayText, 
                        style: const TextStyle(color: Colors.white70, fontSize: 13), 
                        maxLines: 1, 
                        overflow: TextOverflow.ellipsis
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState.user;

    final List<Widget> tabs = [
      _buildMessagesTab(),
      _buildFeedTab(),
      _buildCallsTab(),
      _buildProfileTab(user),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        elevation: 0,
        title: Text(
          _getTabTitle(),
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
            color: Colors.white,
          ),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(Icons.qr_code_scanner, color: Color(0xFF00C2FF)),
              onPressed: () {
                context.push('/qr-scan');
              },
            ),
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF0C0C12),
        child: Column(
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF7000FF), Color(0xFF00C2FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              currentAccountPicture: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white24, width: 2),
                ),
                child: CircleAvatar(
                  backgroundColor: Colors.black26,
                  backgroundImage: user?.fullAvatarUrl != null ? NetworkImage(user!.fullAvatarUrl!) : null,
                  child: user?.fullAvatarUrl == null
                      ? Text(
                          (user?.username ?? 'U').substring(0, 1).toUpperCase(),
                          style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
              ),
              accountName: Text(
                user?.displayName ?? user?.username ?? 'Пользователь Vondic',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              accountEmail: Text(
                user?.email ?? '@${user?.username ?? "username"}',
                style: const TextStyle(color: Colors.white70),
              ),
            ),
            _buildDrawerTile(Icons.people_outline, 'Друзья', () {
              Navigator.pop(context);
              context.push('/friends');
            }),
            _buildDrawerTile(Icons.forum_outlined, 'Сообщества', () {
              Navigator.pop(context);
              context.push('/communities');
            }),
            _buildDrawerTile(Icons.mail_outline, 'Почта', () {
              Navigator.pop(context);
              context.push('/mail');
            }),
            _buildDrawerTile(Icons.settings_outlined, 'Настройки', () {
              Navigator.pop(context);
              context.push('/settings');
            }),
            _buildDrawerTile(Icons.support_agent_outlined, 'Поддержка', () {
              Navigator.pop(context);
              context.push('/support');
            }),
            const Spacer(),
            const Divider(color: Colors.white10, height: 1),
            ListTile(
              leading: const Icon(Icons.logout_rounded, color: Colors.redAccent),
              title: const Text('Выйти', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(context);
                context.read<AuthBloc>().add(AuthLogoutEvent());
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
      body: tabs[_currentIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) {
            setState(() {
              _currentIndex = index;
            });
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: const Color(0xFF11111A),
          selectedItemColor: const Color(0xFF00C2FF),
          unselectedItemColor: Colors.white38,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          unselectedLabelStyle: const TextStyle(fontSize: 12),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline),
              activeIcon: Icon(Icons.chat_bubble, color: Color(0xFF00C2FF)),
              label: 'Сообщения',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.newspaper_outlined),
              activeIcon: Icon(Icons.newspaper, color: Color(0xFF00C2FF)),
              label: 'Лента',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.call_outlined),
              activeIcon: Icon(Icons.call, color: Color(0xFF00C2FF)),
              label: 'Звонки',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline),
              activeIcon: Icon(Icons.person, color: Color(0xFF00C2FF)),
              label: 'Профиль',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerTile(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: Colors.white60),
      title: Text(title, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w500)),
      onTap: onTap,
    );
  }

  String _getTabTitle() {
    switch (_currentIndex) {
      case 0:
        return 'Вондик';
      case 1:
        return 'Лента новостей';
      case 2:
        return 'Звонки';
      case 3:
        return 'Мой Профиль';
      default:
        return 'Вондик';
    }
  }

  Widget _buildMessagesTab() {
    return Column(
      children: [
        // 1. Sliding category selector
        Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          color: const Color(0xFF11111A),
          child: Row(
            children: [
              _buildFilterTab('direct', 'Личные', Icons.person_outline),
              const SizedBox(width: 8),
              _buildFilterTab('group', 'Группы', Icons.group_outlined),
              const SizedBox(width: 8),
              _buildFilterTab('channel', 'Каналы', Icons.campaign_outlined),
            ],
          ),
        ),

        // 2. Main inbox list binded to InboxBloc
        Expanded(
          child: BlocBuilder<InboxBloc, InboxState>(
            builder: (context, state) {
              if (state is InboxLoadingState) {
                return const Center(
                  child: CircularProgressIndicator(color: Color(0xFF00C2FF)),
                );
              }

              if (state is InboxErrorState) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline, color: Colors.redAccent, size: 48),
                      const SizedBox(height: 16),
                      Text(state.message, style: const TextStyle(color: Colors.white70)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => context.read<InboxBloc>().add(InboxLoadEvent()),
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                        child: const Text('Повторить'),
                      ),
                    ],
                  ),
                );
              }

              if (state is InboxLoadedState) {
                final filtered = state.chats.where((chat) {
                  if (_activeFilter == 'direct') return chat.type == 'dm';
                  if (_activeFilter == 'group') return chat.type == 'group';
                  if (_activeFilter == 'channel') return chat.type == 'channel';
                  return false;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _activeFilter == 'direct'
                              ? Icons.person_off_outlined
                              : _activeFilter == 'group'
                                  ? Icons.group_off_outlined
                                  : Icons.speaker_notes_off_outlined,
                          size: 64,
                          color: Colors.white24,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Нет активных диалогов',
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 16),
                        ),
                      ],
                    ),
                  );
                }

                return RefreshIndicator(
                  color: const Color(0xFF00C2FF),
                  backgroundColor: const Color(0xFF131320),
                  onRefresh: () async {
                    context.read<InboxBloc>().add(InboxLoadEvent());
                  },
                  child: ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final chat = filtered[index];
                      final isLastE2e = chat.lastMessage.startsWith('e2e:');
                      final isRead = chat.unreadCount == 0;

                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: chat.isPinned ? const Color(0xFF7000FF).withOpacity(0.08) : Colors.white.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: chat.isPinned ? const Color(0xFF00C2FF).withOpacity(0.25) : Colors.white.withOpacity(0.04),
                            width: 1,
                          ),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          leading: Stack(
                            children: [
                              CircleAvatar(
                                radius: 26,
                                backgroundColor: const Color(0xFF7000FF).withOpacity(0.15),
                                backgroundImage: chat.avatarUrl != null && chat.avatarUrl!.isNotEmpty
                                    ? NetworkImage(chat.avatarUrl!.toAbsoluteUrl)
                                    : null,
                                child: chat.avatarUrl == null || chat.avatarUrl!.isEmpty
                                    ? Text(
                                        chat.name.isNotEmpty ? chat.name.substring(0, 1).toUpperCase() : '?',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF00C2FF),
                                          fontSize: 20,
                                        ),
                                      )
                                    : null,
                              ),
                              if (chat.type == 'dm' && chat.isOnline)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 12,
                                    height: 12,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF00FF87),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: const Color(0xFF09090E), width: 2),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          title: Row(
                            children: [
                              if (chat.isPinned) ...[
                                const Icon(Icons.push_pin_rounded, color: Color(0xFF00C2FF), size: 14),
                                const SizedBox(width: 6),
                              ],
                              Expanded(
                                child: Text(
                                  chat.name,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              if (chat.timestamp.isNotEmpty)
                                Text(
                                  _formatTimestamp(chat.timestamp),
                                  style: TextStyle(
                                    color: chat.isPinned ? const Color(0xFF00C2FF).withOpacity(0.8) : Colors.white30,
                                    fontSize: 12,
                                    fontWeight: chat.isPinned ? FontWeight.w600 : FontWeight.normal,
                                  ),
                                ),
                            ],
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Row(
                              children: [
                                if (isLastE2e)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 4.0),
                                    child: Icon(Icons.security, color: Color(0xFF00C2FF), size: 14),
                                  ),
                                Expanded(
                                  child: Text(
                                    isLastE2e ? 'Зашифрованное сообщение' : chat.lastMessage,
                                    style: TextStyle(
                                      color: isRead ? Colors.white38 : Colors.white70,
                                      fontSize: 14,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (chat.unreadCount > 0)
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF7000FF),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Text(
                                      '${chat.unreadCount}',
                                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          onTap: () {
                            final avUrl = chat.avatarUrl ?? '';
                            context.push(
                              Uri(
                                path: '/chat/${chat.type}/${chat.id}/${chat.name}',
                                queryParameters: avUrl.isNotEmpty ? {'avatarUrl': avUrl} : null,
                              ).toString(),
                            );
                          },
                          onLongPress: () {
                            _showChatOptionsMenu(context, chat, state.chats);
                          },
                        ),
                      );
                    },
                  ),
                );
              }

              return const SizedBox();
            },
          ),
        ),
      ],
    );
  }

  void _showChatOptionsMenu(BuildContext context, ChatPreview chat, List<ChatPreview> allChats) {
    final pinnedChats = allChats.where((c) => c.isPinned).toList();
    final isPinned = chat.isPinned;

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF11111A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header with chat info
                ListTile(
                  leading: CircleAvatar(
                    radius: 22,
                    backgroundColor: const Color(0xFF7000FF).withOpacity(0.15),
                    backgroundImage: chat.avatarUrl != null && chat.avatarUrl!.isNotEmpty
                        ? NetworkImage(chat.avatarUrl!.toAbsoluteUrl)
                        : null,
                    child: chat.avatarUrl == null || chat.avatarUrl!.isEmpty
                        ? Text(
                            chat.name.isNotEmpty ? chat.name.substring(0, 1).toUpperCase() : '?',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF00C2FF)),
                          )
                        : null,
                  ),
                  title: Text(
                    chat.name,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  subtitle: Text(
                    isPinned ? 'Закрепленный чат #${chat.pinIndex + 1}' : 'Обычный чат',
                    style: TextStyle(color: isPinned ? const Color(0xFF00C2FF) : Colors.white38, fontSize: 12),
                  ),
                ),
                const Divider(color: Colors.white12),

                // Pin / Unpin option
                ListTile(
                  leading: Icon(
                    isPinned ? Icons.push_pin_outlined : Icons.push_pin_rounded,
                    color: const Color(0xFF00C2FF),
                  ),
                  title: Text(
                    isPinned ? 'Открепить чат' : 'Закрепить чат',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    context.read<InboxBloc>().add(InboxTogglePinChatEvent(chat.id));
                  },
                ),

                // Move Up
                if (isPinned && chat.pinIndex > 0)
                  ListTile(
                    leading: const Icon(Icons.arrow_upward_rounded, color: Colors.white70),
                    title: const Text('Переместить выше', style: TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.pop(ctx);
                      context.read<InboxBloc>().add(InboxMovePinnedChatEvent(chat.id, moveUp: true));
                    },
                  ),

                // Move Down
                if (isPinned && chat.pinIndex < pinnedChats.length - 1)
                  ListTile(
                    leading: const Icon(Icons.arrow_downward_rounded, color: Colors.white70),
                    title: const Text('Переместить ниже', style: TextStyle(color: Colors.white)),
                    onTap: () {
                      Navigator.pop(ctx);
                      context.read<InboxBloc>().add(InboxMovePinnedChatEvent(chat.id, moveUp: false));
                    },
                  ),

                // Reorder All Pinned Chats
                if (pinnedChats.length > 1)
                  ListTile(
                    leading: const Icon(Icons.swap_vert_rounded, color: Color(0xFF7000FF)),
                    title: const Text('Порядок закрепов', style: TextStyle(color: Colors.white)),
                    subtitle: const Text('Перетащите чаты для изменения порядка', style: TextStyle(color: Colors.white38, fontSize: 11)),
                    onTap: () {
                      Navigator.pop(ctx);
                      _showReorderPinnedChatsModal(context, pinnedChats);
                    },
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showReorderPinnedChatsModal(BuildContext context, List<ChatPreview> initialPinnedChats) {
    final List<ChatPreview> items = List.from(initialPinnedChats);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF11111A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.55,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Порядок закрепленных чатов',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Зажмите и перемещайте вверх или вниз',
                            style: TextStyle(color: Colors.white38, fontSize: 12),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.check_circle, color: Color(0xFF00FF87), size: 28),
                        onPressed: () {
                          final newPinnedIds = items.map((c) => c.id).toList();
                          context.read<InboxBloc>().add(InboxSetPinnedChatsEvent(newPinnedIds));
                          Navigator.pop(ctx);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ReorderableListView.builder(
                      itemCount: items.length,
                      onReorder: (oldIndex, newIndex) {
                        setModalState(() {
                          if (newIndex > oldIndex) newIndex -= 1;
                          final item = items.removeAt(oldIndex);
                          items.insert(newIndex, item);
                        });
                      },
                      itemBuilder: (context, index) {
                        final chat = items[index];
                        return Container(
                          key: ValueKey(chat.id),
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.04),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFF00C2FF).withOpacity(0.15)),
                          ),
                          child: ListTile(
                            leading: CircleAvatar(
                              radius: 18,
                              backgroundColor: const Color(0xFF7000FF).withOpacity(0.2),
                              child: Text(
                                '${index + 1}',
                                style: const TextStyle(color: Color(0xFF00C2FF), fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ),
                            title: Text(chat.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                            trailing: const Icon(Icons.drag_handle_rounded, color: Colors.white54, size: 24),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFilterTab(String filter, String label, IconData icon) {
    final isSelected = _activeFilter == filter;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _activeFilter = filter;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF7000FF).withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? const Color(0xFF7000FF).withOpacity(0.3) : Colors.transparent,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: isSelected ? const Color(0xFF00C2FF) : Colors.white38, size: 18),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.white38,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTimestamp(String timestamp) {
    if (timestamp.isEmpty) return '';
    try {
      final parsed = DateTime.parse(timestamp);
      final now = DateTime.now();
      if (parsed.year == now.year && parsed.month == now.month && parsed.day == now.day) {
        return DateFormat('HH:mm').format(parsed);
      }
      return DateFormat('dd.MM').format(parsed);
    } catch (_) {
      return '';
    }
  }

  Widget _buildFeedTab() {
    return const FeedScreen();
  }

  Widget _buildCallsTab() {
    final storageService = context.read<StorageService>();
    final historyStr = storageService.readString('call_history') ?? '[]';
    List<dynamic> history = [];
    try {
      history = json.decode(historyStr);
    } catch (_) {}

    if (history.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.02),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.phone_missed_rounded, size: 64, color: Colors.white24),
            ),
            const SizedBox(height: 16),
            const Text(
              'История звонков пуста',
              style: TextStyle(color: Colors.white38, fontSize: 16, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF00C2FF),
      backgroundColor: const Color(0xFF131320),
      onRefresh: () async {
        setState(() {});
      },
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: history.length,
        itemBuilder: (context, index) {
          final item = history[index];
          final callerName = item['callerName'] ?? 'Пользователь';
          final receiverName = item['receiverName'] ?? 'Пользователь';
          final type = item['type'] ?? 'incoming';
          final status = item['status'] ?? 'completed';
          final startTime = item['startTime'] ?? '';
          final duration = item['duration'] ?? 0;

          final isOutgoing = type == 'outgoing';
          final isCompleted = status == 'completed';

          String timeStr = '';
          try {
            final date = DateTime.parse(startTime);
            timeStr = DateFormat('dd.MM.yyyy HH:mm').format(date);
          } catch (_) {}

          return Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.04)),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isOutgoing
                      ? Icons.call_made_rounded
                      : isCompleted
                          ? Icons.call_received_rounded
                          : Icons.call_missed_rounded,
                  color: isCompleted
                      ? const Color(0xFF00FF87)
                      : Colors.redAccent,
                  size: 20,
                ),
              ),
              title: Text(
                isOutgoing ? receiverName : callerName,
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
              ),
              subtitle: Text(
                '${isOutgoing ? "Исходящий" : isCompleted ? "Входящий" : "Пропущенный"} · $timeStr',
                style: const TextStyle(color: Colors.white30, fontSize: 12),
              ),
              trailing: Text(
                '${duration ~/ 60}:${(duration % 60).toString().padLeft(2, '0')}',
                style: const TextStyle(color: Colors.white60, fontSize: 13),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProfileTab(dynamic user) {
    if (user == null) {
      return const Center(child: Text('Загрузка профиля...', style: TextStyle(color: Colors.white60)));
    }

    final hasPremium = user.premium == true;
    final balance = user.balance ?? 0.0;
    
    // Cloud storage conversion
    final double usageMb = (user.diskUsage ?? 0.0) / (1024 * 1024);
    final double limitMb = (user.diskLimit ?? 1024.0 * 1024.0 * 1024.0) / (1024 * 1024);

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Center(
          child: Column(
            children: [
              Stack(
                alignment: Alignment.bottomRight,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: hasPremium ? const Color(0xFFFFD700) : const Color(0xFF00C2FF).withOpacity(0.3),
                        width: 3,
                      ),
                    ),
                    child: CircleAvatar(
                      radius: 54,
                      backgroundColor: const Color(0xFF7000FF).withOpacity(0.2),
                      backgroundImage: user.fullAvatarUrl != null ? NetworkImage(user.fullAvatarUrl!) : null,
                      child: user.fullAvatarUrl == null
                          ? Text(
                              (user.displayName ?? user.username ?? 'U').substring(0, 1).toUpperCase(),
                              style: const TextStyle(fontSize: 40, color: Colors.white, fontWeight: FontWeight.bold),
                            )
                          : null,
                    ),
                  ),
                  if (hasPremium)
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFD700),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.star, color: Colors.black, size: 16),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    user.displayName ?? user.username ?? 'Вондик Пользователь',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  if (hasPremium) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFD700).withOpacity(0.15),
                        border: Border.all(color: const Color(0xFFFFD700), width: 1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'PREMIUM',
                        style: TextStyle(color: Color(0xFFFFD700), fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '@${user.username ?? "username"}',
                style: const TextStyle(color: Color(0xFF00C2FF), fontSize: 16, fontWeight: FontWeight.w500),
              ),
              if (user.description != null && user.description!.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  user.description!,
                  style: const TextStyle(color: Colors.white54, fontSize: 14),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 32),

        // User stats dashboard card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.04)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Column(
                children: [
                  const Text('Баланс', style: TextStyle(color: Colors.white38, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text('$balance ₽', style: const TextStyle(color: Color(0xFF00FF87), fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
              Container(width: 1, height: 30, color: Colors.white10),
              Column(
                children: [
                  const Text('Облако', style: TextStyle(color: Colors.white38, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    '${usageMb.toStringAsFixed(0)} / ${limitMb.toStringAsFixed(0)} МБ',
                    style: const TextStyle(color: Color(0xFF00C2FF), fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        _buildProfileTile(Icons.edit_outlined, 'Редактировать профиль', () {
          _showEditProfileDialog(user);
        }),
        _buildProfileTile(Icons.shield_outlined, 'Конфиденциальность', () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Настройки конфиденциальности настроены автоматически.')),
          );
        }),
        _buildProfileTile(Icons.logout_rounded, 'Выйти из аккаунта', () {
          context.read<AuthBloc>().add(AuthLogoutEvent());
        }, color: Colors.redAccent),
      ],
    );
  }

  void _showEditProfileDialog(dynamic user) {
    final usernameController = TextEditingController(text: user.displayName ?? user.username ?? '');
    final bioController = TextEditingController(text: user.description ?? '');
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          backgroundColor: const Color(0xFF11111A),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Редактировать профиль', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: usernameController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Имя',
                  labelStyle: const TextStyle(color: Colors.white38),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF00C2FF)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: bioController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'О себе',
                  labelStyle: const TextStyle(color: Colors.white38),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF00C2FF)),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
            ),
            isSaving
                ? const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
                    ),
                  )
                : TextButton(
                    onPressed: () async {
                      setModalState(() {
                        isSaving = true;
                      });
                      try {
                        final apiClient = context.read<ApiClient>();
                        final storageService = context.read<StorageService>();
                        final response = await apiClient.put<Map<String, dynamic>>('/users', data: {
                          'user_id': user.id,
                          'username': usernameController.text.trim(),
                          'description': bioController.text.trim(),
                        });
                        
                        if (mounted) {
                          if (response.data != null) {
                            final updatedUser = User.fromJson(response.data!);
                            await storageService.writeString('user', jsonEncode(updatedUser.toJson()));
                            context.read<AuthBloc>().add(AuthSetUserEvent(updatedUser));
                          }
                          context.read<AuthBloc>().add(AuthFetchUserEvent());
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Профиль успешно обновлен!'), backgroundColor: Color(0xFF00FF87)),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Ошибка обновления: $e'), backgroundColor: Colors.redAccent),
                          );
                        }
                      }
                    },
                    child: const Text('Сохранить', style: TextStyle(color: Color(0xFF00C2FF), fontWeight: FontWeight.bold)),
                  ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileTile(IconData icon, String title, VoidCallback onTap, {Color? color}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.04), width: 1),
      ),
      child: ListTile(
        leading: Icon(icon, color: color ?? const Color(0xFF00C2FF)),
        title: Text(title, style: TextStyle(color: color != null ? color.withOpacity(0.8) : Colors.white70, fontWeight: FontWeight.w500)),
        trailing: Icon(Icons.chevron_right, color: color != null ? color.withOpacity(0.3) : Colors.white24),
        onTap: onTap,
      ),
    );
  }
}
