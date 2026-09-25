import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../services/oauth_service.dart';
import '../../support/views/support_init_dialog.dart';

enum AuthMode { login, register, twoFactor }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  AuthMode _authMode = AuthMode.login;

  // Controllers
  final _emailController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _twoFactorCodeController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  String? _successMessage;
  String _twoFactorMethod = 'email';

  @override
  void dispose() {
    _emailController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _twoFactorCodeController.dispose();
    super.dispose();
  }

  void _switchMode(AuthMode mode) {
    setState(() {
      _authMode = mode;
      _errorMessage = null;
      _successMessage = null;
      _twoFactorCodeController.clear();
    });
  }

  Future<void> _handleAuthSubmit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (_authMode == AuthMode.register) {
      final username = _usernameController.text.trim();
      if (username.isEmpty || email.isEmpty || password.isEmpty) {
        setState(() => _errorMessage = 'Заполните все обязательные поля');
        return;
      }
      if (password.length < 6) {
        setState(() => _errorMessage = 'Пароль должен быть не менее 6 символов');
        return;
      }

      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        final storageService = context.read<StorageService>();
        final apiClient = context.read<ApiClient>();
        final authService = OAuthService(apiClient, storageService);

        final user = await authService.registerUser(
          username: username,
          email: email,
          password: password,
        );

        if (user != null && mounted) {
          context.read<AuthBloc>().add(AuthSetUserEvent(user));
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _errorMessage = e.toString().replaceFirst('Exception: ', '');
          });
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
      return;
    }

    if (_authMode == AuthMode.twoFactor) {
      final code = _twoFactorCodeController.text.trim();
      if (code.isEmpty) {
        setState(() => _errorMessage = 'Введите проверочный код');
        return;
      }

      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        final storageService = context.read<StorageService>();
        final apiClient = context.read<ApiClient>();
        final authService = OAuthService(apiClient, storageService);

        final user = await authService.loginWithEmail(
          email,
          password,
          twoFactorCode: code,
        );

        if (user != null && mounted) {
          context.read<AuthBloc>().add(AuthSetUserEvent(user));
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _errorMessage = e.toString().replaceFirst('Exception: ', '');
          });
        }
      } finally {
        if (mounted) setState(() => _isLoading = false);
      }
      return;
    }

    // Default: Login
    if (email.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Введите email/логин и пароль');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final storageService = context.read<StorageService>();
      final apiClient = context.read<ApiClient>();
      final authService = OAuthService(apiClient, storageService);

      final user = await authService.loginWithEmail(email, password);

      if (user != null && mounted) {
        context.read<AuthBloc>().add(AuthSetUserEvent(user));
      }
    } on TwoFactorRequiredException catch (e) {
      if (mounted) {
        setState(() {
          _authMode = AuthMode.twoFactor;
          _twoFactorMethod = e.method;
          _successMessage = e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleResendTwoFactor() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final storageService = context.read<StorageService>();
      final apiClient = context.read<ApiClient>();
      final authService = OAuthService(apiClient, storageService);

      await authService.loginWithEmail(email, password);
    } on TwoFactorRequiredException catch (_) {
      if (mounted) {
        setState(() {
          _successMessage = 'Код отправлен повторно';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleYandexLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final storageService = context.read<StorageService>();
      final apiClient = context.read<ApiClient>();
      final authService = OAuthService(apiClient, storageService);
      await authService.loginWithYandex();
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openQrModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _QrLoginModal(
        onTokenScanned: (token) async {
          Navigator.pop(ctx);
          setState(() {
            _isLoading = true;
            _errorMessage = null;
          });
          try {
            final storageService = context.read<StorageService>();
            final apiClient = context.read<ApiClient>();
            final authService = OAuthService(apiClient, storageService);

            final user = await authService.loginWithMigrationToken(token);
            if (user != null && mounted) {
              context.read<AuthBloc>().add(AuthSetUserEvent(user));
            }
          } catch (e) {
            if (mounted) {
              setState(() {
                _errorMessage = e.toString().replaceFirst('Exception: ', '');
              });
            }
          } finally {
            if (mounted) setState(() => _isLoading = false);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // VK & GitHub dark palette
    const bgCanvas = Color(0xFF0E1117);
    const cardBg = Color(0xFF161B22);
    const borderColor = Color(0xFF30363D);
    const primaryBlue = Color(0xFF0077FF); // VK ID blue
    const inputBg = Color(0xFF0D1117);

    return Scaffold(
      backgroundColor: bgCanvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 420),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor, width: 1),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 16,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo + Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: primaryBlue,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.chat_bubble_rounded,
                          size: 22,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Vondic',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.5,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(
                      'Безопасная коммуникационная платформа',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Mode Toggle: Вход / Регистрация (only if not in 2FA)
                  if (_authMode != AuthMode.twoFactor) ...[
                    Container(
                      decoration: BoxDecoration(
                        color: inputBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: borderColor),
                      ),
                      padding: const EdgeInsets.all(3),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _switchMode(AuthMode.login),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _authMode == AuthMode.login ? cardBg : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  border: _authMode == AuthMode.login
                                      ? Border.all(color: borderColor)
                                      : null,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  'Вход',
                                  style: TextStyle(
                                    fontWeight: _authMode == AuthMode.login ? FontWeight.w600 : FontWeight.w400,
                                    fontSize: 13,
                                    color: _authMode == AuthMode.login ? Colors.white : Colors.white60,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () => _switchMode(AuthMode.register),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _authMode == AuthMode.register ? cardBg : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  border: _authMode == AuthMode.register
                                      ? Border.all(color: borderColor)
                                      : null,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  'Регистрация',
                                  style: TextStyle(
                                    fontWeight: _authMode == AuthMode.register ? FontWeight.w600 : FontWeight.w400,
                                    fontSize: 13,
                                    color: _authMode == AuthMode.register ? Colors.white : Colors.white60,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // Messages (Error / Success)
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF85149).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFF85149).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline, color: Color(0xFFF85149), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(color: Color(0xFFF85149), fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  if (_successMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2EA043).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF2EA043).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.check_circle_outline, color: Color(0xFF2EA043), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _successMessage!,
                              style: const TextStyle(color: Color(0xFF3FB950), fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // 2FA Screen Content
                  if (_authMode == AuthMode.twoFactor) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: inputBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: borderColor),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.verified_user_outlined, size: 36, color: primaryBlue),
                          const SizedBox(height: 12),
                          const Text(
                            'Двухфакторная защита',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _twoFactorMethod == 'totp'
                                ? 'Введите 6-значный код из вашего приложения-аутентификатора (Google Authenticator).'
                                : 'Код подтверждения отправлен на вашу почту. Введите его ниже.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.6)),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _twoFactorCodeController,
                            keyboardType: TextInputType.number,
                            maxLength: 6,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 8,
                            ),
                            decoration: InputDecoration(
                              counterText: '',
                              hintText: '000000',
                              hintStyle: TextStyle(
                                color: Colors.white.withValues(alpha: 0.2),
                                letterSpacing: 8,
                              ),
                              filled: true,
                              fillColor: cardBg,
                              contentPadding: const EdgeInsets.symmetric(vertical: 14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: borderColor),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: primaryBlue, width: 1.5),
                              ),
                            ),
                            onSubmitted: (_) => _handleAuthSubmit(),
                          ),
                          const SizedBox(height: 12),
                          if (_twoFactorMethod == 'email')
                            TextButton(
                              onPressed: _isLoading ? null : _handleResendTwoFactor,
                              child: const Text(
                                'Отправить код повторно',
                                style: TextStyle(fontSize: 12, color: primaryBlue),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleAuthSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryBlue,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Подтвердить вход',
                                style: TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                              ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => _switchMode(AuthMode.login),
                      child: const Text(
                        'Вернуться к логину',
                        style: TextStyle(color: Colors.white54, fontSize: 13),
                      ),
                    ),
                  ] else ...[
                    // Login / Registration Form Fields
                    if (_authMode == AuthMode.register) ...[
                      _buildTextField(
                        controller: _usernameController,
                        label: 'Имя пользователя',
                        hint: 'nikname',
                        icon: Icons.alternate_email,
                      ),
                      const SizedBox(height: 12),
                    ],

                    _buildTextField(
                      controller: _emailController,
                      label: _authMode == AuthMode.register ? 'Email' : 'Email или логин',
                      hint: _authMode == AuthMode.register ? 'name@example.com' : 'user@mail.ru',
                      icon: Icons.person_outline,
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 12),

                    _buildTextField(
                      controller: _passwordController,
                      label: 'Пароль',
                      hint: '••••••••',
                      icon: Icons.lock_outline,
                      obscureText: _obscurePassword,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 18,
                          color: Colors.white54,
                        ),
                        onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                      ),
                      onSubmitted: (_) => _handleAuthSubmit(),
                    ),
                    const SizedBox(height: 20),

                    // Submit Primary Button
                    SizedBox(
                      height: 46,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleAuthSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryBlue,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                _authMode == AuthMode.register ? 'Зарегистрироваться' : 'Войти в аккаунт',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Colors.white),
                              ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Divider
                    Row(
                      children: [
                        Expanded(child: Divider(color: borderColor.withValues(alpha: 0.8))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          child: Text(
                            'или',
                            style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
                          ),
                        ),
                        Expanded(child: Divider(color: borderColor.withValues(alpha: 0.8))),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // QR / Passkey Migration button
                    SizedBox(
                      height: 44,
                      child: OutlinedButton.icon(
                        onPressed: _openQrModal,
                        icon: const Icon(Icons.qr_code_scanner, size: 18, color: Colors.white),
                        label: const Text(
                          'Вход по QR-коду / Токену',
                          style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: inputBg,
                          side: const BorderSide(color: borderColor),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Yandex Button
                    SizedBox(
                      height: 44,
                      child: ElevatedButton.icon(
                        onPressed: _isLoading ? null : _handleYandexLogin,
                        icon: Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFC3F1D),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          alignment: Alignment.center,
                          child: const Text('Я', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                        ),
                        label: const Text(
                          'Войти с Яндекс ID',
                          style: TextStyle(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFFCC00),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          elevation: 0,
                        ),
                      ),
                    ),
                  ],

                  const SizedBox(height: 18),

                  // Technical Support footer link
                  Center(
                    child: TextButton.icon(
                      icon: const Icon(Icons.help_outline, size: 16, color: Colors.white38),
                      label: const Text(
                        'Поддержка и безопасность',
                        style: TextStyle(color: Colors.white38, fontSize: 12),
                      ),
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (context) => const SupportInitDialog(),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType keyboardType = TextInputType.text,
    void Function(String)? onSubmitted,
  }) {
    const inputBg = Color(0xFF0D1117);
    const borderColor = Color(0xFF30363D);
    const primaryBlue = Color(0xFF0077FF);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white70),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 14),
            prefixIcon: Icon(icon, size: 18, color: Colors.white54),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: inputBg,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: borderColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: primaryBlue, width: 1.5),
            ),
          ),
          onSubmitted: onSubmitted,
        ),
      ],
    );
  }
}

