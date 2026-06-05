import AsyncStorage from '@react-native-async-storage/async-storage';

const CRASH_LOG_KEY = '@vondic_crash_logs';
const MAX_LOGS = 50;

interface CrashLog {
  id: string;
  timestamp: string;
  screen?: string;
  error: string;
  stack?: string;
  context?: Record<string, any>;
}

export const crashLogger = {
  async logCrash(error: any, screen?: string, context?: Record<string, any>) {
    const entry: CrashLog = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      screen,
      error: error?.message || String(error),
      stack: error?.stack,
      context,
    };

    try {
      const existing = await AsyncStorage.getItem(CRASH_LOG_KEY);
      const logs: CrashLog[] = existing ? JSON.parse(existing) : [];
      logs.unshift(entry);
      if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
      await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('[CrashLogger] Failed to save log:', e);
    }

    console.error('[CRASH]', screen || 'GLOBAL', entry.error, context);
  },

  async getLogs(): Promise<CrashLog[]> {
    try {
      const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async clearLogs() {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  },

  setupGlobalHandler() {
    const ErrorUtils = (global as any).ErrorUtils;
    if (!ErrorUtils) {
      console.warn('[CrashLogger] ErrorUtils not available');
      return;
    }

    const originalHandler = ErrorUtils.getGlobalHandler?.();

    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      const fatality = isFatal ? 'FATAL' : 'NON_FATAL';
      this.logCrash(error, `GLOBAL_${fatality}`, {
        isFatal: !!isFatal,
        jsThread: true,
      });
      if (originalHandler) originalHandler(error, isFatal);
    });

    // Also catch unhandled promise rejections
    const origRejectionTracker = ErrorUtils._unhandledRejectionTracker;
    ErrorUtils._unhandledRejectionTracker = function(id: any, error: any) {
      crashLogger.logCrash(error, 'UNHANDLED_PROMISE', {rejectionId: id});
      if (origRejectionTracker) origRejectionTracker.apply(this, arguments as any);
    };

    console.log('[CrashLogger] Global handlers installed');
  },
};
