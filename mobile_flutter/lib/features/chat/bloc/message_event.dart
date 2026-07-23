import 'package:equatable/equatable.dart';

abstract class MessageEvent extends Equatable {
  const MessageEvent();

  @override
  List<Object?> get props => [];
}

class MessageLoadHistoryEvent extends MessageEvent {
  final String? targetUserId;
  final String? groupId;
  final String? channelId;

  const MessageLoadHistoryEvent({this.targetUserId, this.groupId, this.channelId});

  @override
  List<Object?> get props => [targetUserId, groupId, channelId];
}

class MessageSendEvent extends MessageEvent {
  final String content;
  final String type; // 'text', 'voice', 'video_note'
  final List<dynamic>? attachments;
  final String? replyToId;

  const MessageSendEvent({
    required this.content,
    this.type = 'text',
    this.attachments,
    this.replyToId,
  });

  @override
  List<Object?> get props => [content, type, attachments, replyToId];
}

class MessageReceiveEvent extends MessageEvent {
  final dynamic messageData;

  const MessageReceiveEvent(this.messageData);

  @override
  List<Object?> get props => [messageData];
}

class MessageDeleteEvent extends MessageEvent {
  final String messageId;

  const MessageDeleteEvent(this.messageId);

  @override
  List<Object?> get props => [messageId];
}

class MessageEditEvent extends MessageEvent {
  final String messageId;
  final String newContent;

  const MessageEditEvent(this.messageId, this.newContent);

  @override
  List<Object?> get props => [messageId, newContent];
}

class MessageSendTypingEvent extends MessageEvent {}

class MessageReceivedTypingEvent extends MessageEvent {
  final String senderId;
  final bool isTyping;

  const MessageReceivedTypingEvent(this.senderId, this.isTyping);

  @override
  List<Object?> get props => [senderId, isTyping];
}

class MessageToggleE2eEvent extends MessageEvent {
  final bool enabled;
 
  const MessageToggleE2eEvent(this.enabled);
 
  @override
  List<Object?> get props => [enabled];
}

class MessageReadUpdateEvent extends MessageEvent {
  final Map<String, dynamic> data;
  const MessageReadUpdateEvent(this.data);

  @override
  List<Object?> get props => [data];
}
