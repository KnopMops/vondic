import 'dart:convert';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/url_helper.dart';
import '../../auth/bloc/auth_bloc.dart';
import 'poll_widget.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _postContentController = TextEditingController();

  List<dynamic> _posts = [];
  bool _loading = false;
  int _currentPage = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _fetchPosts(1);
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _postContentController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_loading && _hasMore) {
        _fetchPosts(_currentPage + 1);
      }
    }
  }

  Future<void> _fetchPosts(int page) async {
    if (_loading) return;
    setState(() {
      _loading = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      // Query the public API path for posts as it has author details enriched
      final res = await apiClient.publicDio.get<Map<String, dynamic>>('/posts?page=$page&per_page=10');
      
      final List<dynamic> fetched = res.data?['items'] as List? ?? [];
      final int totalPages = res.data?['pages'] as int? ?? 1;

      setState(() {
        if (page == 1) {
          _posts = fetched;
        } else {
          _posts.addAll(fetched);
        }
        _currentPage = page;
        _hasMore = page < totalPages;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Feed] Fetch error: $e');
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _handleCreatePost(File? imageFile) async {
    final text = _postContentController.text.trim();
    if (text.isEmpty && imageFile == null) return;

    try {
      final apiClient = context.read<ApiClient>();
      String? base64Data;
      String? filename;
      if (imageFile != null) {
        final bytes = await imageFile.readAsBytes();
        base64Data = base64.encode(bytes);
        filename = imageFile.path.split(Platform.isWindows ? '\\' : '/').last;
      }

      await apiClient.post('/posts', data: {
        'content': text,
        'image': base64Data,
        'image_filename': filename,
      });

      _postContentController.clear();
      _fetchPosts(1);
    } catch (e) {
      debugPrint('[Feed] Create post error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось создать публикацию: $e'), backgroundColor: Colors.redAccent),
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
      debugPrint('[Feed] Like action failed: $e');
      // Revert if error
      _fetchPosts(1);
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
      debugPrint('[Feed] Delete post error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось удалить публикацию: $e'), backgroundColor: Colors.redAccent),
      );
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

  void _showCreatePostDialog() {
    File? selectedImage;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, dialogSetState) {
          return AlertDialog(
            backgroundColor: const Color(0xFF11111A),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: const Text('Новая публикация', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _postContentController,
                    maxLines: 4,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: const InputDecoration(
                      hintText: 'Что у вас нового?',
                      hintStyle: TextStyle(color: Colors.white24),
                      border: InputBorder.none,
                    ),
                  ),
                  if (selectedImage != null) ...[
                    const SizedBox(height: 12),
                    Stack(
                      alignment: Alignment.topRight,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.file(
                            selectedImage!,
                            height: 150,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            dialogSetState(() {
                              selectedImage = null;
                            });
                          },
                          child: Container(
                            margin: const EdgeInsets.all(8),
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close, color: Colors.white, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.image_outlined, color: Color(0xFF00C2FF)),
                        onPressed: () async {
                          final picker = ImagePicker();
                          final XFile? img = await picker.pickImage(source: ImageSource.gallery);
                          if (img != null) {
                            dialogSetState(() {
                              selectedImage = File(img.path);
                            });
                          }
                        },
                      ),
                      const Text(
                        'Добавить обложку',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
                onPressed: () {
                  Navigator.pop(ctx);
                  _postContentController.clear();
                },
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7000FF),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Опубликовать', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () {
                  Navigator.pop(ctx);
                  _handleCreatePost(selectedImage);
                },
              ),
            ],
          );
        },
      ),
    );
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
    final user = context.watch<AuthBloc>().state.user;

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      body: Column(
        children: [
          // Create post pill trigger
          if (user != null)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: GestureDetector(
                onTap: _showCreatePostDialog,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF11111A),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.04)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: Colors.white12,
                        backgroundImage: user.fullAvatarUrl != null ? NetworkImage(user.fullAvatarUrl!) : null,
                        child: user.fullAvatarUrl == null
                            ? Text(user.username.substring(0, 1).toUpperCase())
                            : null,
                      ),
                      const SizedBox(width: 14),
                      const Text(
                        'Что у вас нового?',
                        style: TextStyle(color: Colors.white30, fontSize: 14),
                      ),
                      const Spacer(),
                      const Icon(Icons.edit_note, color: Color(0xFF00C2FF)),
                    ],
                  ),
                ),
              ),
            ),

          Expanded(
            child: RefreshIndicator(
              color: const Color(0xFF00C2FF),
              backgroundColor: const Color(0xFF11111A),
              onRefresh: () => _fetchPosts(1),
              child: _posts.isEmpty && _loading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _posts.length + (_hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _posts.length) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(vertical: 20),
                              child: CircularProgressIndicator(color: Color(0xFF00C2FF)),
                            ),
                          );
                        }

                        final post = _posts[index];
                        final authorName = post['author_name']?.toString() ?? 'Пользователь';
                        final authorAvatar = post['author_avatar']?.toString();
                        final content = post['content']?.toString() ?? '';
                        final time = _formatTime(post['created_at']?.toString() ?? '');
                        final likesCount = post['likes'] as int? ?? 0;
                        final commentsCount = post['comments_count'] as int? ?? 0;
                        final isLiked = post['is_liked'] == true;
                        final rawImageUrl = post['image']?.toString();
                        final postedBy = post['posted_by']?.toString() ?? '';

                        final List<String> postImages = [];
                        final List<Map<String, dynamic>> postPolls = [];

                        if (rawImageUrl != null && rawImageUrl.isNotEmpty) {
                          postImages.add(rawImageUrl.toAbsoluteUrl);
                        }

                        final rawAttachments = post['attachments'];
                        List<dynamic> attachmentsList = [];
                        if (rawAttachments is List) {
                          attachmentsList = rawAttachments;
                        } else if (rawAttachments is String && rawAttachments.isNotEmpty) {
                          try {
                            final decoded = jsonDecode(rawAttachments);
                            if (decoded is List) attachmentsList = decoded;
                          } catch (_) {}
                        }

                        for (var att in attachmentsList) {
                          if (att is Map) {
                            final attMap = Map<String, dynamic>.from(att);
                            final type = attMap['type']?.toString().toLowerCase();
                            if (type == 'poll' || attMap.containsKey('poll_id')) {
                              postPolls.add(attMap);
                            } else {
                              final url = attMap['url']?.toString() ?? attMap['path']?.toString() ?? '';
                              if (url.isNotEmpty) {
                                final absUrl = url.toAbsoluteUrl;
                                if (!postImages.contains(absUrl)) postImages.add(absUrl);
                              }
                            }
                          } else if (att is String && att.isNotEmpty) {
                            if (att.contains('"type"') && att.contains('"poll"')) {
                              try {
                                final decoded = jsonDecode(att);
                                if (decoded is Map<String, dynamic>) postPolls.add(decoded);
                              } catch (_) {}
                            } else {
                              final absUrl = att.toAbsoluteUrl;
                              if (!postImages.contains(absUrl)) postImages.add(absUrl);
                            }
                          }
                        }

                        final isMe = user != null && postedBy == user.id;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 16),
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
                                      backgroundImage: authorAvatar != null && authorAvatar.isNotEmpty ? NetworkImage(authorAvatar.toAbsoluteUrl) : null,
                                      child: authorAvatar == null || authorAvatar.isEmpty
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
                                    if (isMe)
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                        onPressed: () {
                                          showDialog(
                                            context: context,
                                            builder: (ctx) => AlertDialog(
                                              backgroundColor: const Color(0xFF13131A),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                              title: const Text('Удалить публикацию?', style: TextStyle(color: Colors.white)),
                                              content: const Text(
                                                'Вы действительно хотите удалить этот пост?',
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
                                if (content.isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  Text(
                                    content,
                                    style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                                  ),
                                ],
                                for (final pollData in postPolls) ...[
                                  const SizedBox(height: 12),
                                  PollWidget(pollData: pollData),
                                ],
                                for (final imgUrl in postImages) ...[
                                  const SizedBox(height: 12),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(16),
                                    child: Image.network(
                                      imgUrl,
                                      fit: BoxFit.cover,
                                      width: double.infinity,
                                      loadingBuilder: (ctx, child, progress) {
                                        if (progress == null) return child;
                                        return Container(
                                          height: 200,
                                          color: Colors.white.withOpacity(0.04),
                                          child: const Center(
                                            child: CircularProgressIndicator(color: Color(0xFF00C2FF), strokeWidth: 2),
                                          ),
                                        );
                                      },
                                      errorBuilder: (_, err, ___) {
                                        debugPrint('[FeedScreen] Image load error for $imgUrl: $err');
                                        return Container(
                                          height: 140,
                                          color: Colors.white.withOpacity(0.03),
                                          child: const Center(
                                            child: Column(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Icon(Icons.image_not_supported_outlined, color: Colors.white24, size: 36),
                                                SizedBox(height: 6),
                                                Text('Ошибка загрузки изображения', style: TextStyle(color: Colors.white38, fontSize: 12)),
                                              ],
                                            ),
                                          ),
                                        );
                                      },
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
                    ),
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
      debugPrint('[Feed] Comments fetch error: $e');
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
      debugPrint('[Feed] Comment post error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось отправить комментарий: $e'), backgroundColor: Colors.redAccent),
      );
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
      debugPrint('[Feed] Delete comment error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось удалить комментарий: $e'), backgroundColor: Colors.redAccent),
      );
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
