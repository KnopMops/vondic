import {io, Socket} from 'socket.io-client';
import {Config} from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private lastError: string | null = null;
  private authSuccess = false;

  private log(...args: any[]) {
    console.log('[SocketService]', ...args);
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isAuthenticated(): boolean {
    return this.authSuccess;
  }

  async connect() {
    if (this.socket?.connected) {
      this.log('Already connected, socket id:', this.socket.id);
      return;
    }

    const token = await AsyncStorage.getItem('access_token');
    this.log('Connecting with token:', token ? 'present' : 'missing');
    this.lastError = null;
    this.authSuccess = false;

    const isSecure = Config.WS_URL.startsWith('wss://') || Config.WS_URL.startsWith('https://');

    this.socket = io(Config.WS_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: token ? {token} : undefined,
      query: token ? {token} : undefined,
      secure: isSecure,
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Re-register all persistent listeners on the new socket instance.
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        const wrapper = (...args: any[]) => {
          try {
            this.log('RECEIVE', event, JSON.stringify(args));
          } catch {
            this.log('RECEIVE', event, '[non-serializable payload]');
          }
          try {
            cb(...args);
          } catch (err) {
            console.error(`[SocketService] listener error for ${event}:`, err);
          }
        };
        (cb as any).__wrapper = wrapper;
        this.socket.on(event, wrapper);
      }
    }

    this.socket.on('connect', () => {
      this.log('CONNECTED, socket id:', this.socket?.id);
      // Дублируем аутентификацию событием authenticate — как делает frontend.
      // Если токен не дошёл через auth/query, сервер сможет аутентифицировать здесь.
      if (token) {
        this.log('EMIT authenticate after connect');
        this.socket?.emit('authenticate', {access_token: token});
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      this.log('DISCONNECTED, reason:', reason);
      this.authSuccess = false;
    });

    this.socket.on('connect_error', (err: any) => {
      const msg = err?.message || String(err);
      this.lastError = msg;
      this.log('CONNECT_ERROR:', msg, err);
    });

    this.socket.on('reconnect', (attempt: number) => {
      this.log('RECONNECTED after attempt:', attempt);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.log('RECONNECT_ATTEMPT:', attempt);
    });

    this.socket.on('reconnect_error', (err: any) => {
      const msg = err?.message || String(err);
      this.lastError = msg;
      this.log('RECONNECT_ERROR:', msg);
    });

    this.socket.on('error', (err: any) => {
      const msg = err?.message || String(err);
      this.lastError = msg;
      this.log('SOCKET_ERROR:', msg, err);
    });

    this.socket.on('connection_success', (data: any) => {
      this.log('CONNECTION_SUCCESS:', JSON.stringify(data));
      this.authSuccess = true;
      this.lastError = null;
    });

    // Presence / status events
    this.socket.on('user_status_change', (data: any) => {
      this.log('EVENT user_status_change:', JSON.stringify(data));
    });

    this.socket.on('presence_update', (data: any) => {
      this.log('EVENT presence_update:', JSON.stringify(data));
    });
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data?: any) {
    this.log('EMIT', event, JSON.stringify(data));
    if (!this.socket) {
      this.log('EMIT FAILED: socket is null');
      return;
    }
    if (!this.socket.connected) {
      this.log('EMIT FAILED: socket not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  on(event: string, callback: Function) {
    this.log('ON register:', event);
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      const wrapper = (...args: any[]) => {
        try {
          this.log('RECEIVE', event, JSON.stringify(args));
        } catch {
          this.log('RECEIVE', event, '[non-serializable payload]');
        }
        try {
          callback(...args);
        } catch (err) {
          console.error(`[SocketService] listener error for ${event}:`, err);
        }
      };
      (callback as any).__wrapper = wrapper;
      this.socket.on(event, wrapper);
    }
  }

  off(event: string, callback: Function) {
    this.log('OFF unregister:', event);
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
      if (this.listeners.get(event)!.size === 0) {
        this.listeners.delete(event);
      }
    }
    if (this.socket) {
      const wrapper = (callback as any).__wrapper;
      this.socket.off(event, wrapper || callback);
    }
  }

  disconnect() {
    this.log('DISCONNECT requested');
    this.authSuccess = false;
    this.socket?.disconnect();
    this.socket = null;
  }

  async reconnect() {
    this.log('RECONNECT requested');
    this.disconnect();
    await this.connect();
    // Re-register queued listeners
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.on(event, cb);
      }
    }
    this.listeners.clear();
  }
}

export const socketService = new SocketService();
