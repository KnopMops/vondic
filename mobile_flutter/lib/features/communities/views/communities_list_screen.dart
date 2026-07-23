import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../auth/bloc/auth_bloc.dart';

class CommunitiesListScreen extends StatefulWidget {
  const CommunitiesListScreen({super.key});

  @override
  State<CommunitiesListScreen> createState() => _CommunitiesListScreenState();
}

class _CommunitiesListScreenState extends State<CommunitiesListScreen> {
  List<dynamic> _communities = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchCommunities();
  }

  Future<void> _fetchCommunities() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apiClient = context.read<ApiClient>();
      // /my is a POST endpoint on the backend
      final res = await apiClient.post<List<dynamic>>('/social-communities/my', data: {});
      setState(() {
        _communities = res.data ?? [];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Communities] Fetch error: $e');
      setState(() {
        _error = 'Не удалось загрузить список сообществ';
        _loading = false;
      });
    }
  }

  Future<void> _handleJoinCommunity(String inviteCode) async {
    if (inviteCode.trim().isEmpty) return;
    
    // Extract code from link if full link is pasted
    String cleanCode = inviteCode.trim();
    if (cleanCode.contains('/join/')) {
      cleanCode = cleanCode.split('/join/').last;
    } else if (cleanCode.contains('join=')) {
      cleanCode = cleanCode.split('join=').last;
    }

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.post<Map<String, dynamic>>(
        '/social-communities/join',
        data: {'invite_code': cleanCode},
      );
      
      final newId = res.data?['id']?.toString();
      if (newId != null) {
        _fetchCommunities();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Вы успешно вступили в сообщество!'),
              backgroundColor: Colors.green,
            ),
          );
          context.push('/communities/$newId');
        }
      }
    } catch (e) {
      debugPrint('[Communities] Join error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка вступления: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _handleCreateCommunity(String name, String description) async {
    if (name.trim().isEmpty) return;

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.post<Map<String, dynamic>>(
        '/social-communities',
        data: {
          'name': name.trim(),
          'description': description.trim(),
        },
      );

      final newId = res.data?['id']?.toString();
      if (newId != null) {
        _fetchCommunities();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Сообщество создано!'),
              backgroundColor: Colors.green,
            ),
          );
          context.push('/communities/$newId');
        }
      }
    } catch (e) {
      debugPrint('[Communities] Create error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ошибка создания: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  void _showJoinDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF11111A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Вступить в сообщество', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Введите инвайт-код или ссылку-приглашение:',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Например, aBCdeF12',
                hintStyle: const TextStyle(color: Colors.white24),
                filled: true,
                fillColor: Colors.white.withOpacity(0.02),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
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
            child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
            onPressed: () => Navigator.pop(ctx),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7000FF),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Вступить', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () {
              final code = controller.text.trim();
              Navigator.pop(ctx);
              _handleJoinCommunity(code);
            },
          ),
        ],
      ),
    );
  }

  void _showCreateDialog() {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF11111A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Создать сообщество', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Название сообщества',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.02),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF00C2FF)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Описание сообщества',
                  hintStyle: const TextStyle(color: Colors.white24),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.02),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF00C2FF)),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
            onPressed: () => Navigator.pop(ctx),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7000FF),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Создать', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () {
              final name = nameController.text.trim();
              final desc = descController.text.trim();
              Navigator.pop(ctx);
              _handleCreateCommunity(name, desc);
            },
          ),
        ],
      ),
    );
  }

  String? _getAbsoluteAvatarUrl(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http')) return raw;
    final apiClient = context.read<ApiClient>();
    final backendUrl = apiClient.dio.options.baseUrl.replaceAll('/api/v1', '');
    return '$backendUrl$raw';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        title: const Text(
          'Сообщества',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.group_add_outlined, color: Color(0xFF00C2FF)),
            tooltip: 'Вступить по ссылке',
            onPressed: _showJoinDialog,
          ),
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF00C2FF)),
            tooltip: 'Создать сообщество',
            onPressed: _showCreateDialog,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF00C2FF),
        backgroundColor: const Color(0xFF11111A),
        onRefresh: _fetchCommunities,
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
                          onPressed: _fetchCommunities,
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                          child: const Text('Повторить'),
                        ),
                      ],
                    ),
                  )
                : _communities.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.people_outline, size: 64, color: Colors.white24),
                            const SizedBox(height: 16),
                            const Text(
                              'Вы еще не состоите в сообществах',
                              style: TextStyle(color: Colors.white38, fontSize: 15),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                ElevatedButton(
                                  onPressed: _showJoinDialog,
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1C1C1E)),
                                  child: const Text('Вступить'),
                                ),
                                const SizedBox(width: 12),
                                ElevatedButton(
                                  onPressed: _showCreateDialog,
                                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7000FF)),
                                  child: const Text('Создать'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _communities.length,
                        itemBuilder: (context, index) {
                          final c = _communities[index];
                          final name = c['name']?.toString() ?? 'Сообщество';
                          final desc = c['description']?.toString() ?? '';
                          final avatarUrl = _getAbsoluteAvatarUrl(c['avatar_url']?.toString());
                          final membersCount = c['members_count'] as int? ?? 0;

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF11111A),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withOpacity(0.04)),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              leading: CircleAvatar(
                                radius: 24,
                                backgroundColor: const Color(0xFF6C5CE7).withOpacity(0.15),
                                backgroundImage: avatarUrl != null ? NetworkImage(avatarUrl) : null,
                                child: avatarUrl == null
                                    ? Text(
                                        name.substring(0, 1).toUpperCase(),
                                        style: const TextStyle(
                                          color: Color(0xFF00C2FF),
                                          fontWeight: FontWeight.bold,
                                          fontSize: 18,
                                        ),
                                      )
                                    : null,
                              ),
                              title: Text(
                                name,
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                              ),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (desc.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      desc,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.white54, fontSize: 13),
                                    ),
                                  ],
                                  const SizedBox(height: 4),
                                  Text(
                                    '$membersCount подписчиков',
                                    style: const TextStyle(color: Colors.white24, fontSize: 11),
                                  ),
                                ],
                              ),
                              trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white30),
                              onTap: () {
                                final cId = c['id']?.toString() ?? '';
                                if (cId.isNotEmpty) {
                                  context.push('/communities/$cId');
                                }
                              },
                            ),
                          );
                        },
                      ),
      ),
    );
  }
}
