import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  final FlutterSecureStorage _secureStorage;
  late final SharedPreferences _sharedPrefs;
  bool _initialized = false;

  StorageService({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        );

  Future<void> init() async {
    if (_initialized) return;
    _sharedPrefs = await SharedPreferences.getInstance();
    _initialized = true;
  }

  // --- Secure Storage ---

  Future<void> writeSecure(String key, String value) async {
    await _secureStorage.write(key: key, value: value);
  }

  Future<String?> readSecure(String key) async {
    return await _secureStorage.read(key: key);
  }

  Future<void> deleteSecure(String key) async {
    await _secureStorage.delete(key: key);
  }

  // --- Unsecured SharedPreferences ---

  Future<void> writeString(String key, String value) async {
    await _sharedPrefs.setString(key, value);
  }

  String? readString(String key) {
    return _sharedPrefs.getString(key);
  }

  Future<void> writeBool(String key, bool value) async {
    await _sharedPrefs.setBool(key, value);
  }

  bool? readBool(String key) {
    return _sharedPrefs.getBool(key);
  }

  Future<void> remove(String key) async {
    await _sharedPrefs.remove(key);
  }

  // --- Helper Methods ---

  Future<void> clearAuth() async {
    await deleteSecure('access_token');
    await deleteSecure('refresh_token');
    await remove('user');
  }

  Future<void> clearAll() async {
    await clearAuth();
    await _secureStorage.deleteAll();
    await _sharedPrefs.clear();
  }
}
