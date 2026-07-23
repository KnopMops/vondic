import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../../auth/bloc/auth_bloc.dart';
import '../../auth/bloc/auth_event.dart';
import '../../auth/models/user.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _updatingAvatar = false;

  Future<void> _handlePickAvatar() async {
    if (_updatingAvatar) return;
    try {
      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 85,
      );
      if (image == null) return;

      setState(() {
        _updatingAvatar = true;
      });

      final file = File(image.path);
      final bytes = await file.readAsBytes();
      final base64Data = base64.encode(bytes);
      final filename = image.name;

      final apiClient = context.read<ApiClient>();
      final storageService = context.read<StorageService>();

      final uploadRes = await apiClient.post<Map<String, dynamic>>(
        '/storage/upload',
        data: {
          'file': base64Data,
          'filename': filename,
        },
      );

      final avatarUrl = uploadRes.data?['url']?.toString();
      if (avatarUrl == null || avatarUrl.isEmpty) {
        throw Exception('Не удалось загрузить изображение');
      }

      final userStr = storageService.readString('user');
      final userId = userStr != null ? jsonDecode(userStr)['id'] : null;

      final updateRes = await apiClient.put<Map<String, dynamic>>(
        '/users',
        data: {
          'user_id': userId,
          'avatar_url': avatarUrl,
        },
      );

      if (mounted) {
        if (updateRes.data != null) {
          final updatedUser = User.fromJson(updateRes.data!);
          await storageService.writeString('user', jsonEncode(updatedUser.toJson()));
          context.read<AuthBloc>().add(AuthSetUserEvent(updatedUser));
        }
        context.read<AuthBloc>().add(AuthFetchUserEvent());
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Аватар успешно обновлен'), backgroundColor: Color(0xFF00FF87)),
        );
      }
    } catch (e) {
      debugPrint('[Settings] Avatar upload error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось обновить аватар: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _updatingAvatar = false;
        });
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState.user;

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
          'Настройки',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Premium Profile Banner Card
            if (user != null)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1C1B2E), Color(0xFF131324)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                child: Column(
                  children: [
                    GestureDetector(
                      onTap: _handlePickAvatar,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: const Color(0xFF00C2FF), width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF00C2FF).withOpacity(0.15),
                                  blurRadius: 16,
                                  spreadRadius: 2,
                                )
                              ],
                            ),
                            child: CircleAvatar(
                              radius: 46,
                              backgroundColor: Colors.black38,
                              backgroundImage: user.fullAvatarUrl != null ? NetworkImage(user.fullAvatarUrl!) : null,
                              child: user.fullAvatarUrl == null
                                  ? Text(
                                      (user.displayName ?? user.username).substring(0, 1).toUpperCase(),
                                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white),
                                    )
                                  : null,
                            ),
                          ),
                          if (_updatingAvatar)
                            Positioned.fill(
                              child: Container(
                                decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle,
                                ),
                                child: const CircularProgressIndicator(color: Color(0xFF00C2FF)),
                              ),
                            )
                          else
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF7000FF),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.camera_alt_outlined, color: Colors.white, size: 16),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      user.displayName ?? user.username,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.email,
                      style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.4)),
                    ),
                    if (user.premium) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF7000FF), Color(0xFF00C2FF)]),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star, color: Colors.white, size: 14),
                            SizedBox(width: 4),
                            Text(
                              'PREMIUM MEMBER',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white, letterSpacing: 0.5),
                            ),
                          ],
                        ),
                      ),
                    ]
                  ],
                ),
              ),

            // Settings Categories
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  _buildSettingsTile(
                    icon: Icons.shield_outlined,
                    iconColor: const Color(0xFF00FF87),
                    title: 'Конфиденциальность',
                    subtitle: 'Параметры видимости ваших данных',
                    onTap: () => context.push('/settings/privacy'),
                  ),
                  const SizedBox(height: 12),
                  _buildSettingsTile(
                    icon: Icons.devices_outlined,
                    iconColor: const Color(0xFF00C2FF),
                    title: 'Активные сессии',
                    subtitle: 'Управление входами и другими устройствами',
                    onTap: () => context.push('/settings/sessions'),
                  ),
                  const SizedBox(height: 12),
                  _buildSettingsTile(
                    icon: Icons.cloud_queue_outlined,
                    iconColor: const Color(0xFFFF8A00),
                    title: 'Облачное хранилище',
                    subtitle: 'Статистика занятого дискового пространства',
                    onTap: () => context.push('/settings/storage'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF11111A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.06),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.arrow_forward_ios, color: Colors.white.withOpacity(0.15), size: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
