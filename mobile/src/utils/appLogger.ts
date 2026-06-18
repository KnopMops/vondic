import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LogEntry {
  timestamp: string;
  tag: string;
  message: string;
  data?: any;
}

interface LogStore {
  logs: LogEntry[];
  addLog: (entry: LogEntry) => void;
  clear: () => void;
  loadPersisted: () => Promise<void>;
}

const PERSIST_KEY = '@vondic_app_logs';
const MAX_LOGS = 300;

export const useAppLogs = create<LogStore>(set => ({
  logs: [],
  addLog: entry =>
    set(state => {
      const next = [entry, ...state.logs].slice(0, MAX_LOGS);
      persistLogs(next).catch(() => {});
      return {logs: next};
    }),
  clear: () => {
    AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
    set({logs: []});
  },
  loadPersisted: async () => {
    try {
      const raw = await AsyncStorage.getItem(PERSIST_KEY);
      const parsed: LogEntry[] = raw ? JSON.parse(raw) : [];
      set(state => {
        const existingIds = new Set(state.logs.map(l => l.timestamp + l.tag + l.message));
        const merged = [
          ...state.logs,
          ...parsed.filter(l => !existingIds.has(l.timestamp + l.tag + l.message)),
        ]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, MAX_LOGS);
        return {logs: merged};
      });
    } catch {
      // keep whatever is already in memory
    }
  },
}));

async function persistLogs(logs: LogEntry[]) {
  try {
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(logs));
  } catch {
    // ignore persistence errors
  }
}

export function appLog(tag: string, message: string, data?: any) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    tag,
    message,
    data,
  };
  try {
    useAppLogs.getState().addLog(entry);
  } catch {}
  // eslint-disable-next-line no-console
  console.log(`[${tag}] ${message}`, data);
}

// Load persisted logs when the module is imported so the panel shows history after a restart.
useAppLogs.getState().loadPersisted().catch(() => {});
