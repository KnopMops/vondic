import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';

class PrivacyScreen extends StatefulWidget {
  const PrivacyScreen({super.key});

  @override
  State<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends State<PrivacyScreen> {
  bool _loading = true;
  bool _saving = false;
  
  bool _showEmail = false;
  bool _showOnlineStatus = true;
  bool _showLastSeen = true;
  bool _allowFriendRequests = true;

  @override
  void initState() {
    super.initState();
    _loadPrivacySettings();
  }

  Future<void> _loadPrivacySettings() async {
    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.get<Map<String, dynamic>>('/users/me');
      
      final ps = res.data?['privacy_settings'] as Map? ?? {};
      setState(() {
        _showEmail = ps['show_email'] == true;
        _showOnlineStatus = ps['show_online_status'] ?? true;
        _showLastSeen = ps['show_last_seen'] ?? true;
        _allowFriendRequests = ps['allow_friend_requests'] ?? true;
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Privacy] Load settings error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось загрузить настройки: $e'), backgroundColor: Colors.redAccent),
        );
      }
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _saveSetting(String key, bool value) async {
    setState(() {
      _saving = true;
      if (key == 'show_email') _showEmail = value;
      if (key == 'show_online_status') _showOnlineStatus = value;
      if (key == 'show_last_seen') _showLastSeen = value;
      if (key == 'allow_friend_requests') _allowFriendRequests = value;
    });

    try {
      final payload = {
        'privacy_settings': {
          'show_email': _showEmail,
          'show_online_status': _showOnlineStatus,
          'show_last_seen': _showLastSeen,
          'allow_friend_requests': _allowFriendRequests,
        }
      };

      final apiClient = context.read<ApiClient>();
      await apiClient.put('/users/me', data: payload);
    } catch (e) {
      debugPrint('[Privacy] Save setting error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось сохранить настройки: $e'), backgroundColor: Colors.redAccent),
        );
      }
      // Revert state
      _loadPrivacySettings();
    } finally {
      setState(() {
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
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
          'Конфиденциальность',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
          : Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text(
                      'Кто видит мои данные',
                      style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 12),
                    _buildSwitchTile(
                      title: 'Показывать мой Email',
                      subtitle: 'Разрешить другим пользователям видеть ваш адрес почты',
                      value: _showEmail,
                      onChanged: (v) => _saveSetting('show_email', v),
                    ),
                    const SizedBox(height: 10),
                    _buildSwitchTile(
                      title: 'Статус в сети',
                      subtitle: 'Показывать другим пользователям, когда вы находитесь на сайте',
                      value: _showOnlineStatus,
                      onChanged: (v) => _saveSetting('show_online_status', v),
                    ),
                    const SizedBox(height: 10),
                    _buildSwitchTile(
                      title: 'Последний визит в сети',
                      subtitle: 'Показывать время вашего последнего входа в мессенджер',
                      value: _showLastSeen,
                      onChanged: (v) => _saveSetting('show_last_seen', v),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Взаимодействия',
                      style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 12),
                    _buildSwitchTile(
                      title: 'Разрешить запросы в друзья',
                      subtitle: 'Позволять другим пользователям добавлять вас в друзья',
                      value: _allowFriendRequests,
                      onChanged: (v) => _saveSetting('allow_friend_requests', v),
                    ),
                  ],
                ),
                if (_saving)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      color: const Color(0xFF11111A),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C2FF)),
                          ),
                          SizedBox(width: 12),
                          Text('Сохранение изменений...', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF11111A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12, height: 1.3),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: const Color(0xFF00C2FF),
            activeTrackColor: const Color(0xFF00C2FF).withOpacity(0.2),
            inactiveThumbColor: Colors.white60,
            inactiveTrackColor: Colors.white12,
          ),
        ],
      ),
    );
  }
}
