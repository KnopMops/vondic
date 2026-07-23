import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';

class StorageScreen extends StatefulWidget {
  const StorageScreen({super.key});

  @override
  State<StorageScreen> createState() => _StorageScreenState();
}

class _StorageScreenState extends State<StorageScreen> {
  List<dynamic> _files = [];
  bool _loadingFiles = false;
  int _filesPage = 1;
  bool _hasMoreFiles = true;
  int _totalFiles = 0;

  @override
  void initState() {
    super.initState();
    _fetchFiles(1);
  }

  Future<void> _fetchFiles(int page) async {
    if (_loadingFiles) return;
    setState(() {
      _loadingFiles = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.post<Map<String, dynamic>>(
        '/files/list',
        data: {
          'page': page,
          'per_page': 20,
        },
      );

      final List<dynamic> fetchedFiles = res.data?['files'] as List? ?? [];
      final int totalPages = res.data?['pages'] as int? ?? 1;
      final int totalCount = res.data?['total'] as int? ?? 0;

      setState(() {
        if (page == 1) {
          _files = fetchedFiles;
        } else {
          _files.addAll(fetchedFiles);
        }
        _filesPage = page;
        _hasMoreFiles = page < totalPages;
        _totalFiles = totalCount;
        _loadingFiles = false;
      });
    } catch (e) {
      debugPrint('[Storage] Fetch files error: $e');
      setState(() {
        _loadingFiles = false;
      });
    }
  }

  Future<void> _handleDeleteFile(dynamic fileItem) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF11111A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Удаление файла', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(
          'Вы действительно хотите удалить файл "${fileItem['name']}"?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
            onPressed: () => Navigator.pop(ctx, false),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Удалить', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () => Navigator.pop(ctx, true),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.post(
        '/files/delete',
        data: {
          'file_id': fileItem['id'],
        },
      );

