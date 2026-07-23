class CallState {
  final String socketId;
  final String userId;
  final String? userName;
  final String? avatarUrl;
  final String status; // 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed'
  final DateTime? startTime;
  final int duration; // in seconds
  final bool isGroupCall;
  final String? groupId;
  final String? callId;
  final bool isIncoming;

  CallState({
    required this.socketId,
    required this.userId,
    this.userName,
    this.avatarUrl,
    required this.status,
    this.startTime,
    this.duration = 0,
    this.isGroupCall = false,
    this.groupId,
    this.callId,
    this.isIncoming = false,
  });

  CallState copyWith({
    String? socketId,
    String? userId,
    String? userName,
    String? avatarUrl,
    String? status,
    DateTime? startTime,
    int? duration,
    bool? isGroupCall,
    String? groupId,
    String? callId,
    bool? isIncoming,
  }) {
    return CallState(
      socketId: socketId ?? this.socketId,
      userId: userId ?? this.userId,
      userName: userName ?? this.userName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      status: status ?? this.status,
      startTime: startTime ?? this.startTime,
      duration: duration ?? this.duration,
      isGroupCall: isGroupCall ?? this.isGroupCall,
      groupId: groupId ?? this.groupId,
      callId: callId ?? this.callId,
      isIncoming: isIncoming ?? this.isIncoming,
    );
  }
}

class CallRecord {
  final String id;
  final String callerId;
  final String callerName;
  final String receiverId;
  final String receiverName;
  final String type; // 'incoming' | 'outgoing' | 'missed'
  final int duration;
  final DateTime startTime;
  final DateTime endTime;
  final String status; // 'completed' | 'missed' | 'rejected'

  CallRecord({
    required this.id,
    required this.callerId,
    required this.callerName,
    required this.receiverId,
    required this.receiverName,
    required this.type,
    required this.duration,
    required this.startTime,
    required this.endTime,
    required this.status,
  });

  factory CallRecord.fromJson(Map<String, dynamic> json) {
    return CallRecord(
      id: json['id']?.toString() ?? '',
      callerId: json['callerId']?.toString() ?? '',
      callerName: json['callerName']?.toString() ?? '',
      receiverId: json['receiverId']?.toString() ?? '',
      receiverName: json['receiverName']?.toString() ?? '',
      type: json['type']?.toString() ?? 'incoming',
      duration: (json['duration'] as num?)?.toInt() ?? 0,
      startTime: DateTime.parse(json['startTime'] ?? DateTime.now().toIso8601String()),
      endTime: DateTime.parse(json['endTime'] ?? DateTime.now().toIso8601String()),
      status: json['status']?.toString() ?? 'completed',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'callerId': callerId,
      'callerName': callerName,
      'receiverId': receiverId,
      'receiverName': receiverName,
      'type': type,
      'duration': duration,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'status': status,
    };
  }
}
