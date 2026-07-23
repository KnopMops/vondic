import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../../../core/utils/url_helper.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../calls/bloc/call_bloc.dart';
import '../../calls/bloc/call_event.dart';

class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  String _activeTab = 'my'; // 'my' or 'requests'
  List<dynamic> _friends = [];
  List<dynamic> _requests = [];
  String _searchQuery = '';
  bool _isLoading = true;
  String? _actionLoadingId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
    });

    final authState = context.read<AuthBloc>().state;
    final myId = authState.user?.id ?? '';
    if (myId.isEmpty) return;

    try {
      final apiClient = context.read<ApiClient>();
      if (_activeTab == 'my') {
        final res = await apiClient.post<List<dynamic>>('/friends/list', data: {'user_id': myId});
        setState(() {
          _friends = res.data ?? [];
        });
      } else {
        final res = await apiClient.post<List<dynamic>>('/friends/requests', data: {'user_id': myId});
        setState(() {
          _requests = res.data ?? [];
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка загрузки данных: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleRemoveFriend(String friendId, String username) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF13131A),
        title: const Text('Удалить друга', style: TextStyle(color: Colors.white)),
        content: Text('Вы уверены, что хотите удалить @$username из друзей?', style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Отмена', style: TextStyle(color: Colors.white30)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Удалить', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() {
      _actionLoadingId = friendId;
    });

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/friends/remove', data: {'friend_id': friendId});
      setState(() {
        _friends.removeWhere((f) => f['id']?.toString() == friendId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Друг успешно удален'), backgroundColor: Color(0xFF6C5CE7)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось удалить друга: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionLoadingId = null;
        });
      }
    }
  }

  Future<void> _handleAcceptRequest(String requesterId) async {
    setState(() {
      _actionLoadingId = requesterId;
    });

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/friends/accept', data: {'requester_id': requesterId});
      setState(() {
        _requests.removeWhere((r) => r['id']?.toString() == requesterId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Заявка в друзья принята'), backgroundColor: Color(0xFF00FF87)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось принять заявку: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionLoadingId = null;
        });
      }
    }
  }

  Future<void> _handleRejectRequest(String requesterId) async {
    setState(() {
      _actionLoadingId = requesterId;
    });

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/friends/reject', data: {'requester_id': requesterId});
      setState(() {
        _requests.removeWhere((r) => r['id']?.toString() == requesterId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Заявка отклонена'), backgroundColor: Colors.white30),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось отклонить заявку: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _actionLoadingId = null;
        });
      }
    }
  }

  void _startCall(String id, String username) {
    context.read<CallBloc>().add(CallStartEvent(
      targetUserId: id,
      targetUserName: username,
    ));
    context.push('/call');
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _friends.where((f) {
      final uname = f['username']?.toString().toLowerCase() ?? '';
      final display = f['display_name']?.toString().toLowerCase() ?? '';
      return uname.contains(_searchQuery.toLowerCase()) || display.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        elevation: 0,
        title: const Text('Друзья', style: TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // 1. Category tab selector
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            color: const Color(0xFF11111A),
            child: Row(
              children: [
                _buildTab('my', 'Мои друзья', Icons.people_outline),
                const SizedBox(width: 12),
                _buildTab('requests', 'Заявки', Icons.mail_outline),
              ],
            ),
          ),

          // 2. Search box
          if (_activeTab == 'my')
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: const Color(0xFF11111A),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.06)),
                ),
                child: TextField(
                  style: const TextStyle(color: Colors.white),
                  decoration: const InputDecoration(
                    hintText: 'Поиск друзей...',
                    hintStyle: TextStyle(color: Colors.white30),
                    prefixIcon: Icon(Icons.search, color: Colors.white38),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                ),
              ),
            ),

          // 3. Main content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
                : _activeTab == 'my'
                    ? _buildFriendsList(filtered)
                    : _buildRequestsList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTab(String tab, String label, IconData icon) {
    final isSelected = _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _activeTab = tab;
          });
          _loadData();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF7000FF).withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? const Color(0xFF7000FF).withOpacity(0.3) : Colors.transparent,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: isSelected ? const Color(0xFF00C2FF) : Colors.white38, size: 18),
              const SizedBox(width: 8),
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

  Widget _buildFriendsList(List<dynamic> list) {
    if (list.isEmpty) {
      return Center(
        child: Text(
          'Список друзей пуст',
          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 16),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final item = list[index];
        final id = item['id']?.toString() ?? '';
        final username = item['username']?.toString() ?? 'User';
        final avatar = item['avatar_url']?.toString();

        final isOnline = item['status']?.toString() == 'online';

        return Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.04)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Stack(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: const Color(0xFF7000FF).withOpacity(0.15),
                  backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar.toAbsoluteUrl) : null,
                  child: avatar == null || avatar.isEmpty
                      ? Text(username.substring(0, 1).toUpperCase(), style: const TextStyle(color: Color(0xFF00C2FF), fontWeight: FontWeight.bold))
                      : null,
                ),
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: isOnline ? const Color(0xFF00FF87) : Colors.grey,
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFF09090E), width: 2),
                    ),
                  ),
                ),
              ],
            ),
            title: Text(username, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            subtitle: Text(
              isOnline ? 'В сети' : 'Не в сети',
              style: TextStyle(
                color: isOnline ? const Color(0xFF00FF87).withOpacity(0.8) : Colors.white30,
                fontSize: 12,
              ),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.phone_outlined, color: Color(0xFF00FF87)),
                  onPressed: () => _startCall(id, username),
                ),
                IconButton(
                  icon: const Icon(Icons.chat_bubble_outline, color: Color(0xFF00C2FF)),
                  onPressed: () {
                    final avUrl = avatar ?? '';
                    context.push(
                      Uri(
                        path: '/chat/dm/$id/$username',
                        queryParameters: avUrl.isNotEmpty ? {'avatarUrl': avUrl} : null,
                      ).toString(),
                    );
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                  onPressed: () => _handleRemoveFriend(id, username),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRequestsList() {
    if (_requests.isEmpty) {
      return Center(
        child: Text(
          'Нет входящих заявок',
          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 16),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _requests.length,
      itemBuilder: (context, index) {
        final item = _requests[index];
        final id = item['id']?.toString() ?? '';
        final username = item['username']?.toString() ?? 'Requester';
        final avatar = item['avatar_url']?.toString();

        return Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.04)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: CircleAvatar(
              radius: 22,
              backgroundColor: const Color(0xFF7000FF).withOpacity(0.15),
              backgroundImage: avatar != null && avatar.isNotEmpty ? NetworkImage(avatar.toAbsoluteUrl) : null,
              child: avatar == null || avatar.isEmpty
                  ? Text(username.substring(0, 1).toUpperCase(), style: const TextStyle(color: Color(0xFF00C2FF), fontWeight: FontWeight.bold))
                  : null,
            ),
            title: Text(username, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            subtitle: const Text('Хочет добавиться в друзья', style: TextStyle(color: Colors.white38, fontSize: 12)),
            trailing: _actionLoadingId == id
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.check_circle_outline, color: Color(0xFF00FF87)),
                        onPressed: () => _handleAcceptRequest(id),
                      ),
                      IconButton(
                        icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent),
                        onPressed: () => _handleRejectRequest(id),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }
}