      // Refresh files and user stats
      _fetchFiles(1);
      if (mounted) {
        context.read<AuthBloc>().add(AuthFetchUserEvent());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Файл удален'), backgroundColor: Color(0xFF00FF87)),
        );
      }
    } catch (e) {
      debugPrint('[Storage] Delete file error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось удалить файл: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  Future<void> _openFileUrl(String urlString) async {
    try {
      final uri = Uri.parse(urlString);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        throw 'Could not launch $urlString';
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Не удалось открыть файл: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }

  String _formatBytes(double bytes) {
    if (bytes <= 0) return '0 Б';
    const suffixes = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
    var i = 0;
    var value = bytes;
    while (value >= 1024 && i < suffixes.length - 1) {
      value /= 1024;
      i++;
    }
    return '${value.toStringAsFixed(2)} ${suffixes[i]}';
  }

  String _formatDate(String rawDate) {
    if (rawDate.isEmpty) return '';
    try {
      final parsed = DateTime.parse(rawDate);
      return DateFormat('dd.MM.yyyy HH:mm').format(parsed);
    } catch (_) {
      return rawDate;
    }
  }

  IconData _getFileIcon(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext)) {
      return Icons.image_outlined;
    } else if (['mp4', 'mov', 'avi', 'mkv'].contains(ext)) {
      return Icons.video_library_outlined;
    } else if (['mp3', 'wav', 'm4a', 'ogg', 'opus'].contains(ext)) {
      return Icons.audio_file_outlined;
    } else if (['zip', 'rar', 'tar', 'gz', '7z'].contains(ext)) {
      return Icons.folder_zip_outlined;
    } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].contains(ext)) {
      return Icons.description_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  Color _getFileIconColor(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(ext)) {
      return const Color(0xFF00FF87);
    } else if (['mp4', 'mov', 'avi', 'mkv'].contains(ext)) {
      return const Color(0xFF00C2FF);
    } else if (['mp3', 'wav', 'm4a', 'ogg', 'opus'].contains(ext)) {
      return const Color(0xFFFF8A00);
    } else if (['zip', 'rar', 'tar', 'gz', '7z'].contains(ext)) {
      return const Color(0xFFFFCC00);
    }
    return Colors.white70;
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState.user;

    final usage = user?.diskUsage ?? 0.0;
    final limit = user?.diskLimit ?? 1073741824.0; // Default 1GB
    final bonus = user?.storageBonus ?? 0.0;

    final double progress = (limit > 0) ? (usage / limit).clamp(0.0, 1.0) : 0.0;
    final String formattedUsage = _formatBytes(usage);
    final String formattedLimit = _formatBytes(limit);
    final String formattedBonus = _formatBytes(bonus);

    return Scaffold(
      backgroundColor: const Color(0xFF09090E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF11111A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Облачное хранилище',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _fetchFiles(1);
          if (mounted) {
            context.read<AuthBloc>().add(AuthFetchUserEvent());
          }
        },
        backgroundColor: const Color(0xFF11111A),
        color: const Color(0xFFFF8A00),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Premium circular visual indicator card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1B1B2C), Color(0xFF11111E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                child: Column(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 160,
                          height: 160,
                          child: CircularProgressIndicator(
                            value: progress,
                            strokeWidth: 12,
                            backgroundColor: Colors.white.withOpacity(0.04),
                            color: const Color(0xFFFF8A00),
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.cloud_done_outlined, size: 28, color: Color(0xFFFF8A00)),
                            const SizedBox(height: 8),
                            Text(
                              formattedUsage,
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'из $formattedLimit',
                              style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.3)),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 28),
                    Text(
                      'Использовано ${(progress * 100).toStringAsFixed(1)}% от всего объема',
                      style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Detailed storage statistics
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF11111A),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.04)),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    _buildStatRow(
                      icon: Icons.storage,
                      iconColor: const Color(0xFFFF8A00),
                      label: 'Основная квота',
                      value: _formatBytes(limit - bonus),
                    ),
                    const Divider(color: Colors.white10, height: 24),
                    _buildStatRow(
                      icon: Icons.card_giftcard,
                      iconColor: const Color(0xFF00FF87),
                      label: 'Бонусное хранилище',
                      value: formattedBonus,
                    ),
                    const Divider(color: Colors.white10, height: 24),
                    _buildStatRow(
                      icon: Icons.free_breakfast_outlined,
                      iconColor: const Color(0xFF00C2FF),
                      label: 'Свободное место',
                      value: _formatBytes((limit - usage).clamp(0.0, limit)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 30),

              // User Files Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Мои файлы ($_totalFiles)',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  if (_loadingFiles)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFF8A00)),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // User Files List
              if (_files.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 40),
                  decoration: BoxDecoration(
                    color: const Color(0xFF11111A),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withOpacity(0.04)),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.folder_open, size: 48, color: Colors.white.withOpacity(0.2)),
                      const SizedBox(height: 12),
                      const Text(
                        'Нет загруженных файлов',
                        style: TextStyle(color: Colors.white30, fontSize: 14),
                      ),
                    ],
                  ),
                )
              else ...[
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _files.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = _files[index];
                    final name = item['name']?.toString() ?? 'Файл';
                    final url = item['url']?.toString() ?? '';
                    final size = item['size'] as int? ?? 0;
                    final dateStr = item['created_at']?.toString() ?? '';

                    return Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF11111A),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.04)),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        leading: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: _getFileIconColor(name).withOpacity(0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _getFileIcon(name),
                            color: _getFileIconColor(name),
                            size: 22,
                          ),
                        ),
                        title: Text(
                          name,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4.0),
                          child: Text(
                            '${_formatBytes(size.toDouble())} • ${_formatDate(dateStr)}',
                            style: TextStyle(color: Colors.white.withOpacity(0.35), fontSize: 11),
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.download_for_offline_outlined, color: Colors.white54, size: 22),
                              onPressed: () => _openFileUrl(url),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 22),
                              onPressed: () => _handleDeleteFile(item),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
                if (_hasMoreFiles) ...[
                  const SizedBox(height: 16),
                  Center(
                    child: TextButton(
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFFFF8A00),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      onPressed: () => _fetchFiles(_filesPage + 1),
                      child: const Text('Показать еще', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, color: iconColor, size: 20),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
        ),
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
        ),
      ],
    );
  }
}
