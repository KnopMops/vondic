import 'package:equatable/equatable.dart';
import '../models/user.dart';

class AuthState extends Equatable {
  final bool isInitialized;
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isInitialized = false,
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isInitialized,
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isInitialized: isInitialized ?? this.isInitialized,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }

  @override
  List<Object?> get props => [isInitialized, user, isLoading, error];
}
