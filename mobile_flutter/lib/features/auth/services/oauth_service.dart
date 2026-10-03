import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:logger/logger.dart';
import '../../../core/config/config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../models/user.dart';

class TwoFactorRequiredException implements Exception {
  final String method;
  final String message;
  TwoFactorRequiredException({required this.method, required this.message});

  @override
  String toString() => message;
}

class OAuthService {
  final ApiClient _apiClient;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  OAuthService(this._apiClient, this._storageService);

  /// Fetch current user from /auth/me with active access token
  Future<User?> getMe() async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/auth/me');
      final userData = response.data?['user'];
      if (userData != null) {
        final user = User.fromJson(userData);
        await _storageService.writeString('user', jsonEncode(user.toJson()));
        return user;
      }
    } catch (e) {
      _logger.e('[Auth] getMe failed: $e');
    }
    return null;
  }

  /// Login with email/username and password via Vondic backend, with optional 2FA code.
  Future<User?> loginWithEmail(
    String email,
    String password, {
    String? twoFactorCode,
  }) async {
    try {
      final requestData = <String, dynamic>{
        'email': email.trim(),
        'password': password,
        'device_type': 'mobile',
      };
      if (twoFactorCode != null && twoFactorCode.trim().isNotEmpty) {
        requestData['two_factor_code'] = twoFactorCode.trim();
        requestData['email_code'] = twoFactorCode.trim();
        requestData['totp_code'] = twoFactorCode.trim();
      }

      Response response;
      try {
        response = await _apiClient.publicDio.post(
          '${AppConfig.backendUrl}/api/v1/auth/login',
          data: requestData,
        );
      } on DioException catch (dioErr) {
        // If 404 or 502 on /api/v1/auth/login, try Next.js /api/auth/login proxy
        if (dioErr.response?.statusCode == 404 || dioErr.response?.statusCode == 502) {
          response = await _apiClient.publicDio.post(
            '${AppConfig.backendUrl}/api/auth/login',
            data: requestData,
          );
        } else {
          rethrow;
        }
      }

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final accessToken = data['access_token'] as String?;
        final refreshToken = data['refresh_token'] as String?;

        if (accessToken != null) {
          await _storageService.writeSecure('access_token', accessToken);
        }
        if (refreshToken != null) {
          await _storageService.writeSecure('refresh_token', refreshToken);
        }

        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          final user = User.fromJson(userData);
          await _storageService.writeString('user', jsonEncode(user.toJson()));
          return user;
        }
      }
      throw Exception('Неверный логин или пароль');
    } on DioException catch (e) {
      _logger.e('[Auth] Email login failed: ${e.message}');
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
        throw Exception('Таймаут подключения к серверу');
      }
      if (e.type == DioExceptionType.connectionError) {
        throw Exception('Не удалось подключиться к серверу (${AppConfig.backendUrl})');
      }
      if (e.response?.data is Map) {
        final map = e.response!.data as Map;
        if (map['two_factor_required'] == true) {
          throw TwoFactorRequiredException(
            method: (map['method'] as String?) ?? 'email',
            message: (map['detail'] as String?) ?? 'Введите 6-значный код подтверждения',
          );
        }
        final detail = map['detail'] ?? map['error'] ?? map['message'];
        if (detail != null) {
          throw Exception(detail.toString());
        }
      }
      if (e.response?.statusCode == 401) {
        throw Exception('Неверный логин или пароль');
      }
      throw Exception(e.message ?? 'Ошибка авторизации');
    }
  }

  /// Register new user account.
  Future<User?> registerUser({
    required String username,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/api/v1/auth/register',
        data: {
          'username': username.trim(),
          'email': email.trim().toLowerCase(),
          'password': password,
        },
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final accessToken = data['access_token'] as String?;
        final refreshToken = data['refresh_token'] as String?;

        if (accessToken != null) {
          await _storageService.writeSecure('access_token', accessToken);
        }
        if (refreshToken != null) {
          await _storageService.writeSecure('refresh_token', refreshToken);
        }

        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          final user = User.fromJson(userData);
          await _storageService.writeString('user', jsonEncode(user.toJson()));
          return user;
        }
      }
      throw Exception('Ошибка при создании аккаунта');
    } on DioException catch (e) {
      _logger.e('[Auth] Register failed: ${e.message}');
      final detail = e.response?.data is Map
          ? (e.response?.data['detail'] ?? e.response?.data['error'] ?? e.response?.data['message'])
          : null;
      if (detail != null) {
        throw Exception(detail.toString());
      }
      throw Exception(e.message ?? 'Ошибка регистрации');
    }
  }

  /// Exchange a scanned QR / migration token for session tokens.
  Future<User?> loginWithMigrationToken(String migrationToken) async {
    try {
      final cleanToken = migrationToken.trim();
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/api/v1/auth/passkey/migrate/exchange',
        data: {
          'token': cleanToken,
          'device_name': 'Мобильное приложение (QR вход)',
        },
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final accessToken = data['access_token'] as String?;
        final refreshToken = data['refresh_token'] as String?;

        if (accessToken != null) {
          await _storageService.writeSecure('access_token', accessToken);
        }
        if (refreshToken != null) {
          await _storageService.writeSecure('refresh_token', refreshToken);
        }

        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          final user = User.fromJson(userData);
          await _storageService.writeString('user', jsonEncode(user.toJson()));
          return user;
        }
      }
      throw Exception('Неверный или устаревший QR-код');
    } on DioException catch (e) {
      _logger.e('[Auth] Migration exchange failed: ${e.message}');
      final detail = e.response?.data is Map
          ? (e.response?.data['detail'] ?? e.response?.data['error'] ?? e.response?.data['message'])
          : null;
      if (detail != null) {
        throw Exception(detail.toString());
      }
      throw Exception('QR-код устарел или недействителен');
    }
  }

  /// Open Yandex OAuth.
  /// Uses flutter_web_auth_2 for automatic in-app flow or falls back to system browser.
  Future<User?> loginWithYandex() async {
    try {
      String? authUrl;

      // 1. Try to get auth_url from backend with state=mobile_redirect:vondic://oauth/callback
      try {
        final response = await _apiClient.publicDio.get(
          '${AppConfig.backendUrl}/api/v1/auth/yandex/login',
          queryParameters: {'state': 'mobile_redirect:vondic://oauth/callback'},
        );
        if (response.statusCode == 200 && response.data is Map) {
          authUrl = response.data['auth_url'] as String?;
        }
      } catch (e) {
        _logger.w('[Auth] /api/v1/auth/yandex/login failed, trying /api/auth/yandex/login: $e');
        try {
          final response = await _apiClient.publicDio.post(
            '${AppConfig.backendUrl}/api/auth/yandex/login',
            queryParameters: {
              'state': 'mobile_redirect:vondic://oauth/callback',
              'cid': 'mobile_redirect:vondic://oauth/callback',
            },
          );
          if (response.statusCode == 200 && response.data is Map) {
            authUrl = response.data['auth_url'] as String?;
          }
        } catch (e2) {
          _logger.w('[Auth] /api/auth/yandex/login failed: $e2');
        }
      }

      // 2. Fallbacks
      if (authUrl == null || authUrl.isEmpty) {
        final clientId = AppConfig.yandexClientId;
        if (clientId.isNotEmpty) {
          authUrl = 'https://oauth.yandex.ru/authorize?'
              'response_type=code'
              '&client_id=$clientId'
              '&redirect_uri=${Uri.encodeComponent('https://vondic.ru/api/auth/yandex/callback')}'
              '&state=${Uri.encodeComponent('mobile_redirect:vondic://oauth/callback')}';
        } else {
          // Fallback to Vondic OAuth authorization page
          authUrl = '${AppConfig.oauthUrl}/oauth/authorize?'
              'client_id=${AppConfig.oauthClientId}'
              '&redirect_uri=${Uri.encodeComponent(AppConfig.oauthRedirectUrl)}'
              '&response_type=code';
        }
      } else {
        // Ensure mobile deep link redirect state is attached
        final uri = Uri.parse(authUrl);
        final params = Map<String, String>.from(uri.queryParameters);
        if (!params.containsKey('state') || params['state']!.isEmpty) {
          params['state'] = 'mobile_redirect:vondic://oauth/callback';
          authUrl = uri.replace(queryParameters: params).toString();
        }
      }

      _logger.d('[Auth] Opening OAuth: $authUrl');

      // 3. Try flutter_web_auth_2 first (closes automatically upon redirect)
      try {
        final result = await FlutterWebAuth2.authenticate(
          url: authUrl,
          callbackUrlScheme: 'vondic',
        );

        _logger.d('[Auth] FlutterWebAuth2 result: $result');
        final resultUri = Uri.parse(result);
        final accessToken = resultUri.queryParameters['access_token'];
        final refreshToken = resultUri.queryParameters['refresh_token'];
        final code = resultUri.queryParameters['code'];
        final state = resultUri.queryParameters['state'] ?? '';

        if (accessToken != null && accessToken.isNotEmpty) {
          await _storageService.writeSecure('access_token', accessToken);
          if (refreshToken != null && refreshToken.isNotEmpty) {
            await _storageService.writeSecure('refresh_token', refreshToken);
          }
          final user = await getMe();
          return user;
        } else if (code != null && code.isNotEmpty) {
          final user = await handleOAuthCallback(code, state);
          return user;
        }
        return null;
      } catch (authErr) {
        _logger.w('[Auth] FlutterWebAuth2 failed or dismissed: $authErr');
        final errLower = authErr.toString().toLowerCase();
        if (errLower.contains('canceled') || errLower.contains('cancelled') || errLower.contains('user_cancelled')) {
          // User cancelled authentication
          return null;
        }

        // Fallback: launch external browser
        final launchUri = Uri.parse(authUrl);
        bool launched = false;
        try {
          launched = await launchUrl(
            launchUri,
            mode: LaunchMode.externalApplication,
          );
        } catch (_) {}

        if (!launched) {
          try {
            launched = await launchUrl(
              launchUri,
              mode: LaunchMode.inAppBrowserView,
            );
          } catch (_) {}
        }

        if (!launched) {
          launched = await launchUrl(
            launchUri,
            mode: LaunchMode.platformDefault,
          );
        }

        if (!launched) {
          throw Exception('Не удалось открыть браузер для авторизации');
        }
        return null;
      }
    } catch (e) {
      _logger.e('[Auth] Yandex login launch failed: $e');
      rethrow;
    }
  }

  /// Handle OAuth callback from Yandex or Vondic OAuth.
  /// Called when the app receives vondic:///oauth/callback?code=...&state=...
  Future<User?> handleOAuthCallback(String code, String state) async {
    try {
      _logger.d('[Auth] Handling OAuth callback, code: ${code.substring(0, code.length > 8 ? 8 : code.length)}...');

      // 1. If Vondic OAuth authorization code (starts with vdc_)
      if (code.startsWith('vdc_')) {
        final response = await _apiClient.publicDio.post(
          '${AppConfig.oauthUrl}/oauth/token',
          data: {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': AppConfig.oauthClientId,
            'client_secret': AppConfig.oauthClientSecret,
            'redirect_uri': AppConfig.oauthRedirectUrl,
          },
        );

        if (response.statusCode == 200 && response.data is Map) {
          final data = response.data as Map<String, dynamic>;
          final accessToken = data['access_token'] as String?;
          final refreshToken = data['refresh_token'] as String?;

          if (accessToken != null) {
            await _storageService.writeSecure('access_token', accessToken);
          }
          if (refreshToken != null) {
            await _storageService.writeSecure('refresh_token', refreshToken);
          }

          // Fetch user info with the access token
          final userRes = await _apiClient.publicDio.get(
            '${AppConfig.oauthUrl}/oauth/userinfo',
            options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
          );

          if (userRes.statusCode == 200 && userRes.data is Map) {
            final user = User.fromJson(userRes.data as Map<String, dynamic>);
            await _storageService.writeString('user', jsonEncode(user.toJson()));
            return user;
          }
        }
      }

      // 2. Otherwise exchange via backend Yandex callback
      final response = await _apiClient.publicDio.get(
        '${AppConfig.backendUrl}/api/v1/auth/yandex/callback',
        queryParameters: {'code': code},
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final accessToken = data['access_token'] as String?;
        final refreshToken = data['refresh_token'] as String?;

        if (accessToken != null) {
          await _storageService.writeSecure('access_token', accessToken);
        }
        if (refreshToken != null) {
          await _storageService.writeSecure('refresh_token', refreshToken);
        }

        final userData = data['user'] as Map<String, dynamic>?;
        if (userData != null) {
          final user = User.fromJson(userData);
          await _storageService.writeString('user', jsonEncode(user.toJson()));
          return user;
        }
      }
      throw Exception('Не удалось получить данные пользователя');
    } on DioException catch (e) {
      _logger.e('[Auth] OAuth callback failed: ${e.message}');
      final detail = e.response?.data is Map
          ? (e.response?.data['detail'] ?? e.response?.data['error'] ?? e.response?.data['message'])
          : null;
      if (detail != null) {
        throw Exception(detail.toString());
      }
      throw Exception('Ошибка авторизации через OAuth');
    } catch (e) {
      _logger.e('[Auth] OAuth callback error: $e');
      rethrow;
    }
  }

  /// Request password reset email
  Future<String> requestPasswordReset(String email) async {
    try {
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/api/v1/auth/forgot-password',
        data: {'email': email.trim().toLowerCase()},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data is Map && data['message'] != null) {
          final msg = data['message'].toString();
          if (msg == 'Password reset email sent') {
            return 'Письмо со ссылкой для сброса пароля отправлено на ваш email';
          }
          return msg;
        }
        return 'Письмо для сброса пароля отправлено';
      }
      throw Exception('Не удалось отправить запрос на сброс пароля');
    } on DioException catch (e) {
      _logger.e('[Auth] Forgot password failed: ${e.message}');
      final detail = e.response?.data is Map
          ? (e.response?.data['detail'] ?? e.response?.data['error'] ?? e.response?.data['message'])
          : null;
      if (detail != null) {
        final str = detail.toString();
        if (str == 'User not found') {
          throw Exception('Пользователь с таким email не найден');
        }
        throw Exception(str);
      }
      throw Exception(e.message ?? 'Ошибка запроса сброса пароля');
    }
  }

  /// Reset password using token received in email
  Future<String> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/api/v1/auth/reset-password',
        data: {
          'token': token.trim(),
          'new_password': newPassword,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        if (data is Map && data['message'] != null) {
          final msg = data['message'].toString();
          if (msg == 'Password reset successfully') {
            return 'Пароль успешно изменён! Теперь вы можете войти в аккаунт.';
          }
          return msg;
        }
        return 'Пароль успешно изменён!';
      }
      throw Exception('Не удалось сбросить пароль');
    } on DioException catch (e) {
      _logger.e('[Auth] Reset password failed: ${e.message}');
      final detail = e.response?.data is Map
          ? (e.response?.data['detail'] ?? e.response?.data['error'] ?? e.response?.data['message'])
          : null;
      if (detail != null) {
        final str = detail.toString();
        if (str == 'Invalid or expired token') {
          throw Exception('Недействительный или истёкший токен сброса пароля');
        }
        if (str == 'User not found') {
          throw Exception('Пользователь не найден');
        }
        throw Exception(str);
      }
      throw Exception(e.message ?? 'Ошибка сброса пароля');
    }
  }
}

