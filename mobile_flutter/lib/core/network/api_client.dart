import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../config/config.dart';
import '../utils/storage_service.dart';

class ApiClient {
  late final Dio dio;
  late final Dio publicDio;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));
  bool _isRefreshing = false;
  final List<Map<String, dynamic>> _failedRequestsQueue = [];

  ApiClient(this._storageService) {
    dio = Dio(BaseOptions(
      baseUrl: '${AppConfig.backendUrl}/api/v1',
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
      followRedirects: true,
      maxRedirects: 5,
      validateStatus: (status) => status != null && status < 400,
      headers: {'Content-Type': 'application/json'},
    ));

    publicDio = Dio(BaseOptions(
      baseUrl: '${AppConfig.backendUrl}/api',
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
      followRedirects: true,
      maxRedirects: 5,
      validateStatus: (status) => status != null && status < 400,
      headers: {'Content-Type': 'application/json'},
    ));

    _setupInterceptors();
  }

  void _setupInterceptors() {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storageService.readSecure('access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          _logger.d('[API] REQUEST ${options.method} ${options.uri} | HasToken: ${token != null}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          _logger.d('[API] RESPONSE ${response.requestOptions.method} ${response.requestOptions.uri} | Status: ${response.statusCode}');
          return handler.next(response);
        },
        onError: (err, handler) async {
          _logger.e('[API] ERROR ${err.requestOptions.method} ${err.requestOptions.uri} | Status: ${err.response?.statusCode} | Message: ${err.message}');

          final response = err.response;
          if (response?.statusCode == 401 && !_isAuthRequest(err.requestOptions)) {
            final requestOptions = err.requestOptions;

            if (_isRefreshing) {
              _logger.d('[API] Token refresh in progress, queuing request: ${requestOptions.path}');
              _failedRequestsQueue.add({
                'options': requestOptions,
                'handler': handler,
              });
              return;
            }

            _isRefreshing = true;
            _logger.d('[API] 401 received, attempting token refresh...');

            try {
              final newAccessToken = await _refreshAccessToken();
              if (newAccessToken != null) {
                _logger.d('[API] Token refreshed successfully. Retrying queued requests...');
                _isRefreshing = false;

                // Retry the current request
                requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                final response = await _retryRequest(requestOptions);
                handler.resolve(response);

                // Retry other queued requests
                for (final queued in _failedRequestsQueue) {
                  final queuedOptions = queued['options'] as RequestOptions;
                  final queuedHandler = queued['handler'] as ErrorInterceptorHandler;
                  queuedOptions.headers['Authorization'] = 'Bearer $newAccessToken';
                  try {
                    final resp = await _retryRequest(queuedOptions);
                    queuedHandler.resolve(resp);
                  } catch (retryErr) {
                    if (retryErr is DioException) {
                      queuedHandler.next(retryErr);
                    } else {
                      queuedHandler.reject(DioException(requestOptions: queuedOptions, error: retryErr));
                    }
                  }
                }
                _failedRequestsQueue.clear();
                return;
              }
            } catch (refreshErr) {
              _logger.e('[API] Token refresh failed with error: $refreshErr');
            }

            _isRefreshing = false;
            _failedRequestsQueue.clear();
            _logger.e('[API] Token refresh failed, clearing auth...');
            await _storageService.clearAuth();
            
            // Reject with a custom error message to notify the UI about session expiration
            return handler.reject(
              DioException(
                requestOptions: requestOptions,
                error: 'SESSION_EXPIRED',
                response: response,
              ),
            );
          }

          return handler.next(err);
        },
      ),
    );

    // Setup logging for public client as well
    publicDio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storageService.readSecure('access_token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          _logger.d('[Public API] REQUEST ${options.method} ${options.uri}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          _logger.d('[Public API] RESPONSE ${response.requestOptions.method} ${response.requestOptions.uri} | Status: ${response.statusCode}');
          return handler.next(response);
        },
        onError: (err, handler) {
          _logger.e('[Public API] ERROR ${err.requestOptions.method} ${err.requestOptions.uri} | Status: ${err.response?.statusCode}');
          return handler.next(err);
        },
      ),
    );
  }

  bool _isAuthRequest(RequestOptions options) {
    return options.path.contains('/auth/refresh') || options.path.contains('/auth/login') || options.path.contains('/oauth/token');
  }

  Future<String?> _refreshAccessToken() async {
    final refreshToken = await _storageService.readSecure('refresh_token');
    if (refreshToken == null) return null;

    final refreshDio = Dio(BaseOptions(
      baseUrl: dio.options.baseUrl,
      connectTimeout: dio.options.connectTimeout,
      receiveTimeout: dio.options.receiveTimeout,
    ));

    try {
      final response = await refreshDio.post(
        '/auth/refresh',
        data: {'device_type': 'mobile'},
        options: Options(
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $refreshToken',
          },
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        final access = data['access_token'] as String?;
        final refresh = data['refresh_token'] as String?;
        if (access != null) {
          await _storageService.writeSecure('access_token', access);
          if (refresh != null) {
            await _storageService.writeSecure('refresh_token', refresh);
          }
          return access;
        }
      }
    } catch (e) {
      _logger.e('[API] Failed to refresh token: $e');
    }
    return null;
  }

  Future<Response<dynamic>> _retryRequest(RequestOptions requestOptions) {
    final options = Options(
      method: requestOptions.method,
      headers: requestOptions.headers,
    );
    return dio.request<dynamic>(
      requestOptions.path,
      data: requestOptions.data,
      queryParameters: requestOptions.queryParameters,
      options: options,
    );
  }

  // --- REST HTTP Wrappers ---

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters, Options? options}) {
    return dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> post<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) {
    return dio.post<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> put<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) {
    return dio.put<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> delete<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters, Options? options}) {
    return dio.delete<T>(path, data: data, queryParameters: queryParameters, options: options);
  }

  // Multipart upload
  Future<Response<T>> upload<T>(String path, FormData formData, {Options? options}) {
    return dio.post<T>(
      path,
      data: formData,
      options: (options ?? Options()).copyWith(
        headers: {
          ...?options?.headers,
        },
      ),
    );
  }
}
