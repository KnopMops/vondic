import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../../auth/bloc/auth_bloc.dart';

class SupportInitDialog extends StatefulWidget {
  const SupportInitDialog({super.key});

  @override
  State<SupportInitDialog> createState() => _SupportInitDialogState();
}

class _SupportInitDialogState extends State<SupportInitDialog> {
  final List<String> _questions = [
    'Как сменить пароль?',
    'Как удалить аккаунт?',
    'Не могу войти в аккаунт',
    'Ошибка при загрузке страницы',
    'Как связаться с поддержкой?',
    'Другое',
  ];

  String? _selectedQuestion;
  final TextEditingController _customController = TextEditingController();
  bool _loading = false;
  String? _existingToken;
  String? _existingEscId;

  @override
  void initState() {
    super.initState();
    _checkExistingAnonSession();
  }

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  Future<void> _checkExistingAnonSession() async {
    final storage = context.read<StorageService>();
    final token = await storage.readSecure('anon_support_token');
    final escId = await storage.readSecure('anon_support_escalation_id');
    if (token != null && escId != null) {
      setState(() {
        _existingToken = token;
        _existingEscId = escId;
      });
    }
  }

  Future<void> _handleSubmit() async {
    final q = _selectedQuestion == 'Другое' ? _customController.text.trim() : _selectedQuestion;
    if (q == null || q.isEmpty) return;

    setState(() {
      _loading = true;
    });

    final authState = context.read<AuthBloc>().state;
    final user = authState.user;
    final apiClient = context.read<ApiClient>();

    try {
      if (user != null) {
        // Authenticated flow
        final res = await apiClient.post<Map<String, dynamic>>('/support/chat/send', data: {
          'message': q,
          'new_chat': true,
        });
        final escId = res.data?['escalation_id']?.toString();
        if (mounted) {
          final router = GoRouter.of(context);
          Navigator.pop(context);
          if (escId != null && escId.isNotEmpty) {
            router.push('/support/ticket/$escId');
          } else {
            router.push('/support');
          }
        }
      } else {
        // Anonymous flow
        final res = await apiClient.post<Map<String, dynamic>>('/support/anon/create', data: {
          'question': q,
        });
        final ok = res.data?['ok'] == true;
        final escId = res.data?['escalation_id']?.toString();
        final token = res.data?['anon_token']?.toString();

        if (ok && escId != null && token != null) {
          final storage = context.read<StorageService>();
          await storage.writeSecure('anon_support_token', token);
          await storage.writeSecure('anon_support_escalation_id', escId);

          if (mounted) {
            final router = GoRouter.of(context);
            Navigator.pop(context);
            router.push('/support/anon/$escId/$token');
          }
        } else {
          throw Exception('Неверный формат ответа сервера');
        }
      }
    } catch (e) {
      debugPrint('[SupportInit] Submit error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка отправки: $e'), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthBloc>().state;
    final user = authState.user;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Color(0xFF11111A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.support_agent_rounded, color: Color(0xFF00C2FF)),
                      SizedBox(width: 8),
                      Text(
                        'Техническая поддержка',
                        style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white30),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const Divider(color: Colors.white10),
              const SizedBox(height: 12),
              
              if (user == null && _existingToken != null && _existingEscId != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00C2FF).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF00C2FF).withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'У вас есть активный анонимный диалог с поддержкой.',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00C2FF),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          final router = GoRouter.of(context);
                          Navigator.pop(context);
                          router.push('/support/anon/$_existingEscId/$_existingToken');
                        },
                        child: const Text('Открыть', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              const Text(
                'Выберите тему обращения:',
                style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _questions.map((q) {
                  final isSelected = _selectedQuestion == q;
                  return ChoiceChip(
                    label: Text(q),
                    selected: isSelected,
                    selectedColor: const Color(0xFF7000FF).withOpacity(0.3),
                    backgroundColor: Colors.white.withOpacity(0.03),
                    labelStyle: TextStyle(
                      color: isSelected ? const Color(0xFF00C2FF) : Colors.white70,
                      fontSize: 13,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: isSelected ? const Color(0xFF00C2FF).withOpacity(0.5) : Colors.white.withOpacity(0.06),
                      ),
                    ),
                    onSelected: (selected) {
                      setState(() {
                        _selectedQuestion = selected ? q : null;
                      });
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              if (_selectedQuestion == 'Другое' || _selectedQuestion == null) ...[
                const Text(
                  'Опишите вашу проблему подробно:',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _customController,
                  maxLines: 4,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Введите описание проблемы...',
                    hintStyle: const TextStyle(color: Colors.white24),
                    filled: true,
                    fillColor: Colors.white.withOpacity(0.02),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: Color(0xFF00C2FF)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF7000FF),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  onPressed: _loading ? null : _handleSubmit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Отправить обращение',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