/// Modal for scanning desktop passkey QR or entering token manually
class _QrLoginModal extends StatefulWidget {
  final void Function(String token) onTokenScanned;
  const _QrLoginModal({required this.onTokenScanned});

  @override
  State<_QrLoginModal> createState() => _QrLoginModalState();
}

class _QrLoginModalState extends State<_QrLoginModal> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final MobileScannerController _scannerController = MobileScannerController();
  final _manualTokenController = TextEditingController();
  bool _scanned = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _scannerController.dispose();
    _manualTokenController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_scanned) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw != null && raw.isNotEmpty) {
        _scanned = true;
        String token = raw;
        // Parse if it's a URL like https://.../auth/passkey-migrate?token=XYZ
        try {
          final uri = Uri.parse(raw);
          if (uri.queryParameters.containsKey('token')) {
            token = uri.queryParameters['token']!;
          } else if (uri.queryParameters.containsKey('migration_token')) {
            token = uri.queryParameters['migration_token']!;
          }
        } catch (_) {}
        widget.onTokenScanned(token);
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const cardBg = Color(0xFF161B22);
    const borderColor = Color(0xFF30363D);
    const primaryBlue = Color(0xFF0077FF);

    return Container(
      height: 480,
      decoration: const BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(top: BorderSide(color: borderColor)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.white24,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Вход по QR-коду / Миграция',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          const SizedBox(height: 12),
          TabBar(
            controller: _tabController,
            indicatorColor: primaryBlue,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white54,
            tabs: const [
              Tab(text: 'Камера'),
              Tab(text: 'Ввести вручную'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // Tab 1: Camera Scanner
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        MobileScanner(
                          controller: _scannerController,
                          onDetect: _onDetect,
                        ),
                        Container(
                          width: 200,
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(color: primaryBlue, width: 2),
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        Positioned(
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Наведите на QR-код с экрана компьютера',
                              style: TextStyle(color: Colors.white70, fontSize: 11),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Tab 2: Manual Token
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Если камера недоступна, скопируйте и вставьте токен миграции или ссылку ниже:',
                        style: TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _manualTokenController,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Вставьте ссылку или токен миграции...',
                          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13),
                          filled: true,
                          fillColor: const Color(0xFF0D1117),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: borderColor),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: primaryBlue),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 44,
                        child: ElevatedButton(
                          onPressed: () {
                            final raw = _manualTokenController.text.trim();
                            if (raw.isEmpty) return;
                            String token = raw;
                            try {
                              final uri = Uri.parse(raw);
                              if (uri.queryParameters.containsKey('token')) {
                                token = uri.queryParameters['token']!;
                              }
                            } catch (_) {}
                            widget.onTokenScanned(token);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryBlue,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: const Text('Применить токен', style: TextStyle(color: Colors.white)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
