import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {useAppLogs} from '@/utils/appLogger';
import {crashLogger} from '@/utils/crashLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_VISIBLE_LOGS = 50;

function safeStringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[circular or non-serializable data]';
  }
}

export default function DebugLogPanel() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [crashLogs, setCrashLogs] = useState<any[]>([]);
  const [showCrashLogs, setShowCrashLogs] = useState(false);
  const logs = useAppLogs(state => state.logs);
  const clear = useAppLogs(state => state.clear);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem('detailed_logging')
      .then(val => {
        setEnabled(val === 'true');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;
    crashLogger.getLogs().then(setCrashLogs).catch(() => {});
  }, [visible, crashLogs.length]);

  if (!enabled) return null;

  const toggle = () => setVisible(v => !v);

  const copyLogs = () => {
    const appText = logs
      .map(
        l =>
          `[${l.timestamp}] [${l.tag}] ${l.message}${
            l.data !== undefined ? ` ${safeStringify(l.data)}` : ''
          }`,
      )
      .join('\n');
    const crashText = crashLogs
      .map(
        c =>
          `[${c.timestamp}] [CRASH:${c.screen}] ${c.error}${
            c.stack ? `\n${c.stack}` : ''
          }`,
      )
      .join('\n---\n');
    const text = [
      '=== APP LOGS ===',
      appText || 'Нет логов',
      '',
      '=== CRASH LOGS ===',
      crashText || 'Нет краш-логов',
    ].join('\n');
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clearAll = () => {
    clear();
    crashLogger.clearLogs().then(() => setCrashLogs([])).catch(() => {});
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggle}
        style={[
          styles.badge,
          {top: Math.max(insets.top + 8, 12), right: 8},
        ]}>
        <Text style={styles.badgeText}>LOGS {logs.length > 0 ? logs.length : ''}</Text>
      </TouchableOpacity>

      {visible && (
        <View
          style={[
            styles.overlay,
            {top: insets.top + 50, bottom: insets.bottom + 8},
          ]}>
          <View style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {showCrashLogs ? 'Crash logs' : 'Logs'} ({showCrashLogs ? crashLogs.length : logs.length})
              </Text>
              <View style={{flexDirection: 'row', gap: 16}}>
                <TouchableOpacity onPress={() => setShowCrashLogs(v => !v)}>
                  <Text style={styles.action}>{showCrashLogs ? 'App' : 'Crash'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={copyLogs}>
                  <Text style={styles.action}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.action}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={toggle}>
                  <Text style={styles.action}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{flex: 1}}>
              {showCrashLogs ? (
                crashLogs.length === 0 ? (
                  <Text style={styles.empty}>Нет краш-логов</Text>
                ) : (
                  crashLogs.slice(0, MAX_VISIBLE_LOGS).map((c, i) => (
                    <View key={i} style={styles.logRow}>
                      <Text style={styles.time}>
                        {c.timestamp?.split('T')[1]?.slice(0, 8)}
                      </Text>
                      <Text style={[styles.tag, {color: '#ff6b6b'}]}>
                        CRASH:{c.screen}
                      </Text>
                      <Text style={styles.msg}>{c.error}</Text>
                      {c.stack ? (
                        <Text style={styles.data}>{String(c.stack).slice(0, 400)}</Text>
                      ) : null}
                    </View>
                  ))
                )
              ) : logs.length === 0 ? (
                <Text style={styles.empty}>Нет логов</Text>
              ) : (
                logs.slice(0, MAX_VISIBLE_LOGS).map((l, i) => (
                  <View key={i} style={styles.logRow}>
                    <Text style={styles.time}>
                      {l.timestamp.split('T')[1]?.slice(0, 8)}
                    </Text>
                    <Text style={styles.tag}>{l.tag}</Text>
                    <Text style={styles.msg}>{l.message}</Text>
                    {l.data !== undefined && (
                      <Text style={styles.data}>
                        {safeStringify(l.data).slice(0, 250)}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    zIndex: 99999,
    backgroundColor: 'rgba(108,92,231,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    zIndex: 99999,
    elevation: 20,
  },
  panel: {
    flex: 1,
    backgroundColor: 'rgba(15,15,15,0.98)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  action: {
    color: '#6c5ce7',
    fontSize: 13,
  },
  empty: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  logRow: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  time: {
    color: '#888',
    fontSize: 10,
  },
  tag: {
    color: '#6c5ce7',
    fontSize: 11,
    fontWeight: 'bold',
  },
  msg: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  data: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 2,
  },
});
