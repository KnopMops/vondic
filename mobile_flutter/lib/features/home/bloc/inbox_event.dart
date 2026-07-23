import 'package:equatable/equatable.dart';

abstract class InboxEvent extends Equatable {
  const InboxEvent();

  @override
  List<Object?> get props => [];
}

class InboxLoadEvent extends InboxEvent {}

class InboxUpdateLastMessageEvent extends InboxEvent {
  final String chatId;
  final String messageText;
  final String timestamp;
  final String type; // 'dm', 'group', 'channel'

  const InboxUpdateLastMessageEvent({
    required this.chatId,
    required this.messageText,
    required this.timestamp,
    required this.type,
  });

  @override
  List<Object?> get props => [chatId, messageText, timestamp, type];
}

class InboxUserStatusChangedEvent extends InboxEvent {
  final String userId;
  final bool isOnline;

  const InboxUserStatusChangedEvent({
    required this.userId,
    required this.isOnline,
  });

  @override
  List<Object?> get props => [userId, isOnline];
}

class InboxTogglePinChatEvent extends InboxEvent {
  final String chatId;
  const InboxTogglePinChatEvent(this.chatId);

  @override
  List<Object?> get props => [chatId];
}

class InboxMovePinnedChatEvent extends InboxEvent {
  final String chatId;
  final bool moveUp;
  const InboxMovePinnedChatEvent(this.chatId, {required this.moveUp});

  @override
  List<Object?> get props => [chatId, moveUp];
}

class InboxSetPinnedChatsEvent extends InboxEvent {
  final List<String> pinnedChatIds;
  const InboxSetPinnedChatsEvent(this.pinnedChatIds);

  @override
  List<Object?> get props => [pinnedChatIds];
}
