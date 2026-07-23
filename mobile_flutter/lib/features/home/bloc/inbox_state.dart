import 'package:equatable/equatable.dart';

class ChatPreview extends Equatable {
  final String id;
  final String name;
  final String? avatarUrl;
  final String type; // 'dm', 'group', 'channel'
  final String lastMessage;
  final int unreadCount;
  final String timestamp;
  final String? communityId;
  final bool isOnline;
  final bool isPinned;
  final int pinIndex;

  const ChatPreview({
    required this.id,
    required this.name,
    this.avatarUrl,
    required this.type,
    required this.lastMessage,
    required this.unreadCount,
    required this.timestamp,
    this.communityId,
    this.isOnline = false,
    this.isPinned = false,
    this.pinIndex = -1,
  });

  ChatPreview copyWith({
    String? id,
    String? name,
    String? avatarUrl,
    String? type,
    String? lastMessage,
    int? unreadCount,
    String? timestamp,
    String? communityId,
    bool? isOnline,
    bool? isPinned,
    int? pinIndex,
  }) {
    return ChatPreview(
      id: id ?? this.id,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      type: type ?? this.type,
      lastMessage: lastMessage ?? this.lastMessage,
      unreadCount: unreadCount ?? this.unreadCount,
      timestamp: timestamp ?? this.timestamp,
      communityId: communityId ?? this.communityId,
      isOnline: isOnline ?? this.isOnline,
      isPinned: isPinned ?? this.isPinned,
      pinIndex: pinIndex ?? this.pinIndex,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        avatarUrl,
        type,
        lastMessage,
        unreadCount,
        timestamp,
        communityId,
        isOnline,
        isPinned,
        pinIndex,
      ];
}

abstract class InboxState extends Equatable {
  const InboxState();

  @override
  List<Object?> get props => [];
}

class InboxInitialState extends InboxState {}

class InboxLoadingState extends InboxState {}

class InboxLoadedState extends InboxState {
  final List<ChatPreview> chats;
  final List<dynamic> communities;

  const InboxLoadedState({
    required this.chats,
    this.communities = const [],
  });

  @override
  List<Object?> get props => [chats, communities];
}

class InboxErrorState extends InboxState {
  final String message;

  const InboxErrorState(this.message);

  @override
  List<Object?> get props => [message];
}
