import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {useChat} from '@/hooks/useChat';
import {useAppSelector} from '@/store/hooks';
import {socketService} from '@/services/SocketService';
import {crashLogger} from '@/utils/crashLogger';
import {ErrorBoundary} from '@/components/ErrorBoundary';
import {useCallStore} from '@/store/callStore';

interface ChatRouteParams {
  type: 'dm' | 'group' | 'channel';
  id: string;
  name: string;
  avatar?: string | null;
}

type RoutePropType = RouteProp<MainStackParamList, 'Chat'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'Chat'>;

function ChatScreenInner() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);
  const {initiateCall} = useCallStore();

  // Логируем параметры при монтировании
  useEffect(() => {
    crashLogger.logCrash(
      {message: '[ChatScreen] MOUNTED', name: 'Info'},
      'ChatScreen',
      {
        routeParams: route.params,
        userId: user?.id,
        userName: user?.username,
      },
    );
  }, []);

  // Проверка параметров
  if (!route.params) {
    crashLogger.logCrash(
      {message: '[ChatScreen] MISSING route.params', name: 'Error'},
      'ChatScreen',
      {routeKeys: Object.keys(route)},
    );
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка: нет параметров чата</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {type, id, name} = route.params as ChatRouteParams;

  if (!id || !type) {
    crashLogger.logCrash(
      {message: '[ChatScreen] INVALID params', name: 'Error'},
      'ChatScreen',
      {type, id, name, rawParams: route.params},
    );
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка: невалидные параметры чата</Text>
        <Text style={styles.errorDetail}>type={String(type)} id={String(id)}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const targetUserId = type === 'dm' ? id : undefined;
  const groupId = type === 'group' ? id : undefined;
  const channelId = type === 'channel' ? id : undefined;

  // useChat — оборачиваем в try-catch на случай если сам хук падает
  let chatHook: ReturnType<typeof useChat>;
  try {
    chatHook = useChat(targetUserId, channelId, groupId);
  } catch (hookErr: any) {
    crashLogger.logCrash(hookErr, 'ChatScreen_useChat', {
      targetUserId,
      channelId,
      groupId,
    });
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка инициализации чата</Text>
        <Text style={styles.errorDetail}>{hookErr?.message || 'Unknown'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>← Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const {messages, isLoading, hasMore, isTyping, fetchHistory, sendMessage, sendTyping} = chatHook;

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    crashLogger.logCrash(
      {message: '[ChatScreen] useChat initialized', name: 'Info'},
      'ChatScreen',
      {msgCount: messages.length, isLoading, hasMore, isTyping},
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    crashLogger.logCrash(
      {message: '[ChatScreen] Connecting socket + fetching history', name: 'Info'},
      'ChatScreen',
      {targetUserId, channelId, groupId},
    );
    (async () => {
      try {
        await socketService.connect();
        if (mounted) await fetchHistory();
      } catch (err: any) {
        crashLogger.logCrash(err, 'ChatScreen_init', {targetUserId, channelId, groupId});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [targetUserId, groupId, channelId, fetchHistory]);

  // Логируем изменения messages
  useEffect(() => {
    crashLogger.logCrash(
      {message: `[ChatScreen] messages updated: ${messages.length}`, name: 'Info'},
      'ChatScreen',
      {msgCount: messages.length},
    );
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    crashLogger.logCrash(
      {message: '[ChatScreen] Sending message...', name: 'Info'},
      'ChatScreen',
      {textLen: inputText.length},
    );
    setSending(true);
    try {
      await sendMessage(inputText.trim(), 'text');
      setInputText('');
    } catch (err: any) {
      crashLogger.logCrash(err, 'ChatScreen_sendMessage', {text: inputText});
      Alert.alert('Ошибка отправки', err?.message || 'Unknown');
    } finally {
      setSending(false);
    }
  }, [inputText, sendMessage]);

  // Reverse messages for display (newest at bottom)
  const displayMessages = [...messages].reverse();

  const renderMessage = ({item, index}: {item: any; index: number}) => {
    try {
      if (!item || typeof item !== 'object') {
        crashLogger.logCrash(
          {message: `[ChatScreen] Invalid message at index ${index}`, name: 'Warn'},
          'ChatScreen',
          {index, itemType: typeof item},
        );
        return <View style={{height: 0}} />;
      }

      const isOwn = item.sender_id === user?.id;
      const timeStr = item.timestamp || item.created_at;
      let msgDate: Date | null = null;
      try {
        msgDate = timeStr ? new Date(timeStr) : null;
      } catch {
        msgDate = null;
      }
      const timeText = msgDate && !isNaN(msgDate.getTime())
        ? msgDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})
        : '';

      const senderName = item.sender_username || item.sender_name || (item.sender?.username) || 'Пользователь';
      const contentText = item.content ? String(item.content) : '';

      return (
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}>
          {!isOwn && type !== 'dm' && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          {contentText ? <Text style={styles.messageText}>{contentText}</Text> : null}
          {timeText ? <Text style={styles.messageTime}>{timeText}</Text> : null}
        </View>
      );
    } catch (err: any) {
      crashLogger.logCrash(err, 'ChatScreen_renderMessage', {
        index,
        itemId: item?.id,
        itemKeys: item ? Object.keys(item) : null,
      });
      return (
        <View style={[styles.messageBubble, styles.otherBubble]}>
          <Text style={styles.messageText}>⚠️ Ошибка отображения</Text>
        </View>
      );
    }
  };

  if (renderError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка рендера</Text>
        <Text style={styles.errorDetail}>{renderError}</Text>
        <TouchableOpacity onPress={() => setRenderError(null)}>
          <Text style={styles.linkText}>Попробовать снова</Text>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name || 'Чат'}
          </Text>
          {type === 'dm' && (
            <TouchableOpacity
              onPress={() => {
                try {
                  initiateCall(id, name || 'Пользователь');
                  navigation.navigate('Call', {targetUserId: id});
                } catch (err: any) {
                  crashLogger.logCrash(err, 'ChatScreen_call', {id, name});
                }
              }}>
              <Text style={styles.callButton}>📞</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              try {
                if (type === 'channel') navigation.navigate('ChannelSettings', {channelId: id});
                else if (type === 'group') navigation.navigate('GroupSettings', {groupId: id});
                else navigation.navigate('UserProfile', {userId: id});
              } catch (navErr: any) {
                crashLogger.logCrash(navErr, 'ChatScreen_navigate', {type, id});
              }
            }}>
            <Text style={styles.infoButton}>i</Text>
          </TouchableOpacity>
        </View>

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>печатает...</Text>
          </View>
        )}

        {/* Messages list */}
        <FlatList
          data={displayMessages}
          keyExtractor={(item, index) => {
            try {
              return item?.id ? String(item.id) : `msg-${index}`;
            } catch {
              return `msg-${index}`;
            }
          }}
          renderItem={renderMessage}
          contentContainerStyle={{paddingHorizontal: 12, paddingVertical: 8}}
          style={{flex: 1}}
          ListEmptyComponent={
            <View style={{paddingTop: 40, alignItems: 'center'}}>
              <Text style={{color: '#666'}}>Нет сообщений</Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Сообщение..."
            placeholderTextColor="#666"
            value={inputText}
            onChangeText={text => {
              setInputText(text);
              try {
                sendTyping();
              } catch (e: any) {
                crashLogger.logCrash(e, 'ChatScreen_sendTyping', {});
              }
            }}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}>
            <Text style={styles.sendButtonText}>{sending ? '...' : '>'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  } catch (renderErr: any) {
    crashLogger.logCrash(renderErr, 'ChatScreen_render', {type, id, name});
    setRenderError(renderErr?.message || 'Render error');
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Ошибка отрисовки чата</Text>
        <Text style={styles.errorDetail}>{renderErr?.message}</Text>
      </View>
    );
  }
}

export default function ChatScreen() {
  return (
    <ErrorBoundary screenName="ChatScreen">
      <ChatScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  errorDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  linkText: {
    color: '#6c5ce7',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  infoButton: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  callButton: {
    color: '#fff',
    fontSize: 18,
    paddingHorizontal: 8,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6c5ce7',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
