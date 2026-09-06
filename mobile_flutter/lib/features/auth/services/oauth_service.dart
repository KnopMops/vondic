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

  /// Login with email and password via Vondic backend.
  Future<User?> loginWithEmail(String email, String password) async {
    try {
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/api/v1/auth/login',
        data: {
          'email': email,
          'password': password,
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
      throw Exception('Неверный email или пароль');
    } on DioException catch (e) {
      _logger.e('[Auth] Email login failed: ${e.message}');
      final detail = e.response?.data?['detail'] ?? e.response?.data?['error'];
      if (detail != null) {
        throw Exception(detail.toString());
      }
      if (e.response?.statusCode == 401) {
        throw Exception('Неверный email или пароль');
      }
      throw Exception('Ошибка авторизации');
    }
  }

  /// Open Yandex OAuth in system browser.
  /// The browser will redirect back to vondic:///oauth/callback after auth.
  Future<void> loginWithYandex() async {
    try {
      // Get the Yandex auth URL from backend
      final response = await _apiClient.publicDio.get(
        '${AppConfig.backendUrl}/api/v1/auth/yandex/login',
      );

      String authUrl;
      if (response.statusCode == 200 && response.data is Map) {
        authUrl = response.data['auth_url'] as String;
      } else {
        // Fallback: build URL manually
        final clientId = AppConfig.yandexClientId;
        authUrl = 'https://oauth.yandex.ru/authorize?'
            'response_type=code'
            '&client_id=$clientId'
            '&redirect_uri=${Uri.encodeComponent('vondic:///oauth/callback')}';
      }

      _logger.d('[Auth] Opening Yandex OAuth: $authUrl');

      await launchUrl(
        Uri.parse(authUrl),
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      _logger.e('[Auth] Yandex login launch failed: $e');
      rethrow;
    }
  }

  /// Handle OAuth callback from Yandex (or any OAuth provider).
  /// Called when the app receives vondic:///oauth/callback?code=...&state=...
  Future<User?> handleOAuthCallback(String code, String state) async {
    try {
      _logger.d('[Auth] Handling OAuth callback, code length: ${code.length}');

      // Exchange code via backend Yandex callback
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
      final detail = e.response?.data?['detail'] ?? e.response?.data?['error'];
      if (detail != null) {
        throw Exception(detail.toString());
      }
      throw Exception('Ошибка авторизации через Яндекс');
    } catch (e) {
      _logger.e('[Auth] OAuth callback error: $e');
      rethrow;
    }
  }
}
