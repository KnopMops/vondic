import 'dart:convert';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/storage_service.dart';
import '../models/user.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final ApiClient _apiClient;
  final StorageService _storageService;

  AuthBloc(this._apiClient, this._storageService) : super(const AuthState()) {
    on<AuthInitializeEvent>(_onInitialize);
    on<AuthFetchUserEvent>(_onFetchUser);
    on<AuthSetUserEvent>(_onSetUser);
    on<AuthSetSocketIdEvent>(_onSetSocketId);
    on<AuthLogoutEvent>(_onLogout);
  }

  Future<void> _onInitialize(
    AuthInitializeEvent event,
    Emitter<AuthState> emit,
  ) async {
    final cachedUserRaw = _storageService.readString('user');
    User? cachedUser;
    if (cachedUserRaw != null) {
      try {
        cachedUser = User.fromJson(jsonDecode(cachedUserRaw));
      } catch (_) {}
    }

    final token = await _storageService.readSecure('access_token');
    if (token == null) {
      // Unauthenticated
      emit(const AuthState(isInitialized: true));
      return;
    }

    // We have a token, start fetching user but immediately restore cache if available
    emit(AuthState(
      user: cachedUser,
      isInitialized: cachedUser != null,
      isLoading: true,
    ));

    add(AuthFetchUserEvent());
  }

  Future<void> _onFetchUser(
    AuthFetchUserEvent event,
    Emitter<AuthState> emit,
  ) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/auth/me');
      final userData = response.data?['user'];
      if (userData != null) {
        final user = User.fromJson(userData);
        await _storageService.writeString('user', jsonEncode(user.toJson()));
        emit(AuthState(user: user, isInitialized: true, isLoading: false));
      } else {
        throw Exception('Invalid user data received');
      }
    } catch (err) {
      final isSessionExpired = err.toString().contains('SESSION_EXPIRED') ||
          err.toString().toLowerCase().contains('unauthorized');

      if (isSessionExpired) {
        await _storageService.clearAuth();
        emit(const AuthState(isInitialized: true, user: null, isLoading: false));
      } else {
        // Network error, fall back to cached user if we have one
        if (state.user != null) {
          emit(AuthState(
            user: state.user,
            isInitialized: true,
            isLoading: false,
          ));
        } else {
          emit(AuthState(
            isInitialized: true,
            error: err.toString(),
            isLoading: false,
          ));
        }
      }
    }
  }

  Future<void> _onSetUser(
    AuthSetUserEvent event,
    Emitter<AuthState> emit,
  ) async {
    if (event.user != null) {
      await _storageService.writeString('user', jsonEncode(event.user!.toJson()));
    } else {
      await _storageService.remove('user');
    }
    emit(state.copyWith(user: event.user, isInitialized: true));
  }

  Future<void> _onSetSocketId(
    AuthSetSocketIdEvent event,
    Emitter<AuthState> emit,
  ) async {
    if (state.user != null) {
      final updatedUser = state.user!.copyWith(socketId: event.socketId);
      await _storageService.writeString('user', jsonEncode(updatedUser.toJson()));
      emit(state.copyWith(user: updatedUser));
    }
  }

  Future<void> _onLogout(
    AuthLogoutEvent event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(isLoading: true));
    await _storageService.clearAuth();
    emit(const AuthState(isInitialized: true, user: null));
  }
}
