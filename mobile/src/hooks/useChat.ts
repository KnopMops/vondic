import {useCallback, useEffect, useRef, useState} from 'react';
import {socketService} from '@/services/SocketService';
import {Message} from '@/types';
import {
  subtle,
  mtEncrypt,
  mtDecrypt,
  base64FromBytes,
  bytesFromBase64,
  type CryptoKey,
  type CryptoKeyPair,
} from '@/utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  backupKeyToServer,
  restoreKeyFromServer,
  restoreAllKeysFromServer,
  beginServerKeysRestore,
  ensureBackupMaterial,
  getDeviceInfo,
  normalizeE2eKeyId,
  getE2eKeyIdVariants,
  expandKeyIdVariants,
  lookupCachedServerKey,
  persistKeyLocally,
  resetE2eRestoreCache,
  resetServerKeyRestoreResults,
} from '@/utils/e2eKeySync';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';
import {appLog} from '@/utils/appLogger';

const hasCryptoSubtle = () => typeof subtle !== 'undefined' && subtle != null;
const HISTORY_PAGE_SIZE = 30;

/** Превью E2E в списке чатов (несколько вариантов key_id). */
export const tryDecryptE2EPreviewWithKeyIds = async (
  ciphertext: string,
  keyIds: string[],
): Promise<string | null> => {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  if (!ciphertext.startsWith('e2e:')) return ciphertext;
  for (const keyId of keyIds) {
    const normalized = String(keyId || '').trim();
    if (!normalized) continue;
    const stored = await AsyncStorage.getItem(`e2e_key_${normalized}`);
    if (!stored) continue;
    try {
      const key = bytesFromBase64(stored);
      const decrypted = mtDecrypt(ciphertext, key);
      if (decrypted !== null && decrypted.trim() !== '') return decrypted;
    } catch {
      continue;
    }
  }
  return null;
};

