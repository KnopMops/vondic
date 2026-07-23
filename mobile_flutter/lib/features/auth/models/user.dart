import '../../../core/utils/url_helper.dart';

class User {
  final String id;
  final String email;
  final String username;
  final String role;
  final bool isBot;
  final String? avatarUrl;
  final String? displayName;
  final String? handle;
  final String? registeredAt;
  final String? lastSeen;
  final String? description;
  final String? birthDate;
  final String? socketId;
  final String? status;
  final bool premium;
  final String? premiumExpiredAt;
  final double balance;
  final double diskUsage;
  final double diskLimit;
  final double storageBonus;
  final String? profileBgTheme;
  final String? profileBgGradient;
  final String? profileBgImage;
  final bool isBlocked;
  final bool isDeveloper;
  final String? videoChannelId;

  String? get fullAvatarUrl => avatarUrl?.toAbsoluteUrl;

  User({
    required this.id,
    required this.email,
    required this.username,
    required this.role,
    this.isBot = false,
    this.avatarUrl,
    this.displayName,
    this.handle,
    this.registeredAt,
    this.lastSeen,
    this.description,
    this.birthDate,
    this.socketId,
    this.status,
    this.premium = false,
    this.premiumExpiredAt,
    this.balance = 0.0,
    this.diskUsage = 0.0,
    this.diskLimit = 0.0,
    this.storageBonus = 0.0,
    this.profileBgTheme,
    this.profileBgGradient,
    this.profileBgImage,
    this.isBlocked = false,
    this.isDeveloper = false,
    this.videoChannelId,
  });

  User copyWith({
    String? id,
    String? email,
    String? username,
    String? role,
    bool? isBot,
    String? avatarUrl,
    String? displayName,
    String? handle,
    String? registeredAt,
    String? lastSeen,
    String? description,
    String? birthDate,
    String? socketId,
    String? status,
    bool? premium,
    String? premiumExpiredAt,
    double? balance,
    double? diskUsage,
    double? diskLimit,
    double? storageBonus,
    String? profileBgTheme,
    String? profileBgGradient,
    String? profileBgImage,
    bool? isBlocked,
    bool? isDeveloper,
    String? videoChannelId,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      username: username ?? this.username,
      role: role ?? this.role,
      isBot: isBot ?? this.isBot,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      displayName: displayName ?? this.displayName,
      handle: handle ?? this.handle,
      registeredAt: registeredAt ?? this.registeredAt,
      lastSeen: lastSeen ?? this.lastSeen,
      description: description ?? this.description,
      birthDate: birthDate ?? this.birthDate,
      socketId: socketId ?? this.socketId,
      status: status ?? this.status,
      premium: premium ?? this.premium,
      premiumExpiredAt: premiumExpiredAt ?? this.premiumExpiredAt,
      balance: balance ?? this.balance,
      diskUsage: diskUsage ?? this.diskUsage,
      diskLimit: diskLimit ?? this.diskLimit,
      storageBonus: storageBonus ?? this.storageBonus,
      profileBgTheme: profileBgTheme ?? this.profileBgTheme,
      profileBgGradient: profileBgGradient ?? this.profileBgGradient,
      profileBgImage: profileBgImage ?? this.profileBgImage,
      isBlocked: isBlocked ?? this.isBlocked,
      isDeveloper: isDeveloper ?? this.isDeveloper,
      videoChannelId: videoChannelId ?? this.videoChannelId,
    );
  }

  static bool _parseBool(dynamic val) {
    if (val == null) return false;
    if (val is bool) return val;
    if (val is num) return val != 0;
    if (val is String) {
      final s = val.trim().toLowerCase();
      return s == 'true' || s == '1';
    }
    return false;
  }

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      isBot: _parseBool(json['is_bot']),
      avatarUrl: json['avatar_url']?.toString(),
      displayName: json['displayName']?.toString() ?? json['display_name']?.toString(),
      handle: json['handle']?.toString(),
      registeredAt: json['registeredAt']?.toString() ?? json['registered_at']?.toString(),
      lastSeen: json['last_seen']?.toString(),
      description: json['description']?.toString(),
      birthDate: json['birth_date']?.toString(),
      socketId: json['socket_id']?.toString(),
      status: json['status']?.toString(),
      premium: _parseBool(json['premium']),
      premiumExpiredAt: json['premium_expired_at']?.toString(),
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      diskUsage: (json['disk_usage'] as num?)?.toDouble() ?? 0.0,
      diskLimit: (json['disk_limit'] as num?)?.toDouble() ?? 0.0,
      storageBonus: (json['storage_bonus'] as num?)?.toDouble() ?? 0.0,
      profileBgTheme: json['profile_bg_theme']?.toString(),
      profileBgGradient: json['profile_bg_gradient']?.toString(),
      profileBgImage: json['profile_bg_image']?.toString(),
      isBlocked: _parseBool(json['is_blocked']),
      isDeveloper: _parseBool(json['is_developer']),
      videoChannelId: json['video_channel_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'role': role,
      'is_bot': isBot,
      'avatar_url': avatarUrl,
      'displayName': displayName,
      'handle': handle,
      'registeredAt': registeredAt,
      'last_seen': lastSeen,
      'description': description,
      'birth_date': birthDate,
      'socket_id': socketId,
      'status': status,
      'premium': premium,
      'premium_expired_at': premiumExpiredAt,
      'balance': balance,
      'disk_usage': diskUsage,
      'disk_limit': diskLimit,
      'storage_bonus': storageBonus,
      'profile_bg_theme': profileBgTheme,
      'profile_bg_gradient': profileBgGradient,
      'profile_bg_image': profileBgImage,
      'is_blocked': isBlocked,
      'is_developer': isDeveloper,
      'video_channel_id': videoChannelId,
    };
  }
}
