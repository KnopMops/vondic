import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';
import '../../auth/bloc/auth_bloc.dart';

class CommunityDetailScreen extends StatefulWidget {
  final String id;
  const CommunityDetailScreen({super.key, required this.id});

  @override
  State<CommunityDetailScreen> createState() => _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends State<CommunityDetailScreen> {
  final TextEditingController _postController = TextEditingController();
  dynamic _community;
  List<dynamic> _posts = [];
  bool _loading = true;
  String? _error;
  File? _selectedImage;

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  @override
  void dispose() {
    _postController.dispose();
    super.dispose();
  }

  Future<void> _loadAllData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await Future.wait([
        _fetchCommunityDetails(),
        _fetchCommunityPosts(),
      ]);
      setState(() {
        _loading = false;
      });
    } catch (e) {
      debugPrint('[CommunityDetail] Load error: $e');
      setState(() {
        _error = 'Не удалось загрузить данные сообщества';
        _loading = false;
      });
    }
  }

  Future<void> _fetchCommunityDetails() async {
    final apiClient = context.read<ApiClient>();
    // Backend API uses POST to fetch community info
    final res = await apiClient.post<Map<String, dynamic>>('/social-communities/${widget.id}', data: {});
    _community = res.data;
  }

  Future<void> _fetchCommunityPosts() async {
    final apiClient = context.read<ApiClient>();
    // /posts GET endpoint via publicDio
    final res = await apiClient.publicDio.get<Map<String, dynamic>>(
      '/posts?social_community_id=${widget.id}&per_page=30',
    );
    _posts = res.data?['items'] as List? ?? [];
  }

  Future<void> _handleCreatePost() async {
    final text = _postController.text.trim();
    if (text.isEmpty && _selectedImage == null) return;

    try {
      final apiClient = context.read<ApiClient>();
      String? base64Data;
      String? filename;
      
      if (_selectedImage != null) {
        final bytes = await _selectedImage!.readAsBytes();
        base64Data = base64.encode(bytes);
        filename = _selectedImage!.path.split(Platform.isWindows ? '\\' : '/').last;
      }

      await apiClient.post('/posts', data: {
        'content': text,
        'image': base64Data,
        'image_filename': filename,
        'social_community_id': widget.id,
      });

      setState(() {
        _postController.clear();
        _selectedImage = null;
      });
      
      _fetchCommunityPosts().then((_) {
        setState(() {});
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Запись опубликована!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      debugPrint('[CommunityDetail] Create post error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось создать запись: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _handleToggleLike(String postId, bool isLiked) async {
    // Optimistic UI updates
    setState(() {
      _posts = _posts.map((p) {
        if (p['id'] == postId) {
          final currentLikes = p['likes'] as int? ?? 0;
          return {
            ...p,
            'is_liked': !isLiked,
            'likes': isLiked ? (currentLikes - 1).clamp(0, 999999) : (currentLikes + 1),
          };
        }
        return p;
      }).toList();
    });

    try {
      final apiClient = context.read<ApiClient>();
      final endpoint = isLiked ? '/posts/unlike' : '/posts/like';
      await apiClient.post(endpoint, data: {'post_id': postId});
    } catch (e) {
      debugPrint('[CommunityDetail] Like action failed: $e');
      _fetchCommunityPosts().then((_) {
        setState(() {});
      });
    }
  }

  Future<void> _handleDeletePost(String postId) async {
    final user = context.read<AuthBloc>().state.user;
    if (user == null) return;

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.delete('/posts', data: {
        'post_id': postId,
        'user_id': user.id,
      });
      setState(() {
        _posts.removeWhere((p) => p['id'] == postId);
      });
    } catch (e) {
      debugPrint('[CommunityDetail] Delete post error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка удаления: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  void _showCommentsBottomSheet(String postId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF11111A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _CommentsWidget(postId: postId),
    );
  }

  String? _getAbsoluteUrl(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http')) return raw;
    final apiClient = context.read<ApiClient>();
    final backendUrl = apiClient.dio.options.baseUrl.replaceAll('/api/v1', '');
    return '$backendUrl$raw';
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
    final authState = context.watch<AuthBloc>().state;
    final user = authState.user;
    final isMeAdmin = _community != null && user != null && _community['owner_id']?.toString() == user.id;

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        title: Text(_community?['name']?.toString() ?? 'Сообщество'),
        actions: [
          if (_community != null && _community['invite_code'] != null)
            IconButton(
              icon: const Icon(Icons.share_outlined, color: Color(0xFF00C2FF)),
              onPressed: () {
                final code = _community['invite_code']?.toString() ?? '';
                Clipboard.setData(ClipboardData(text: code));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Инвайт-код скопирован в буфер обмена'), backgroundColor: Colors.green),
                );
              },
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
                        onPressed: _loadAllData,
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6C5CE7)),
                        child: const Text('Повторить'),
                      ),
                    ],
                  ),
                )
              : CustomScrollView(
                  slivers: [
                    // Header card
                    SliverToBoxAdapter(
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF11111A),
                          border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.04))),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Cover banner
                            Container(
                              height: 140,
                              width: double.infinity,
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E1E2C),
                                image: _community['cover_url'] != null
                                    ? DecorationImage(
                                        image: NetworkImage(_getAbsoluteUrl(_community['cover_url'])!),
                                        fit: BoxFit.cover,
                                      )
                                    : null,
                              ),
                              child: _community['cover_url'] == null
                                  ? Center(
                                      child: Icon(Icons.people_alt_outlined, size: 48, color: Colors.white.withOpacity(0.1)),
                                    )
                                  : null,
                            ),
                            // Profile Area
                            Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      // Avatar
                                      Container(
                                        width: 72,
                                        height: 72,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          border: Border.all(color: const Color(0xFF11111A), width: 3),
                                          boxShadow: [
                                            BoxShadow(color: Colors.black.withOpacity(0.3), spreadRadius: 1, blurRadius: 8)
                                          ],
                                        ),
                                        child: CircleAvatar(
                                          radius: 36,
                                          backgroundColor: const Color(0xFF6C5CE7).withOpacity(0.15),
                                          backgroundImage: _community['avatar_url'] != null
                                              ? NetworkImage(_getAbsoluteUrl(_community['avatar_url'])!)
                                              : null,
                                          child: _community['avatar_url'] == null
                                              ? Text(
                                                  _community['name']?.toString().substring(0, 1).toUpperCase() ?? 'С',
                                                  style: const TextStyle(
                                                    color: Color(0xFF00C2FF),
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 24,
                                                  ),
                                                )
                                              : null,
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              _community['name']?.toString() ?? 'Сообщество',
                                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                                            ),
                                            const SizedBox(height: 4),
                                            Row(
                                              children: [
                                                const Icon(Icons.people_outline, size: 16, color: Colors.white38),
                                                const SizedBox(width: 6),
                                                Text(
                                                  '${_community['members_count'] ?? 0} подписчиков',
                                                  style: const TextStyle(color: Colors.white38, fontSize: 13),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  if (_community['description'] != null && _community['description'].toString().isNotEmpty) ...[
                                    Text(
                                      _community['description']?.toString() ?? '',
                                      style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                                    ),
                                    const SizedBox(height: 12),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Composer for Admin
                    if (isMeAdmin)
                      SliverToBoxAdapter(
                        child: Container(
                          margin: const EdgeInsets.all(16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF11111A),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: Colors.white.withOpacity(0.04)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              TextField(
                                controller: _postController,
                                maxLines: 4,
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                                decoration: const InputDecoration(
                                  hintText: 'Опубликовать запись от имени сообщества...',
                                  hintStyle: TextStyle(color: Colors.white24),
                                  border: InputBorder.none,
                                ),
                              ),
                              if (_selectedImage != null) ...[
                                const SizedBox(height: 12),
                                Stack(
                                  alignment: Alignment.topRight,
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Image.file(
                                        _selectedImage!,
                                        height: 140,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () {
                                        setState(() {
                                          _selectedImage = null;
                                        });
                                      },
                                      child: Container(
                                        margin: const EdgeInsets.all(8),
                                        padding: const EdgeInsets.all(4),
                                        decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                                        child: const Icon(Icons.close, color: Colors.white, size: 16),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                              const SizedBox(height: 12),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.image_outlined, color: Color(0xFF00C2FF)),
                                    onPressed: () async {
                                      final picker = ImagePicker();
                                      final img = await picker.pickImage(source: ImageSource.gallery);
                                      if (img != null) {
                                        setState(() {
                                          _selectedImage = File(img.path);
                                        });
                                      }
                                    },
                                  ),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF7000FF),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                    onPressed: _handleCreatePost,
                                    child: const Text('Опубликовать', style: TextStyle(fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    // Wall section header
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                        child: Text(
                          'Записи сообщества',
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    // Wall feed
                    _posts.isEmpty
                        ? const SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.all(48.0),
                              child: Center(
                                child: Text(
                                  'Записи отсутствуют',
                                  style: TextStyle(color: Colors.white24, fontSize: 14),
                                ),
                              ),
                            ),
                          )
                        : SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final post = _posts[index];
                                final authorName = post['author_name']?.toString() ?? 'Сообщество';
                                final authorAvatar = _getAbsoluteUrl(post['author_avatar']?.toString());
                                final content = post['content']?.toString() ?? '';
                                final time = _formatTime(post['created_at']?.toString() ?? '');
                                final likesCount = post['likes'] as int? ?? 0;
                                final commentsCount = post['comments_count'] as int? ?? 0;
                                final isLiked = post['is_liked'] == true;
                                final imageUrl = _getAbsoluteUrl(post['image']?.toString());
                                final postedBy = post['posted_by']?.toString() ?? '';
                                final isPostMe = user != null && postedBy == user.id;

                                return Container(
                                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF11111A),
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(color: Colors.white.withOpacity(0.04)),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 20,
                                              backgroundColor: Colors.white12,
                                              backgroundImage: authorAvatar != null ? NetworkImage(authorAvatar) : null,
                                              child: authorAvatar == null
                                                  ? Text(authorName.substring(0, 1).toUpperCase())
                                                  : null,
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    authorName,
                                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    time,
                                                    style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            if (isPostMe || isMeAdmin)
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                                onPressed: () {
                                                  showDialog(
                                                    context: context,
                                                    builder: (ctx) => AlertDialog(
                                                      backgroundColor: const Color(0xFF13131A),
                                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                                      title: const Text('Удалить запись?', style: TextStyle(color: Colors.white)),
                                                      content: const Text(
                                                        'Вы уверены, что хотите удалить этот пост?',
                                                        style: TextStyle(color: Colors.white70),
                                                      ),
                                                      actions: [
                                                        TextButton(
                                                          child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
                                                          onPressed: () => Navigator.pop(ctx),
                                                        ),
                                                        TextButton(
                                                          child: const Text('Удалить', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                                                          onPressed: () {
                                                            Navigator.pop(ctx);
                                                            _handleDeletePost(post['id']);
                                                          },
                                                        ),
                                                      ],
                                                    ),
                                                  );
                                                },
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 14),
                                        Text(
                                          content,
                                          style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                                        ),
                                        if (imageUrl != null && imageUrl.isNotEmpty) ...[
                                          const SizedBox(height: 12),
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(16),
                                            child: Image.network(
                                              imageUrl,
                                              fit: BoxFit.cover,
                                              width: double.infinity,
                                              height: 200,
                                              errorBuilder: (_, __, ___) => const SizedBox(),
                                            ),
                                          ),
                                        ],
                                        const SizedBox(height: 16),
                                        Row(
                                          children: [
                                            GestureDetector(
                                              onTap: () => _handleToggleLike(post['id'], isLiked),
                                              child: Row(
                                                children: [
                                                  Icon(
                                                    isLiked ? Icons.favorite : Icons.favorite_border,
                                                    color: isLiked ? Colors.redAccent : Colors.white60,
                                                    size: 20,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    likesCount.toString(),
                                                    style: TextStyle(color: isLiked ? Colors.redAccent : Colors.white60, fontSize: 13),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 24),
                                            GestureDetector(
                                              onTap: () => _showCommentsBottomSheet(post['id']),
                                              child: Row(
                                                children: [
                                                  const Icon(Icons.chat_bubble_outline, color: Colors.white60, size: 20),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    commentsCount.toString(),
                                                    style: const TextStyle(color: Colors.white60, fontSize: 13),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                              childCount: _posts.length,
                            ),
                          ),
                  ],
                ),
    );
  }
}

class _CommentsWidget extends StatefulWidget {
  final String postId;
  const _CommentsWidget({required this.postId});

  @override
  State<_CommentsWidget> createState() => _CommentsWidgetState();
}

class _CommentsWidgetState extends State<_CommentsWidget> {
  final TextEditingController _commentController = TextEditingController();
  List<dynamic> _comments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchComments();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _fetchComments() async {
    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.get<dynamic>('/posts/${widget.postId}/comments');
      
      final fetched = res.data is List ? res.data as List : (res.data?['comments'] as List? ?? []);
      setState(() {
        _comments = fetched;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[CommunityComments] Fetch error: $e');
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _handleAddComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post('/posts/comment', data: {
        'post_id': widget.postId,
        'content': text,
      });
      _commentController.clear();
      _fetchComments();
    } catch (e) {
      debugPrint('[CommunityComments] Create error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось отправить комментарий: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _handleDeleteComment(String commentId) async {
    final user = context.read<AuthBloc>().state.user;
    if (user == null) return;

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.delete('/comments', data: {
        'comment_id': commentId,
        'user_id': user.id,
      });
      setState(() {
        _comments.removeWhere((c) => c['id'] == commentId);
      });
    } catch (e) {
      debugPrint('[CommunityComments] Delete error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось удалить комментарий: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthBloc>().state.user;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.6,
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Комментарии', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white60),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(color: Colors.white10),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
                  : _comments.isEmpty
                      ? const Center(child: Text('Комментарии отсутствуют', style: TextStyle(color: Colors.white30)))
                      : ListView.builder(
                          itemCount: _comments.length,
                          itemBuilder: (context, index) {
                            final comment = _comments[index];
                            final authorName = comment['author_name']?.toString() ?? 'Пользователь';
                            final content = comment['content']?.toString() ?? '';
                            final postedBy = comment['posted_by']?.toString() ?? '';
                            final isMe = user != null && postedBy == user.id;

                            return Container(
                              margin: const EdgeInsets.symmetric(vertical: 6),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.02),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white.withOpacity(0.04)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(authorName, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white70, fontSize: 13)),
                                        const SizedBox(height: 4),
                                        Text(content, style: const TextStyle(color: Colors.white60, fontSize: 13)),
                                      ],
                                    ),
                                  ),
                                  if (isMe)
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                                      onPressed: () => _handleDeleteComment(comment['id']),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
            const Divider(color: Colors.white10),
            Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.03),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.06)),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: TextField(
                      controller: _commentController,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: 'Оставьте комментарий...',
                        hintStyle: TextStyle(color: Colors.white24),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  icon: const Icon(Icons.send, color: Color(0xFF00C2FF)),
                  onPressed: _handleAddComment,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