export const useChat = (
  targetUserId: string | undefined,
  channelId?: string | undefined,
  groupId?: string | undefined,
  initialSecretChatEnabled = false,
) => {
  appLog('useChat', 'hook start', {targetUserId, channelId, groupId, initialSecretChatEnabled});
  const {user} = useAppSelector(state => state.auth);
  const currentUserId = user?.id;
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('access_token')
      .then(token => {
        if (!cancelled) setAccessToken(token);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const [secretChatEnabled, setSecretChatEnabled] = useState(initialSecretChatEnabled);

  useEffect(() => {
    setSecretChatEnabled(initialSecretChatEnabled);
  }, [initialSecretChatEnabled]);

  useEffect(() => {
    if (!targetUserId || !accessToken) {
      return;
    }
    let active = true;
    apiClient
      .get<{is_secret?: boolean}>(`/dm/${targetUserId}/settings`)
      .then(res => {
        if (active && res) {
          setSecretChatEnabled(Boolean(res.is_secret));
        }
      })
      .catch(err => {
        console.warn('[useChat] Failed to fetch DM settings:', err);
      });
    return () => {
      active = false;
    };
  }, [targetUserId, accessToken]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [keysVersion, setKeysVersion] = useState(0);
  const typingTimeoutRef = useRef<any>(null);
  const e2eKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  const e2ePairsRef = useRef<Map<string, CryptoKeyPair>>(new Map());
  const loadStoredKeyAttemptedRef = useRef<Set<string>>(new Set());
  const keyExchangeStartedRef = useRef<Set<string>>(new Set());
  const e2ePendingRef = useRef<
    Map<
      string,
      Array<{
        content: string;
        type: 'text' | 'voice' | 'video_note';
        attachments?: any[];
        replyToId?: string;
      }>
    >
  >(new Map());

  const e2eKeyId =
    targetUserId && currentUserId
      ? [currentUserId, targetUserId].sort().join(':')
      : null;

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(false);
  }, [targetUserId, groupId, channelId]);

  const hydrateKeysFromLocalStorage = useCallback(async () => {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const storageKey of allKeys) {
      if (!storageKey.startsWith('e2e_key_')) continue;
      const keyId = storageKey.slice('e2e_key_'.length);
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored) {
          e2eKeysRef.current.set(keyId, bytesFromBase64(stored));
        }
      } catch {
        // ignore corrupt entries
      }
    }
  }, []);

  const aliasKeyToChat = useCallback(
    (keyBytes: Uint8Array) => {
      if (!e2eKeyId || !currentUserId || !targetUserId) return;
      for (const variant of getE2eKeyIdVariants(currentUserId, targetUserId)) {
        e2eKeysRef.current.set(variant, keyBytes);
      }
    },
    [e2eKeyId, currentUserId, targetUserId],
  );

  const loadStoredKey = useCallback(async () => {
    if (!e2eKeyId) return;
    if (e2eKeysRef.current.has(e2eKeyId)) return;
    appLog('useChat', 'loadStoredKey start', {e2eKeyId, currentUserId, targetUserId});

    await hydrateKeysFromLocalStorage();

    if (currentUserId && targetUserId) {
      for (const variant of getE2eKeyIdVariants(currentUserId, targetUserId)) {
        const fromRef = e2eKeysRef.current.get(variant);
        if (fromRef) {
          aliasKeyToChat(fromRef);
          setKeysVersion(v => v + 1);
          appLog('useChat', 'loadStoredKey found in ref', {variant});
          return;
        }
        const stored = await AsyncStorage.getItem(`e2e_key_${variant}`);
        if (stored) {
          const bytes = bytesFromBase64(stored);
          aliasKeyToChat(bytes);
          setKeysVersion(v => v + 1);
          appLog('useChat', 'loadStoredKey found in storage', {variant});
          return;
        }
      }
    }

    const cached = lookupCachedServerKey(e2eKeyId);
    if (cached) {
      aliasKeyToChat(cached);
      await persistKeyLocally(e2eKeyId, cached);
      setKeysVersion(v => v + 1);
      appLog('useChat', 'loadStoredKey found cached server key', {e2eKeyId});
      return;
    }

    let token = accessToken;
    if (!token) {
      try {
        token = await AsyncStorage.getItem('access_token');
      } catch {}
    }
    if (!token || loadStoredKeyAttemptedRef.current.has(e2eKeyId)) {
      appLog('useChat', 'loadStoredKey skipping server restore', {hasToken: !!token, attempted: loadStoredKeyAttemptedRef.current.has(e2eKeyId)});
      return;
    }
    loadStoredKeyAttemptedRef.current.add(e2eKeyId);

    const restoredKey = await restoreKeyFromServer(
      token,
      e2eKeyId,
      currentUserId,
    );
    if (restoredKey) {
      aliasKeyToChat(restoredKey);
      await persistKeyLocally(e2eKeyId, restoredKey);
      setKeysVersion(v => v + 1);
      appLog('useChat', 'loadStoredKey restored from server', {e2eKeyId});
    } else {
      appLog('useChat', 'loadStoredKey server restore returned null', {e2eKeyId});
    }
  }, [
    e2eKeyId,
    currentUserId,
    targetUserId,
    accessToken,
    aliasKeyToChat,
    hydrateKeysFromLocalStorage,
  ]);

  const storeKey = useCallback(
    async (keyId: string, keyBytes: Uint8Array) => {
      appLog('useChat', 'storeKey', {keyId, keyLength: keyBytes.length, currentUserId, targetUserId});
      if (currentUserId && targetUserId) {
        for (const variant of getE2eKeyIdVariants(currentUserId, targetUserId)) {
          e2eKeysRef.current.set(variant, keyBytes);
        }
        await persistKeyLocally(keyId, keyBytes);
      } else {
        e2eKeysRef.current.set(keyId, keyBytes);
        await persistKeyLocally(keyId, keyBytes);
      }
      setKeysVersion(v => v + 1);

      (async () => {
        let token = accessToken;
        if (!token) {
          try {
            token = await AsyncStorage.getItem('access_token');
          } catch {}
        }
        if (token && currentUserId) {
          await ensureBackupMaterial(token, currentUserId);
          const {deviceId, deviceName} = await getDeviceInfo();
          await backupKeyToServer(
            token,
            normalizeE2eKeyId(keyId),
            keyBytes,
            deviceId,
            deviceName,
            currentUserId,
          );
        }
      })().catch(() => {});
    },
    [accessToken, currentUserId, targetUserId],
  );

  const deriveKey = useCallback(async (shared: ArrayBuffer, keyId: string) => {
    const encoder = new TextEncoder();
    const salt = encoder.encode(normalizeE2eKeyId(keyId));
    const combined = new Uint8Array(shared.byteLength + salt.length);
    combined.set(new Uint8Array(shared), 0);
    combined.set(salt, shared.byteLength);
    const hash = await subtle.digest('SHA-256', combined);
    return new Uint8Array(hash);
  }, []);

  const ensureKeyExchange = useCallback(async () => {
    if (!secretChatEnabled) return;
    if (!targetUserId || !currentUserId || !e2eKeyId) return;
    if (!hasCryptoSubtle()) return;
    if (keyExchangeStartedRef.current.has(e2eKeyId)) return;
    keyExchangeStartedRef.current.add(e2eKeyId);

    appLog('useChat', 'ensureKeyExchange', {targetUserId, e2eKeyId});
    try {
      // Load keys in the background; emit the offer ASAP so the peer can answer.
      hydrateKeysFromLocalStorage().catch(() => {});
      loadStoredKey().catch(() => {});

      let pair = e2ePairsRef.current.get(e2eKeyId);
      if (!pair) {
        pair = (await subtle.generateKey(
          {name: 'ECDH', namedCurve: 'P-256'},
          true,
          ['deriveBits'],
        )) as CryptoKeyPair;
        e2ePairsRef.current.set(e2eKeyId, pair);
      }
      const publicKeyRaw = await subtle.exportKey('raw', pair.publicKey);
      socketService.emit('e2e_key_exchange', {
        target_user_id: targetUserId,
        public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
        key_id: e2eKeyId,
        type: 'offer',
      });
      appLog('useChat', 'ensureKeyExchange offer emitted', {targetUserId, e2eKeyId});
    } catch (err) {
      appLog('useChat', 'ensureKeyExchange error', String(err));
      console.error('[Chat] E2EE key exchange failed:', err);
      keyExchangeStartedRef.current.delete(e2eKeyId);
    }
  }, [
    targetUserId,
    currentUserId,
    e2eKeyId,
    loadStoredKey,
    hydrateKeysFromLocalStorage,
    secretChatEnabled,
  ]);

  const resolveMessageKeyCandidates = useCallback(
    (msg: any): string[] => {
      const candidates = new Set<string>();
      if (e2eKeyId) candidates.add(e2eKeyId);

      const senderId = msg?.sender_id ? String(msg.sender_id) : null;
      const targetId = msg?.target_id
        ? String(msg.target_id)
        : msg?.target_user_id
          ? String(msg.target_user_id)
          : null;
      const localCurrentId = currentUserId ? String(currentUserId) : null;
      const localTargetId = targetUserId ? String(targetUserId) : null;

      if (senderId && targetId) {
        candidates.add([senderId, targetId].sort().join(':'));
        candidates.add(`${senderId}:${targetId}`);
        candidates.add(`${targetId}:${senderId}`);
      }
      if (senderId && localCurrentId) {
        candidates.add([senderId, localCurrentId].sort().join(':'));
        candidates.add(`${senderId}:${localCurrentId}`);
        candidates.add(`${localCurrentId}:${senderId}`);
      }
      if (localCurrentId && localTargetId) {
        candidates.add([localCurrentId, localTargetId].sort().join(':'));
        candidates.add(`${localCurrentId}:${localTargetId}`);
        candidates.add(`${localTargetId}:${localCurrentId}`);
      }

      return Array.from(candidates);
    },
    [e2eKeyId, currentUserId, targetUserId],
  );

  const resolveKeyBytes = useCallback(
    async (candidateKeyId: string): Promise<Uint8Array | null> => {
      const fromRef = e2eKeysRef.current.get(candidateKeyId);
      if (fromRef?.length) return fromRef;
      const stored = await AsyncStorage.getItem(`e2e_key_${candidateKeyId}`);
      if (!stored) return null;
      try {
        const bytes = bytesFromBase64(stored);
        e2eKeysRef.current.set(candidateKeyId, bytes);
        return bytes;
      } catch {
        return null;
      }
    },
    [],
  );

  const decryptMessage = useCallback(
    (msg: any) => {
      const next = {...msg};
      const needsDecrypt =
        (next.content && typeof next.content === 'string' && next.content.startsWith('e2e:')) ||
        (typeof next.attachments === 'string' && next.attachments.startsWith('e2e:'));

      if (needsDecrypt) {
        const candidates = resolveMessageKeyCandidates(next);
        appLog('useChat', 'decryptMessage attempt', {msgId: next.id, candidates, keysAvailable: candidates.filter(k => e2eKeysRef.current.has(k))});
      }

      if (
        next.content &&
        typeof next.content === 'string' &&
        next.content.startsWith('e2e:')
      ) {
        const candidates = resolveMessageKeyCandidates(next);
        let decryptedContent = false;
        for (const candidateKeyId of candidates) {
          const key = e2eKeysRef.current.get(candidateKeyId);
          if (!key) continue;
          const decrypted = mtDecrypt(next.content, key);
          if (decrypted !== null) {
            next.content = decrypted;
            decryptedContent = true;
            break;
          }
        }
        appLog('useChat', 'decryptMessage content result', {msgId: next.id, decryptedContent});
        if (!decryptedContent) {
          // Keep ciphertext — UI masks it until key arrives
        }
      }

      if (
        typeof next.attachments === 'string' &&
        next.attachments.startsWith('e2e:')
      ) {
        const candidates = resolveMessageKeyCandidates(next);
        let decryptedAttachments = false;
        for (const candidateKeyId of candidates) {
          const key = e2eKeysRef.current.get(candidateKeyId);
          if (!key) continue;
          const decrypted = mtDecrypt(next.attachments, key);
          if (decrypted === null) continue;
          try {
            next.attachments = JSON.parse(decrypted);
            decryptedAttachments = true;
            break;
          } catch {
            continue;
          }
        }
        if (!decryptedAttachments) {
          next.attachments = undefined;
        }
      }

      return next;
    },
    [resolveMessageKeyCandidates],
  );

  // Re-decrypt already-loaded messages whenever keys change.
  useEffect(() => {
    if (keysVersion === 0) return;
    setMessages(prev => prev.map(m => decryptMessage(m)));
  }, [keysVersion, decryptMessage]);

  // Reset caches and restore server keys on login/currentUser change.
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    resetE2eRestoreCache();
    loadStoredKeyAttemptedRef.current.clear();
    keyExchangeStartedRef.current.clear();
    (async () => {
      try {
        let token = accessToken;
        if (!token) {
          token = await AsyncStorage.getItem('access_token');
        }
        if (!token) return;
        await ensureBackupMaterial(token, currentUserId);
        const keys = await beginServerKeysRestore(token, currentUserId);
        if (cancelled) return;
        for (const [keyId, keyBytes] of keys.entries()) {
          const normalized = normalizeE2eKeyId(keyId);
          const hasLocal = !!(await AsyncStorage.getItem(`e2e_key_${normalized}`));
          if (!hasLocal) {
            e2eKeysRef.current.set(normalized, keyBytes);
            await persistKeyLocally(normalized, keyBytes);
          }
        }
        setKeysVersion(v => v + 1);
      } catch {
        // ignore restore errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUserId]);

  // Trigger key exchange when E2EE chat is opened.
  useEffect(() => {
    if (!secretChatEnabled || !e2eKeyId || !currentUserId || !targetUserId) return;
    ensureKeyExchange().catch(() => {});
  }, [e2eKeyId, currentUserId, targetUserId, secretChatEnabled, ensureKeyExchange]);

  const sendMessage = useCallback(
    async (
      content: string,
      type: 'text' | 'voice' | 'video_note' = 'text',
      attachments?: any[],
      replyToId?: string,
    ) => {
      if (!currentUserId || (!targetUserId && !channelId && !groupId)) return;

      const normalizedAttachments = Array.isArray(attachments) ? attachments : [];

      if (!channelId && !groupId && targetUserId && e2eKeyId && secretChatEnabled) {
        await loadStoredKey();
        const key = e2eKeysRef.current.get(e2eKeyId);
        if (!key) {
          appLog('useChat', 'sendMessage no e2e key; queueing pending', {e2eKeyId});
          const pending = e2ePendingRef.current.get(e2eKeyId) || [];
          pending.push({
            content,
            type,
            attachments: normalizedAttachments,
            replyToId,
          });
          e2ePendingRef.current.set(e2eKeyId, pending);
          ensureKeyExchange();
          return;
        }
        appLog('useChat', 'sendMessage encrypting with e2e key', {e2eKeyId});
        const encryptedContent = mtEncrypt(content, key);
        const encryptedAttachments =
          normalizedAttachments.length > 0
            ? mtEncrypt(JSON.stringify(normalizedAttachments), key)
            : undefined;
        const messagePayload: any = {
          content: encryptedContent,
          type,
          attachments: encryptedAttachments,
          target_user_id: targetUserId,
        };
        if (replyToId) messagePayload.reply_to = replyToId;
        socketService.emit('send_message', messagePayload);
        return;
      }

      const messagePayload: any = {
        content,
        type,
        sender_id: currentUserId,
        reply_to: replyToId,
        attachments: normalizedAttachments,
      };
      if (targetUserId) messagePayload.target_user_id = targetUserId;
      if (groupId) messagePayload.group_id = groupId;
      if (channelId) messagePayload.channel_id = channelId;

      socketService.emit('send_message', messagePayload);
    },
    [
      currentUserId,
      targetUserId,
      groupId,
      channelId,
      e2eKeyId,
      loadStoredKey,
      ensureKeyExchange,
      secretChatEnabled,
    ],
  );

  // Flush any messages that were queued while waiting for an E2EE key.
  useEffect(() => {
    if (!e2eKeyId) return;
    const key = e2eKeysRef.current.get(e2eKeyId);
    if (!key) return;
    const pending = e2ePendingRef.current.get(e2eKeyId);
    if (!pending || pending.length === 0) return;
    e2ePendingRef.current.delete(e2eKeyId);
    appLog('useChat', 'flushing pending E2EE messages', {e2eKeyId, count: pending.length});
    for (const item of pending) {
      sendMessage(item.content, item.type, item.attachments, item.replyToId);
    }
  }, [keysVersion, e2eKeyId, sendMessage]);

  // Socket listeners
  useEffect(() => {
    if (!currentUserId) return;

    const normalizeMsg = (msg: any): any => {
      if (!msg) return msg;
      return {
        ...msg,
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        created_at: msg.created_at || msg.timestamp,
      };
    };

    const onReceiveMessage = (msg: any) => {
      const normalized = normalizeMsg(msg);
      appLog('useChat', 'onReceiveMessage', {msgId: normalized.id, isE2e: normalized.content?.startsWith('e2e:')});
      const decrypted = decryptMessage(normalized);
      setMessages(prev => {
        if (prev.find(m => m.id === decrypted.id)) return prev;
        return [decrypted, ...prev];
      });
    };

    const onMessageSent = (data: any) => {
      const msg = data?.message || data;
      const normalized = normalizeMsg(msg);
      appLog('useChat', 'onMessageSent', {msgId: normalized.id, isE2e: normalized.content?.startsWith('e2e:')});
      const decrypted = decryptMessage(normalized);
      setMessages(prev => {
        const idx = prev.findIndex(
          m => m.id === decrypted.id || (m as any)._pendingId === decrypted.id,
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = decrypted;
          return next;
        }
        return [decrypted, ...prev];
      });
    };

    const onTyping = (data: any) => {
      if (
        (targetUserId &&
          data.target_user_id === currentUserId &&
          data.sender_id === targetUserId) ||
        (groupId && data.group_id === groupId) ||
        (channelId && data.channel_id === channelId)
      ) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const onMessagesReadUpdate = (data: any) => {
      setMessages(prev =>
        prev.map(m => {
          if (
            (targetUserId && m.sender_id === targetUserId) ||
            (groupId && data.group_id === groupId) ||
            (channelId && data.channel_id === channelId)
          ) {
            return {...m, is_read: true};
          }
          return m;
        }),
      );
    };

    const onMessageDeleted = (data: any) => {
      setMessages(prev => prev.filter(m => m.id !== data.message_id));
    };

    const onE2EKeyExchange = async (data: any) => {
      if (!secretChatEnabled) return;
      if (!currentUserId || !targetUserId || !e2eKeyId) return;
      if (!data?.key_id || normalizeE2eKeyId(data.key_id) !== normalizeE2eKeyId(e2eKeyId)) return;
      if (String(data.from_user_id) !== String(targetUserId)) return;
      const keyId = normalizeE2eKeyId(data.key_id);
      const otherPublicKeyB64 = data.public_key;
      if (!otherPublicKeyB64) return;

      appLog('useChat', 'onE2EKeyExchange received', {keyId, type: data.type, from: data.from_user_id});
      try {
        hydrateKeysFromLocalStorage().catch(() => {});
        loadStoredKey().catch(() => {});

        const otherPublicKeyRaw = bytesFromBase64(otherPublicKeyB64);
        const otherPublicKey = await subtle.importKey(
          'raw',
          otherPublicKeyRaw,
          {name: 'ECDH', namedCurve: 'P-256'},
          false,
          [],
        );

        let pair = e2ePairsRef.current.get(keyId);
        if (!pair) {
          pair = (await subtle.generateKey(
            {name: 'ECDH', namedCurve: 'P-256'},
            true,
            ['deriveBits'],
          )) as CryptoKeyPair;
          e2ePairsRef.current.set(keyId, pair);
        }

        const shared = await subtle.deriveBits(
          {name: 'ECDH', public: otherPublicKey},
          pair.privateKey,
          256,
        );
        const derived = await deriveKey(shared, keyId);
        await storeKey(keyId, derived);
        appLog('useChat', 'onE2EKeyExchange key stored', {keyId, keyLength: derived.length});

        if (data.type !== 'answer' && String(data.from_user_id) === String(targetUserId)) {
          const publicKeyRaw = await subtle.exportKey('raw', pair.publicKey);
          socketService.emit('e2e_key_exchange', {
            target_user_id: targetUserId,
            public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
            key_id: keyId,
            type: 'answer',
          });
          appLog('useChat', 'onE2EKeyExchange answer emitted', {keyId});
        }

        setKeysVersion(v => v + 1);

        // Send pending messages
        const pending = e2ePendingRef.current.get(keyId);
        if (pending && pending.length > 0) {
          for (const item of pending) {
            await sendMessage(item.content, item.type, item.attachments, item.replyToId);
          }
          e2ePendingRef.current.delete(keyId);
        }
      } catch (error) {
        appLog('useChat', 'onE2EKeyExchange error', String(error));
        console.error('[E2E] Key exchange failed:', error);
      }
    };

    socketService.on('receive_message', onReceiveMessage);
    socketService.on('message_sent', onMessageSent);
    socketService.on('typing', onTyping);
    socketService.on('messages_read_update', onMessagesReadUpdate);
    socketService.on('message_deleted', onMessageDeleted);
    socketService.on('e2e_key_exchange', onE2EKeyExchange);

    return () => {
      socketService.off('receive_message', onReceiveMessage);
      socketService.off('message_sent', onMessageSent);
      socketService.off('typing', onTyping);
      socketService.off('messages_read_update', onMessagesReadUpdate);
      socketService.off('message_deleted', onMessageDeleted);
      socketService.off('e2e_key_exchange', onE2EKeyExchange);
    };
  }, [
    currentUserId,
    targetUserId,
    groupId,
    channelId,
    e2eKeyId,
    decryptMessage,
    deriveKey,
    storeKey,
    loadStoredKey,
    hydrateKeysFromLocalStorage,
    secretChatEnabled,
    sendMessage,
  ]);

  const fetchHistory = useCallback(async () => {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    try {
      const page = Math.floor(offset / HISTORY_PAGE_SIZE) + 1;
      let endpoint = '';
      if (targetUserId) {
        endpoint = `/dm/${targetUserId}/messages?page=${page}&per_page=${HISTORY_PAGE_SIZE}`;
      } else if (groupId) {
        endpoint = `/groups/${groupId}/messages?page=${page}&per_page=${HISTORY_PAGE_SIZE}`;
      } else if (channelId) {
        endpoint = `/channels/${channelId}/messages?page=${page}&per_page=${HISTORY_PAGE_SIZE}`;
      }
      if (!endpoint) return;

      const data = await apiClient.get<{items?: any[]; messages?: any[]}>(
        endpoint,
      );
      const items = data.items || data.messages || [];
      const normalizeMsg = (msg: any): any => ({
        ...msg,
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        created_at: msg.created_at || msg.timestamp,
      });

      await hydrateKeysFromLocalStorage();
      await loadStoredKey();
      const decrypted = items.map((m: any) => decryptMessage(normalizeMsg(m)));



      setMessages(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newMessages = decrypted.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMessages];
      });
      setOffset(prev => prev + decrypted.length);
      if (decrypted.length < HISTORY_PAGE_SIZE) setHasMore(false);
    } catch (error) {
      console.error('[Chat] Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    targetUserId,
    groupId,
    channelId,
    offset,
    hasMore,
    isLoading,
    decryptMessage,
    loadStoredKey,
    hydrateKeysFromLocalStorage,
    e2eKeyId,
    currentUserId,
    secretChatEnabled,
    ensureKeyExchange,
  ]);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentUserId || !messageId) return;
      setDeletingMessageIds(prev => new Set(prev).add(messageId));
      try {
        socketService.emit('delete_message', {message_id: messageId});
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } finally {
        setDeletingMessageIds(prev => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [currentUserId],
  );

  const sendTyping = useCallback(() => {
    if (!currentUserId) return;
    const payload: any = {sender_id: currentUserId};
    if (targetUserId) payload.target_user_id = targetUserId;
    if (groupId) payload.group_id = groupId;
    if (channelId) payload.channel_id = channelId;
    socketService.emit('typing', payload);
  }, [currentUserId, targetUserId, groupId, channelId]);

  const markAsRead = useCallback(
    (messageId: string) => {
      socketService.emit('message_read', {message_id: messageId});
    },
    [],
  );

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await apiClient.post(`/messages/${messageId}/reaction`, {emoji});
      } catch (error) {
        console.error('[Chat] Failed to add reaction:', error);
      }
    },
    [],
  );

  const forwardMessage = useCallback(
    async (messageId: string, targetId: string) => {
      try {
        await apiClient.post(`/messages/${messageId}/forward`, {
          target_id: targetId,
        });
      } catch (error) {
        console.error('[Chat] Failed to forward message:', error);
      }
    },
    [],
  );

  return {
    messages,
    isLoading,
    hasMore,
    isTyping,
    deletingMessageIds,
    fetchHistory,
    sendMessage,
    deleteMessage,
    sendTyping,
    markAsRead,
    addReaction,
    forwardMessage,
    e2eKeyId,
    ensureKeyExchange,
  };
};
