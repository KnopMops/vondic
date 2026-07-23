import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'features/auth/services/oauth_service.dart';
import 'core/network/api_client.dart';
import 'core/socket/socket_service.dart';
import 'core/utils/push_service.dart';
import 'core/utils/storage_service.dart';
import 'core/webrtc/call_manager.dart';
import 'core/webrtc/webrtc_service.dart';
import 'crypto/key_sync_service.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/bloc/auth_state.dart';
import 'features/auth/bloc/auth_event.dart';
import 'features/calls/bloc/call_bloc.dart';
import 'features/calls/bloc/call_event.dart';
import 'features/calls/bloc/call_state.dart';
import 'features/home/bloc/inbox_bloc.dart';
import 'features/home/bloc/inbox_event.dart';

import 'features/auth/views/splash_screen.dart';
import 'features/auth/views/login_screen.dart';
import 'features/chat/views/chat_screen.dart';
import 'features/calls/views/call_screen.dart';
import 'features/home/views/home_shell.dart';
import 'features/qr/views/qr_scan_screen.dart';
import 'features/friends/views/friends_screen.dart';
import 'features/mail/views/mail_screen.dart';
import 'features/settings/views/settings_screen.dart';
import 'features/settings/views/privacy_screen.dart';
import 'features/settings/views/sessions_screen.dart';
import 'features/settings/views/storage_screen.dart';
import 'features/communities/views/communities_list_screen.dart';
import 'features/communities/views/community_detail_screen.dart';
import 'features/support/views/support_chat_screen.dart';
import 'features/support/views/support_tickets_screen.dart';

class VondicApp extends StatefulWidget {
  final StorageService storageService;
  final ApiClient apiClient;
  final KeySyncService keySyncService;
  final SocketService socketService;
  final WebRTCService webRTCService;
  final CallManager callManager;
  final PushService pushService;

  const VondicApp({
    super.key,
    required this.storageService,
    required this.apiClient,
    required this.keySyncService,
    required this.socketService,
    required this.webRTCService,
    required this.callManager,
    required this.pushService,
  });

  @override
  State<VondicApp> createState() => _VondicAppState();
}

class _VondicAppState extends State<VondicApp> {
  late final GoRouter _router;
  late final AuthBloc _authBloc;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();

    _authBloc = AuthBloc(
      widget.apiClient,
      widget.storageService,
    )..add(AuthInitializeEvent());
    
    // Initialize global Deep Linking listeners
    final appLinks = AppLinks();
    _linkSubscription = appLinks.uriLinkStream.listen((uri) {
      _handleDeepLink(uri);
    });
    
