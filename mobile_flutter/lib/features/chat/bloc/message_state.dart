import 'package:equatable/equatable.dart';

class ChatMessage extends Equatable {
  final String id;
  final String senderId;
  final String content;
  final String type; // 'text', 'voice', 'video_note'
  final dynamic attachments;
  final String? replyToId;
  final String timestamp;
  final bool isRead;
  final bool isEdited;
  final bool isE2ee;

  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.content,
    required this.type,
    this.attachments,
    this.replyToId,
    required this.timestamp,
    required this.isRead,
    required this.isEdited,
    required this.isE2ee,
  });

  ChatMessage copyWith({
    String? id,
    String? senderId,
    String? content,
    String? type,
    dynamic attachments,
    String? replyToId,
    String? timestamp,
    bool? isRead,
    bool? isEdited,
    bool? isE2ee,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      content: content ?? this.content,
      type: type ?? this.type,
      attachments: attachments ?? this.attachments,
      replyToId: replyToId ?? this.replyToId,
      timestamp: timestamp ?? this.timestamp,
      isRead: isRead ?? this.isRead,
      isEdited: isEdited ?? this.isEdited,
      isE2ee: isE2ee ?? this.isE2ee,
    );
  }

  @override
  List<Object?> get props => [
        id,
        senderId,
        content,
        type,
        attachments,
        replyToId,
        timestamp,
        isRead,
        isEdited,
        isE2ee,
      ];
}

abstract class MessageState extends Equatable {
  const MessageState();

  @override
  List<Object?> get props => [];
}

class MessageInitialState extends MessageState {}

class MessageLoadingState extends MessageState {}

class MessageLoadedState extends MessageState {
  final List<ChatMessage> messages;
  final bool isTyping;
  final bool secretChatEnabled;
  final bool isKeyExchangePending;
  final String? e2eKeyId;

  const MessageLoadedState({
    required this.messages,
    this.isTyping = false,
    this.secretChatEnabled = false,
    this.isKeyExchangePending = false,
    this.e2eKeyId,
  });

  MessageLoadedState copyWith({
    List<ChatMessage>? messages,
    bool? isTyping,
    bool? secretChatEnabled,
    bool? isKeyExchangePending,
    String? e2eKeyId,
  }) {
    return MessageLoadedState(
      messages: messages ?? this.messages,
      isTyping: isTyping ?? this.isTyping,
      secretChatEnabled: secretChatEnabled ?? this.secretChatEnabled,
      isKeyExchangePending: isKeyExchangePending ?? this.isKeyExchangePending,
      e2eKeyId: e2eKeyId ?? this.e2eKeyId,
    );
  }

  @override
  List<Object?> get props => [
        messages,
        isTyping,
        secretChatEnabled,
        isKeyExchangePending,
        e2eKeyId,
      ];
}

class MessageErrorState extends MessageState {
  final String message;

  const MessageErrorState(this.message);

  @override
  List<Object?> get props => [message];
}
