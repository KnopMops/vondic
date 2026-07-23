import 'dart:convert';
import 'package:logger/logger.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/config.dart';
import '../utils/storage_service.dart';

class SocketService {
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));
  
  IO.Socket? _socket;
  final Map<String, Set<Function>> _listeners = {};
  String? _lastError;
  bool _authSuccess = false;
  String? _currentToken;

  SocketService(this._storageService);

  String? getLastError() => _lastError;
  bool isAuthenticated() => _authSuccess;
  IO.Socket? getSocket() => _socket;

  Future<void> connect() async {
    final token = await _storageService.readSecure('access_token');

    if (_socket != null && _socket!.connected && _currentToken == token && _authSuccess) {
      _logger.d('[SocketService] Already connected and authenticated with current token');
      return;
    }

    _logger.d('[SocketService] Connecting. Token changed: ${_currentToken != token}, AuthSuccess: $_authSuccess');

    if (_socket != null) {
      disconnect();
    }

    _currentToken = token;
    _lastError = null;
    _authSuccess = false;

    final options = IO.OptionBuilder()
        .setPath('/socket.io')
        .setTransports(['websocket'])
        .enableForceNew()
        .enableAutoConnect()
        .setReconnectionDelay(1000)
        .setReconnectionDelayMax(5000)
        .setTimeout(10000);

    if (token != null) {
      options.setAuth({'token': token});
      options.setQuery({'token': token});
    }

    _socket = IO.io(AppConfig.wsUrl, options.build());

    // Re-register persistent listeners on the new socket
    _listeners.forEach((event, callbacks) {
      _socket!.on(event, (data) {
        _logger.d('[SocketService] RECEIVE $event: ${jsonEncode(data)}');
        final list = List<Function>.from(_listeners[event] ?? []);
        for (final cb in list) {
          try {
            cb(data);
          } catch (e) {
            _logger.e('[SocketService] Listener error for $event: $e');
          }
        }
      });
    });

    _socket!.onConnect((_) {
      _logger.d('[SocketService] CONNECTED, socket ID: ${_socket?.id}');
      if (token != null) {
        _logger.d('[SocketService] EMIT authenticate after connect');
        _socket?.emit('authenticate', {'access_token': token});
      }
    });

    _socket!.onDisconnect((reason) {
      _logger.d('[SocketService] DISCONNECTED, reason: $reason');
      _authSuccess = false;
    });

    _socket!.onConnectError((err) {
      _lastError = err?.toString();
      _logger.e('[SocketService] CONNECT_ERROR: $err');
    });

    _socket!.onError((err) {
      _lastError = err?.toString();
      _logger.e('[SocketService] SOCKET_ERROR: $err');
    });

    _socket!.on('connection_success', (data) {
      _logger.d('[SocketService] CONNECTION_SUCCESS: ${jsonEncode(data)}');
      _authSuccess = true;
      _lastError = null;
    });

    _socket!.on('user_status_changed', (data) {
      _logger.d('[SocketService] user_status_changed: ${jsonEncode(data)}');
    });

    _socket!.on('presence_update', (data) {
      _logger.d('[SocketService] presence_update: ${jsonEncode(data)}');
    });
  }

  void emit(String event, [dynamic data]) {
    if (_socket == null) {
      _logger.w('[SocketService] EMIT FAILED: socket is null');
      return;
    }
    if (!_socket!.connected) {
      _logger.w('[SocketService] EMIT FAILED: socket not connected');
      return;
    }
    _logger.d('[SocketService] EMIT $event: ${jsonEncode(data)}');
    _socket!.emit(event, data);
  }

  void on(String event, Function callback) {
    _logger.d('[SocketService] Register listener: $event');
    final callbacks = _listeners.putIfAbsent(event, () => <Function>{});
    final isNew = callbacks.isEmpty;
    callbacks.add(callback);

    if (_socket != null && isNew) {
      _socket!.on(event, (data) {
        _logger.d('[SocketService] RECEIVE $event: ${jsonEncode(data)}');
        final list = List<Function>.from(_listeners[event] ?? []);
        for (final cb in list) {
          try {
            cb(data);
          } catch (e) {
            _logger.e('[SocketService] Listener error for $event: $e');
          }
        }
      });
    }
  }

  void off(String event, Function callback) {
    _logger.d('[SocketService] Unregister listener: $event');
    if (_listeners.containsKey(event)) {
      _listeners[event]!.remove(callback);
      if (_listeners[event]!.isEmpty) {
        _listeners.remove(event);
        if (_socket != null) {
          _socket!.off(event);
        }
      }
    }
  }

  void disconnect() {
    _logger.d('[SocketService] Disconnect requested');
    _authSuccess = false;
    _currentToken = null;
    _socket?.disconnect();
    _socket = null;
  }

  Future<void> reconnect() async {
    _logger.d('[SocketService] Reconnect requested');
    disconnect();
    await connect();
  }
}
