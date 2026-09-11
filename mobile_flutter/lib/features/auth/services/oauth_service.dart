import 'dart:convert';
import 'dart:math';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:logger/logger.dart';
import '../../../core/config/config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../models/user.dart';

class OAuthService {
  final ApiClient _apiClient;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  OAuthService(this._apiClient, this._storageService);

  /// Login with email/username and password via Vondic backend.
  Future<User?> loginWithEmail(String email, String password) async {
    try {
      Response response;
      try {
        response = await _apiClient.publicDio.post(
          '${AppConfig.backendUrl}/api/v1/auth/login',
          data: {
            'email': email,
            'password': password,
            'device_type': 'mobile',
          },
        );
      } on DioException catch (dioErr) {
        // If 404 or 502 on /api/v1/auth/login, try Next.js /api/auth/login proxy
        if (dioErr.response?.statusCode == 404 || dioErr.response?.statusCode == 502) {
          response = await _apiClient.publicDio.post(
            '${AppConfig.backendUrl}/api/auth/login',
            data: {
              'email': email,
              'password': password,
              'device_type': 'mobile',
            },
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
          throw Exception('Для аккаунта включена двухфакторная аутентификация (2FA)');
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

  /// Open Yandex OAuth in system browser.
  /// The browser will redirect back to vondic:///oauth/callback after auth.
  Future<void> loginWithYandex() async {
    try {
      String? authUrl;

      // 1. Try to get auth_url from backend
      try {
        final response = await _apiClient.publicDio.get(
          '${AppConfig.backendUrl}/api/v1/auth/yandex/login',
        );
        if (response.statusCode == 200 && response.data is Map) {
          authUrl = response.data['auth_url'] as String?;
        }
      } catch (e) {
        _logger.w('[Auth] /api/v1/auth/yandex/login failed, trying /api/auth/yandex/login: $e');
        try {
          final response = await _apiClient.publicDio.post(
            '${AppConfig.backendUrl}/api/auth/yandex/login',
          );
          if (response.statusCode == 200 && response.data is Map) {
            authUrl = response.data['auth_url'] as String?;
          }
        } catch (e2) {
          _logger.w('[Auth] /api/auth/yandex/login failed: $e2');
        }
      }

      // 2. If backend did not provide auth_url, build fallback or use Vondic OAuth
      if (authUrl == null || authUrl.isEmpty) {
        final clientId = AppConfig.yandexClientId;
        if (clientId.isNotEmpty) {
          authUrl = 'https://oauth.yandex.ru/authorize?'
              'response_type=code'
              '&client_id=$clientId'
              '&redirect_uri=${Uri.encodeComponent('vondic:///oauth/callback')}';
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

      final launchUri = Uri.parse(authUrl);
      bool launched = false;
      try {
        launched = await launchUrl(
          launchUri,
          mode: LaunchMode.externalApplication,
        );
      } catch (e) {
        _logger.w('[Auth] externalApplication launch failed: $e');
      }

      if (!launched) {
        try {
          launched = await launchUrl(
            launchUri,
            mode: LaunchMode.inAppBrowserView,
          );
        } catch (e) {
          _logger.w('[Auth] inAppBrowserView launch failed: $e');
        }
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
}
