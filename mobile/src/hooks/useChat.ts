import {useCallback, useEffect, useRef, useState} from 'react';
import {socketService} from '@/services/SocketService';
import {Message} from '@/types';
import {subtle, mtEncrypt, mtDecrypt, base64FromBytes, bytesFromBase64} from '@/utils/crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  backupKeyToServer,
  restoreAllKeysFromServer,
  restoreKeyFromServer,
  getDeviceInfo,
} from '@/utils/e2eKeySync';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';

const hasCryptoSubtle = () => typeof subtle !== 'undefined' && subtle != null;
const HISTORY_PAGE_SIZE = 30;

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
      if (decrypted !== null) return decrypted;
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
) => {
  const {user} = useAppSelector(state => state.auth);
  const currentUserId = user?.id;
  const accessToken = user?.access_token;

  const [messages, setMessages] = useState<Message[]>([]);
  const [deletingMessageIds, setDeletingMessageIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const e2eKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  const e2ePairsRef = useRef<Map<string, CryptoKeyPair>>(new Map());
  const e2ePendingRef = useRef<
    Map<
      string,
      Array<{
        content: string;
        type: 'text' | 'voice';
        attachments?: any[];
        replyToId?: string;
      }>
    >
  >(new Map());

  const e2eKeyId =
    targetUserId && currentUserId ? [currentUserId, targetUserId].sort().join(':') : null;

  useEffect(() => {
    setMessages([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(false);
  }, [targetUserId, groupId, channelId]);

  const loadStoredKey = useCallback(async () => {
    if (!e2eKeyId) return;
    if (e2eKeysRef.current.has(e2eKeyId)) return;

    let stored = await AsyncStorage.getItem(`e2e_key_${e2eKeyId}`);
    if (!stored && currentUserId && targetUserId) {
      const legacyA = `e2e_key_${currentUserId}:${targetUserId}`;
      const legacyB = `e2e_key_${targetUserId}:${currentUserId}`;
      stored =
        (await AsyncStorage.getItem(legacyA)) ||
        (await AsyncStorage.getItem(legacyB)) ||
        null;
    }
    if (stored) {
      e2eKeysRef.current.set(e2eKeyId, bytesFromBase64(stored));
      return;
    }

    if (accessToken && e2eKeyId) {
      const restoredKey = await restoreKeyFromServer(accessToken, e2eKeyId, currentUserId);
      if (restoredKey) {
        e2eKeysRef.current.set(e2eKeyId, restoredKey);
        await AsyncStorage.setItem(`e2e_key_${e2eKeyId}`, base64FromBytes(restoredKey));
      }
    }
  }, [e2eKeyId, currentUserId, targetUserId, accessToken]);

  const hydrateKeysFromServer = useCallback(async () => {
    if (!accessToken) return;
    try {
      const restored = await restoreAllKeysFromServer(accessToken, currentUserId);
      if (!restored.size) return;
      restored.forEach(async (keyData, keyId) => {
        e2eKeysRef.current.set(keyId, keyData);
        await AsyncStorage.setItem(`e2e_key_${keyId}`, base64FromBytes(keyData));
      });
    } catch (error) {
      console.error('[E2E] Failed to hydrate keys from server:', error);
    }
  }, [accessToken, currentUserId]);

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

  const storeKey = useCallback(
    async (keyId: string, keyBytes: Uint8Array) => {
      e2eKeysRef.current.set(keyId, keyBytes);
      await AsyncStorage.setItem(`e2e_key_${keyId}`, base64FromBytes(keyBytes));
      if (accessToken) {
        const {deviceId, deviceName} = getDeviceInfo();
        await backupKeyToServer(accessToken, keyId, keyBytes, deviceId, deviceName, currentUserId);
      }
    },
    [accessToken, currentUserId],
  );

  const deriveKey = useCallback(async (shared: ArrayBuffer, keyId: string) => {
    const encoder = new TextEncoder();
    const salt = encoder.encode(keyId);
    const combined = new Uint8Array(shared.byteLength + salt.length);
    combined.set(new Uint8Array(shared), 0);
    combined.set(salt, shared.byteLength);
    const hash = await subtle.digest('SHA-256', combined);
    return new Uint8Array(hash);
  }, []);

  const ensureKeyExchange = useCallback(async () => {
    if (!targetUserId || !currentUserId || !e2eKeyId) return;
    if (!hasCryptoSubtle()) return;
    try {
      await loadStoredKey();
      if (e2eKeysRef.current.has(e2eKeyId)) return;

      let pair = e2ePairsRef.current.get(e2eKeyId);
      if (!pair) {
        pair = await subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
        e2ePairsRef.current.set(e2eKeyId, pair);
      }
      const publicKeyRaw = await subtle.exportKey('raw', pair.publicKey);
      socketService.emit('e2e_key_exchange', {
        target_user_id: targetUserId,
        public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
        key_id: e2eKeyId,
        type: 'offer',
      });
    } catch (err) {
      console.error('[Chat] E2EE key exchange failed:', err);
    }
  }, [targetUserId, currentUserId, e2eKeyId, loadStoredKey]);

  const decryptMessage = useCallback(
    (msg: any) => {
      const next = {...msg};
      if (next.content && typeof next.content === 'string' && next.content.startsWith('e2e:')) {
        const candidates = resolveMessageKeyCandidates(next);
        for (const candidateKeyId of candidates) {
          const key = e2eKeysRef.current.get(candidateKeyId);
          if (!key) continue;
          const decrypted = mtDecrypt(next.content, key);
          if (decrypted !== null) {
            next.content = decrypted;
            break;
          }
        }
      }
      if (typeof next.attachments === 'string' && next.attachments.startsWith('e2e:')) {
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
        if (!decryptedAttachments) next.attachments = undefined;
      }
      return next;
    },
    [resolveMessageKeyCandidates],
  );

  useEffect(() => {
    if (!e2eKeyId || !currentUserId || !targetUserId) return;
    ensureKeyExchange().catch(() => {});
  }, [e2eKeyId, currentUserId, targetUserId, ensureKeyExchange]);

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
      const decrypted = decryptMessage(normalizeMsg(msg));
      setMessages(prev => {
        if (prev.find(m => m.id === decrypted.id)) return prev;
        return [...prev, decrypted];
      });
    };

    const onMessageSent = (data: any) => {
      console.log('[Chat] message_sent raw:', JSON.stringify(data));
      const msg = data?.message || data;
      const decrypted = decryptMessage(normalizeMsg(msg));
      console.log('[Chat] message_sent parsed:', decrypted.id, decrypted.content?.slice(0, 20));
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === decrypted.id || (m as any)._pendingId === decrypted.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = decrypted;
          return next;
        }
        return [...prev, decrypted];
      });
    };

    const onTyping = (data: any) => {
      if (
        (targetUserId && data.target_user_id === currentUserId && data.sender_id === targetUserId) ||
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
      if (!currentUserId || !targetUserId || !e2eKeyId) return;
      const keyId = data.key_id;
      if (!keyId) return;
      const otherPublicKeyB64 = data.public_key;
      if (!otherPublicKeyB64) return;

      try {
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
          pair = await subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
          e2ePairsRef.current.set(keyId, pair);
        }

        const shared = await subtle.deriveBits(
          {name: 'ECDH', public: otherPublicKey},
          pair.privateKey,
          256,
        );
        const derived = await deriveKey(shared, keyId);
        await storeKey(keyId, derived);

        // Send answer if we received offer
        if (data.type === 'offer' && data.sender_id === targetUserId) {
          const publicKeyRaw = await subtle.exportKey('raw', pair.publicKey);
          socketService.emit('e2e_key_exchange', {
            target_user_id: targetUserId,
            public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
            key_id: keyId,
            type: 'answer',
          });
        }

        // Send pending messages
        const pending = e2ePendingRef.current.get(keyId);
        if (pending && pending.length > 0) {
          for (const item of pending) {
            await sendMessage(item.content, item.type, item.attachments, item.replyToId);
          }
          e2ePendingRef.current.delete(keyId);
        }
      } catch (error) {
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

      const data = await apiClient.get<{items?: any[]; messages?: any[]}>(endpoint);
      const items = data.items || data.messages || [];
      const normalizeMsg = (msg: any): any => ({
        ...msg,
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        created_at: msg.created_at || msg.timestamp,
      });
      const decrypted = items.map((m: any) => decryptMessage(normalizeMsg(m)));
      setMessages(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newMessages = decrypted.filter(m => !existingIds.has(m.id));
        return [...newMessages, ...prev];
      });
      setOffset(prev => prev + decrypted.length);
      if (decrypted.length < HISTORY_PAGE_SIZE) setHasMore(false);
    } catch (error) {
      console.error('[Chat] Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, groupId, channelId, offset, hasMore, isLoading, decryptMessage]);

  const sendMessage = useCallback(
    async (
      content: string,
      type: 'text' | 'voice' = 'text',
      attachments?: any[],
      replyToId?: string,
    ) => {
      if (!currentUserId) return;

      // Encrypt for DM if key exists — otherwise send plaintext
      let finalContent = content;
      let finalAttachments: any = attachments;
      if (targetUserId && e2eKeyId) {
        const key = e2eKeysRef.current.get(e2eKeyId);
        if (key) {
          finalContent = mtEncrypt(content, key);
          if (attachments && attachments.length > 0) {
            finalAttachments = mtEncrypt(JSON.stringify(attachments), key);
          }
        }
        // If no key, send plaintext (will be encrypted by server-side if needed)
      }

      const payload: any = {
        content: finalContent,
        type,
        sender_id: currentUserId,
        reply_to: replyToId,
      };
      if (targetUserId) payload.target_user_id = targetUserId;
      if (groupId) payload.group_id = groupId;
      if (channelId) payload.channel_id = channelId;
      if (finalAttachments) payload.attachments = finalAttachments;

      socketService.emit('send_message', payload);
    },
    [currentUserId, targetUserId, groupId, channelId, e2eKeyId, ensureKeyExchange],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentUserId) return;
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
        await apiClient.post(`/messages/${messageId}/forward`, {target_id: targetId});
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