    _router = GoRouter(
      initialLocation: '/splash',
      redirect: (context, state) {
        final authState = _authBloc.state;
        if (!authState.isInitialized) return null;

        final loggingIn = state.matchedLocation == '/login';
        final onSplash = state.matchedLocation == '/splash';
        final isAnonSupport = state.matchedLocation.startsWith('/support/anon');

        if (authState.user == null) {
          if (loggingIn || isAnonSupport) return null;
          return '/login';
        }

        if (loggingIn || onSplash) {
          return '/home';
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/splash',
          builder: (context, state) => const SplashScreen(),
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/home',
          builder: (context, state) => const HomeShell(),
        ),
        GoRoute(
          path: '/chat/:type/:id/:name',
          builder: (context, state) {
            final type = state.pathParameters['type'] ?? 'dm';
            final id = state.pathParameters['id'] ?? '';
            final name = state.pathParameters['name'] ?? 'Чат';
            final avatarUrl = state.uri.queryParameters['avatarUrl'];
            return ChatScreen(type: type, id: id, name: name, avatarUrl: avatarUrl);
          },
        ),
        GoRoute(
          path: '/call',
          builder: (context, state) => const CallScreen(),
        ),
        GoRoute(
          path: '/qr-scan',
          builder: (context, state) => const QRScanScreen(),
        ),
        GoRoute(
          path: '/friends',
          builder: (context, state) => const FriendsScreen(),
        ),
        GoRoute(
          path: '/mail',
          builder: (context, state) => const MailScreen(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const SettingsScreen(),
        ),
        GoRoute(
          path: '/settings/privacy',
          builder: (context, state) => const PrivacyScreen(),
        ),
        GoRoute(
          path: '/settings/sessions',
          builder: (context, state) => const SessionsScreen(),
        ),
        GoRoute(
          path: '/settings/storage',
          builder: (context, state) => const StorageScreen(),
        ),
        GoRoute(
          path: '/communities',
          builder: (context, state) => const CommunitiesListScreen(),
        ),
        GoRoute(
          path: '/communities/:id',
          builder: (context, state) {
            final id = state.pathParameters['id'] ?? '';
            return CommunityDetailScreen(id: id);
          },
        ),
        GoRoute(
          path: '/support',
          builder: (context, state) => const SupportTicketsScreen(),
        ),
        GoRoute(
          path: '/support/ticket/:id',
          builder: (context, state) {
            final id = state.pathParameters['id'] ?? '';
            return SupportChatScreen(isAnon: false, escalationId: id);
          },
        ),
        GoRoute(
          path: '/support/anon/:id/:token',
          builder: (context, state) {
            final id = state.pathParameters['id'];
            final token = state.pathParameters['token'];
            return SupportChatScreen(isAnon: true, escalationId: id, anonToken: token);
          },
        ),
      ],
    );

    // Setup global navigation callback for PushService
    widget.pushService.onNavigate = (screen, params) {
      if (screen == 'Call') {
        _router.push('/call');
      } else if (screen == 'Chat') {
        final type = params['type'] ?? 'dm';
        final id = params['id'] ?? '';
        final name = params['name'] ?? 'Чат';
        _router.push('/chat/$type/$id/$name');
      }
    };
  }

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: widget.storageService),
        RepositoryProvider.value(value: widget.apiClient),
        RepositoryProvider.value(value: widget.keySyncService),
        RepositoryProvider.value(value: widget.socketService),
        RepositoryProvider.value(value: widget.webRTCService),
        RepositoryProvider.value(value: widget.callManager),
        RepositoryProvider.value(value: widget.pushService),
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider.value(
            value: _authBloc,
          ),
          BlocProvider(
            create: (context) => CallBloc(
              widget.callManager,
              widget.webRTCService,
            ),
          ),
          BlocProvider(
            create: (context) => InboxBloc(
              widget.apiClient,
              widget.socketService,
              widget.storageService,
              widget.keySyncService,
            ),
          ),
        ],
        child: MultiBlocListener(
          listeners: [
            BlocListener<AuthBloc, AuthState>(
              listener: (context, state) {
                // Trigger routing redirect on auth change
                _router.refresh();

                // Connect socket and initialize call properties when authenticated
                if (state.user != null) {
                  widget.socketService.connect();
                  widget.pushService.initialize(state.user!.id);
                  context.read<CallBloc>().add(CallInitializeEvent(
                    userId: state.user!.id,
                    userName: state.user!.displayName ?? state.user!.username,
                    avatarUrl: state.user!.avatarUrl,
                  ));
                  context.read<InboxBloc>().add(InboxLoadEvent());
                } else {
                  widget.socketService.disconnect();
                  context.read<CallBloc>().add(const CallInitializeEvent(userId: '', userName: ''));
                }
              },
            ),
            BlocListener<CallBloc, CallBlocState>(
              listenWhen: (previous, current) {
                final becameIncoming = previous.incomingCall == null && current.incomingCall != null;
                final becameOutgoing = previous.activeCalls.isEmpty && 
                                       current.activeCalls.isNotEmpty && 
                                       current.incomingCall == null;
                return becameIncoming || becameOutgoing;
              },
              listener: (context, state) {
                debugPrint('[CallManager] Call detected, navigating to CallScreen');
                final currentLoc = _router.routerDelegate.currentConfiguration.uri.path;
                if (currentLoc != '/call') {
                  _router.push('/call');
                }
              },
            ),
          ],
          child: MaterialApp.router(
            title: 'Vondic',
            theme: ThemeData.dark().copyWith(
              scaffoldBackgroundColor: const Color(0xFF0F0F0F),
              colorScheme: const ColorScheme.dark(
                primary: Color(0xFF6C5CE7),
                secondary: Color(0xFF6C5CE7),
                surface: Color(0xFF1C1C1E),
              ),
              appBarTheme: const AppBarTheme(
                backgroundColor: Color(0xFF1C1C1E),
                elevation: 0,
              ),
              dialogTheme: DialogThemeData(
                backgroundColor: const Color(0xFF1C1C1E),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            routerConfig: _router,
          ),
        ),
      ),
    );
  }

  void _handleDeepLink(Uri uri) async {
    debugPrint('[DeepLink] Received uri: $uri');
    if (uri.scheme == 'vondic') {
      final code = uri.queryParameters['code'];
      final state = uri.queryParameters['state'];
      if (code != null) {
        try {
          final oauthService = OAuthService(widget.apiClient, widget.storageService);
          final user = await oauthService.handleCodeExchange(code, state ?? '');
          if (user != null && mounted) {
            _authBloc.add(AuthSetUserEvent(user));
          } else {
            _showErrorSnackBar('Не удалось получить данные пользователя.');
          }
        } catch (e) {
          debugPrint('[DeepLink] OAuth code exchange error: $e');
          _showErrorSnackBar('Ошибка авторизации: $e');
        }
      }
    }
  }

  void _showErrorSnackBar(String message) {
    final currentContext = _router.routerDelegate.navigatorKey.currentContext;
    if (currentContext != null) {
      ScaffoldMessenger.of(currentContext).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    _authBloc.close();
    super.dispose();
  }
}
