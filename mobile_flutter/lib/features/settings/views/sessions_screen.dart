import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_client.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  bool _loading = true;
  List<dynamic> _sessions = [];

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() {
      _loading = true;
    });

    try {
      final apiClient = context.read<ApiClient>();
      final res = await apiClient.get<Map<String, dynamic>>('/auth/device-sessions');
      
      setState(() {
        _sessions = res.data?['sessions'] as List? ?? [];
        _loading = false;
      });
    } catch (e) {
      debugPrint('[Sessions] Load error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось загрузить сессии: $e'), backgroundColor: Colors.redAccent),
        );
      }
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _terminateSession(String sessionId) async {
    try {
      final apiClient = context.read<ApiClient>();
      await apiClient.delete('/auth/device-sessions/$sessionId');
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Сессия успешно завершена'), backgroundColor: Color(0xFF00FF87)),
        );
      }
      _loadSessions();
    } catch (e) {
      debugPrint('[Sessions] Terminate error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Не удалось завершить сессию: $e'), backgroundColor: Colors.redAccent),
        );
      }
    }
  }

  String _formatDateTime(dynamic raw) {
    if (raw == null) return '';
    try {
      final parsed = DateTime.parse(raw.toString());
      return DateFormat('dd.MM.yyyy HH:mm').format(parsed);
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
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Colors.white),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Активные сессии',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C2FF)))
          : RefreshIndicator(
              color: const Color(0xFF00C2FF),
              backgroundColor: const Color(0xFF11111A),
              onRefresh: _loadSessions,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    'Сессии и подключенные устройства',
                    style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 16),
                  if (_sessions.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 40),
                        child: Text('Нет активных сессий', style: TextStyle(color: Colors.white.withOpacity(0.3))),
                      ),
                    )
                  else
                    ..._sessions.map((s) {
                      final isCurrent = s['is_current'] == true;
                      final sessionId = s['id']?.toString() ?? '';
                      final deviceName = s['device_name']?.toString() ?? 'Устройство';
                      final ipAddress = s['ip']?.toString() ?? 'Неизвестно';
                      final platform = s['platform']?.toString() ?? 'unknown';
                      final lastActive = _formatDateTime(s['last_active']);
                      final isMobile = s['device_type'] == 'mobile';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF11111A),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isCurrent ? const Color(0xFF00C2FF).withOpacity(0.3) : Colors.white.withOpacity(0.04),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: (isCurrent ? const Color(0xFF00C2FF) : Colors.white60).withOpacity(0.06),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  isMobile ? Icons.phone_android : Icons.computer,
                                  color: isCurrent ? const Color(0xFF00C2FF) : Colors.white60,
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            deviceName,
                                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (isCurrent) ...[
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF00C2FF).withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Text(
                                              'текущая',
                                              style: TextStyle(color: Color(0xFF00C2FF), fontSize: 9, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                        ]
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'IP: $ipAddress | $platform',
                                      style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Активность: $lastActive',
                                      style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              if (!isCurrent) ...[
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.logout_rounded, color: Colors.redAccent, size: 20),
                                  onPressed: () {
                                    showDialog(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        backgroundColor: const Color(0xFF13131A),
                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                        title: const Text('Завершить сессию?', style: TextStyle(color: Colors.white)),
                                        content: Text(
                                          'Вы уверены, что хотите завершить сессию на устройстве $deviceName?',
                                          style: const TextStyle(color: Colors.white70),
                                        ),
                                        actions: [
                                          TextButton(
                                            child: const Text('Отмена', style: TextStyle(color: Colors.white38)),
                                            onPressed: () => Navigator.pop(ctx),
                                          ),
                                          TextButton(
                                            child: const Text('Завершить', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
                                            onPressed: () {
                                              Navigator.pop(ctx);
                                              _terminateSession(sessionId);
                                            },
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                              ]
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
