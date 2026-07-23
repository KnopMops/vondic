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

  String _generateState() {
    final rand = Random();
    final values = List<int>.generate(16, (i) => rand.nextInt(256));
    final state = 'st_' + base64UrlEncode(values).replaceAll('=', '') + DateTime.now().millisecondsSinceEpoch.toString();
    return state;
  }

  Future<User?> login() async {
    try {
      final state = _generateState();
      await _storageService.writeString('oauth_state', state);

      final authUrl = '${AppConfig.oauthUrl}/oauth/authorize'
          '?client_id=${AppConfig.oauthClientId}'
          '&redirect_uri=${Uri.encodeComponent(AppConfig.oauthRedirectUrl)}'
          '&response_type=code'
          '&state=$state'
          '&device_type=mobile';

      _logger.d('[OAuth] Authenticating via external system browser with url: $authUrl');

      await launchUrl(
        Uri.parse(authUrl),
        mode: LaunchMode.externalApplication,
      );
      return null;
    } catch (e) {
      _logger.e('[OAuth] Login launch failed: $e');
      rethrow;
    }
  }

  Future<User?> handleCodeExchange(String code, String state) async {
    try {
      final storedState = _storageService.readString('oauth_state');
      await _storageService.remove('oauth_state');

      if (storedState != null && state != storedState) {
        throw Exception('CSRF Warning: State mismatch!');
      }

      // Exchange code for tokens
      final tokenData = await _exchangeCodeForTokens(code);
      if (tokenData == null) {
        throw Exception('Failed to exchange code for tokens');
      }

      final accessToken = tokenData['access_token'] as String;
      final refreshToken = tokenData['refresh_token'] as String?;

      await _storageService.writeSecure('access_token', accessToken);
      if (refreshToken != null) {
        await _storageService.writeSecure('refresh_token', refreshToken);
      }

      // Fetch user info
      final user = await _fetchUserInfo(accessToken);
      if (user != null) {
        await _storageService.writeString('user', jsonEncode(user.toJson()));
      }
      return user;
    } catch (e) {
      _logger.e('[OAuth] handleCodeExchange failed: $e');
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> _exchangeCodeForTokens(String code) async {
    try {
      final response = await _apiClient.publicDio.post(
        '${AppConfig.backendUrl}/oauth/token',
        data: {
          'grant_type': 'authorization_code',
          'code': code,
          'redirect_uri': AppConfig.oauthRedirectUrl,
          'client_id': AppConfig.oauthClientId,
          'client_secret': AppConfig.oauthClientSecret,
          'device_type': 'mobile',
        },
        options: Options(
          contentType: 'application/x-www-form-urlencoded',
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return response.data as Map<String, dynamic>;
      }
    } catch (e) {
      _logger.e('[OAuth] Token exchange request failed: $e');
    }
    return null;
  }

  Future<User?> _fetchUserInfo(String token) async {
    try {
      final response = await _apiClient.publicDio.get(
        '${AppConfig.backendUrl}/oauth/userinfo',
        options: Options(
          headers: {
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (response.statusCode == 200) {
        return User.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (e) {
      _logger.e('[OAuth] Fetch userinfo failed: $e');
    }
    return null;
  }
}
