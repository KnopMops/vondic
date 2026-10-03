import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../services/oauth_service.dart';

class ForgotPasswordModal extends StatefulWidget {
  final String? initialEmail;
  final String? initialToken;
  final void Function(String email)? onPasswordResetSuccess;

  const ForgotPasswordModal({
    super.key,
    this.initialEmail,
    this.initialToken,
    this.onPasswordResetSuccess,
  });

  @override
  State<ForgotPasswordModal> createState() => _ForgotPasswordModalState();
}

class _ForgotPasswordModalState extends State<ForgotPasswordModal>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Step 1: Request Reset
  late final TextEditingController _emailController;
  bool _isRequesting = false;
  String? _requestError;
  String? _requestSuccessMessage;

  // Step 2: Set New Password
  late final TextEditingController _tokenController;
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isResetting = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  String? _resetError;

  static const Color cardBg = Color(0xFF161B22);
  static const Color inputBg = Color(0xFF0D1117);
  static const Color borderColor = Color(0xFF30363D);
  static const Color primaryBlue = Color(0xFF0077FF);

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail ?? '');
    _tokenController = TextEditingController(text: widget.initialToken ?? '');

    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: (widget.initialToken != null && widget.initialToken!.isNotEmpty) ? 1 : 0,
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _tokenController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleRequestSubmit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _requestError = 'Введите email от вашего аккаунта');
      return;
    }

    setState(() {
      _isRequesting = true;
      _requestError = null;
      _requestSuccessMessage = null;
    });

    try {
      final storageService = context.read<StorageService>();
      final apiClient = context.read<ApiClient>();
      final authService = OAuthService(apiClient, storageService);

      final msg = await authService.requestPasswordReset(email);
      if (mounted) {
        setState(() {
          _requestSuccessMessage = msg;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _requestError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _isRequesting = false);
    }
  }

  Future<void> _handleResetSubmit() async {
    final token = _tokenController.text.trim();
    final newPassword = _newPasswordController.text;
    final confirmPassword = _confirmPasswordController.text;

    if (token.isEmpty) {
      setState(() => _resetError = 'Введите токен / код сброса пароля из письма');
      return;
    }
    if (newPassword.length < 6) {
      setState(() => _resetError = 'Пароль должен содержать не менее 6 символов');
      return;
    }
    if (newPassword != confirmPassword) {
      setState(() => _resetError = 'Введённые пароли не совпадают');
      return;
    }

    setState(() {
      _isResetting = true;
      _resetError = null;
    });

    try {
      final storageService = context.read<StorageService>();
      final apiClient = context.read<ApiClient>();
      final authService = OAuthService(apiClient, storageService);

      await authService.resetPassword(
        token: token,
        newPassword: newPassword,
      );

      if (mounted) {
        Navigator.pop(context);
        widget.onPasswordResetSuccess?.call(_emailController.text.trim());
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _resetError = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _isResetting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        border: Border(
          top: BorderSide(color: borderColor, width: 1),
          left: BorderSide(color: borderColor, width: 1),
          right: BorderSide(color: borderColor, width: 1),
        ),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: primaryBlue.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: primaryBlue.withValues(alpha: 0.3)),
                ),
                child: const Icon(Icons.lock_reset, color: primaryBlue, size: 22),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Восстановление пароля',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Сброс и создание нового пароля',
                      style: TextStyle(fontSize: 12, color: Colors.white54),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: Colors.white54, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Tabs
          Container(
            height: 38,
            decoration: BoxDecoration(
              color: inputBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: borderColor),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: primaryBlue,
                borderRadius: BorderRadius.circular(8),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white54,
              labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              tabs: const [
                Tab(text: '1. Запрос ссылки'),
                Tab(text: '2. Новый пароль'),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Tab content
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 380),
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildRequestTab(),
                _buildResetTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestTab() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Укажите email, привязанный к вашему аккаунту Вондик. Мы отправим письмо со ссылкой и токеном для сброса пароля.',
            style: TextStyle(fontSize: 13, color: Colors.white70, height: 1.4),
          ),
          const SizedBox(height: 16),

          _buildField(
            controller: _emailController,
            label: 'Ваш Email',
            hint: 'user@example.com',
            icon: Icons.alternate_email,
            keyboardType: TextInputType.emailAddress,
            onSubmitted: (_) => _handleRequestSubmit(),
          ),
          const SizedBox(height: 12),

          if (_requestError != null) ...[
            _buildAlertBanner(_requestError!, isError: true),
            const SizedBox(height: 12),
          ],

          if (_requestSuccessMessage != null) ...[
            _buildAlertBanner(_requestSuccessMessage!, isError: false),
            const SizedBox(height: 12),
          ],

          SizedBox(
            height: 44,
            child: ElevatedButton(
              onPressed: _isRequesting ? null : _handleRequestSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: _isRequesting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Отправить инструкцию',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
            ),
          ),
          const SizedBox(height: 14),

          Center(
            child: TextButton.icon(
              onPressed: () => _tabController.animateTo(1),
              icon: const Icon(Icons.arrow_forward, size: 16, color: primaryBlue),
              label: const Text(
                'У меня уже есть токен из письма',
                style: TextStyle(fontSize: 13, color: primaryBlue, fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResetTab() {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildField(
            controller: _tokenController,
            label: 'Токен из письма',
            hint: 'Вставьте токен или код из письма',
            icon: Icons.key_outlined,
          ),
          const SizedBox(height: 12),

          _buildField(
            controller: _newPasswordController,
            label: 'Новый пароль',
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
          ),
          const SizedBox(height: 12),

          _buildField(
            controller: _confirmPasswordController,
            label: 'Повторите новый пароль',
            hint: '••••••••',
            icon: Icons.lock_outline,
            obscureText: _obscureConfirm,
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                size: 18,
                color: Colors.white54,
              ),
              onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
            ),
            onSubmitted: (_) => _handleResetSubmit(),
          ),
          const SizedBox(height: 12),

          if (_resetError != null) ...[
            _buildAlertBanner(_resetError!, isError: true),
            const SizedBox(height: 12),
          ],

          SizedBox(
            height: 44,
            child: ElevatedButton(
              onPressed: _isResetting ? null : _handleResetSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryBlue,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: _isResetting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Сохранить новый пароль',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.white),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType keyboardType = TextInputType.text,
    void Function(String)? onSubmitted,
  }) {
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
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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

  Widget _buildAlertBanner(String message, {required bool isError}) {
    final color = isError ? const Color(0xFFF85149) : const Color(0xFF2EA043);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(isError ? Icons.error_outline : Icons.check_circle_outline, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: color, fontSize: 13, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }
}
