import 'package:equatable/equatable.dart';
import '../models/user.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthInitializeEvent extends AuthEvent {}

class AuthFetchUserEvent extends AuthEvent {}

class AuthSetUserEvent extends AuthEvent {
  final User? user;
  const AuthSetUserEvent(this.user);

  @override
  List<Object?> get props => [user];
}

class AuthSetSocketIdEvent extends AuthEvent {
  final String socketId;
  const AuthSetSocketIdEvent(this.socketId);

  @override
  List<Object?> get props => [socketId];
}

class AuthLogoutEvent extends AuthEvent {}
