import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {apiClient} from '@/api/client';
import {useAppSelector} from '@/store/hooks';
import Icon from 'react-native-vector-icons/Ionicons';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface MailMessage {
  uid: string;
  subject: string;
  from: string;
  date: string;
  snippet?: string;
  seen?: boolean;
}

interface MailboxInfo {
  address: string;
  display_name: string;
  quota_mb: number;
}

export default function MailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const {user} = useAppSelector(state => state.auth);

  // States
  const [mailbox, setMailbox] = useState<MailboxInfo | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [premiumRequired, setPremiumRequired] = useState(false);

  // Setup Form
  const [localPart, setLocalPart] = useState('');
  const [mailPassword, setMailPassword] = useState('');
  const [creatingBox, setCreatingBox] = useState(false);

  // Compose Modal
  const [composeVisible, setComposeVisible] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendSubject, setSendSubject] = useState('');
  const [sendBody, setSendBody] = useState('');
  const [sending, setSending] = useState(false);

  // Read Modal
  const [readVisible, setReadVisible] = useState(false);
  const [activeMessage, setActiveMessage] = useState<any | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (user?.premium) {
      loadMailbox();
    } else {
      setPremiumRequired(true);
      setLoading(false);
    }
  }, [user]);

  const loadMailbox = async () => {
    setLoading(true);
    setPremiumRequired(false);
    try {
      const data = await apiClient.get<any>('/mail/mailbox');
      if (data && data.mailbox) {
        setMailbox(data.mailbox);
        loadMessages();
      } else {
        setMailbox(null);
        setLoading(false);
      }
    } catch (err: any) {
      if (err.status === 403) {
        setPremiumRequired(true);
      } else {
        Alert.alert('Ошибка', 'Не удалось загрузить почтовый ящик');
      }
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await apiClient.get<any>('/mail/messages?folder=INBOX&limit=50&offset=0');
      setMessages(data?.messages || []);
    } catch (err) {
      console.warn('[Mail] Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMailbox = async () => {
    if (!localPart.trim() || !mailPassword.trim()) {
      Alert.alert('Предупреждение', 'Заполните все поля');
      return;
    }
    if (mailPassword.length < 10) {
      Alert.alert('Ошибка', 'Пароль должен быть не менее 10 символов');
      return;
    }
    setCreatingBox(true);
    try {
      const res = await apiClient.post<any>('/mail/mailbox', {
        local_part: localPart.trim(),
        password: mailPassword.trim(),
      });
      Alert.alert('Успех', 'Почтовый ящик успешно создан!');
      setMailbox(res.mailbox);
      loadMessages();
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось создать почтовый ящик');
    } finally {
      setCreatingBox(false);
    }
  };

  const handleSendMessage = async () => {
    if (!sendTo.trim() || !sendSubject.trim() || !sendBody.trim()) {
      Alert.alert('Предупреждение', 'Заполните все поля письма');
      return;
    }
    setSending(true);
    try {
      await apiClient.post('/mail/send', {
        to: sendTo.trim(),
        subject: sendSubject.trim(),
        body: sendBody.trim(),
      });
      Alert.alert('Успех', 'Письмо отправлено!');
      setComposeVisible(false);
      setSendTo('');
      setSendSubject('');
      setSendBody('');
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  };

  const handleReadMessage = async (uid: string) => {
    setReading(true);
    setReadVisible(true);
    try {
      const res = await apiClient.get<any>(`/mail/messages/${uid}`);
      setActiveMessage(res.message);
      // Mark read locally
      setMessages(prev => prev.map(m => (m.uid === uid ? {...m, seen: true} : m)));
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось загрузить тело письма');
      setReadVisible(false);
    } finally {
      setReading(false);
    }
  };

  if (premiumRequired) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Почта Vondic</Text>
          <View style={{width: 40}} />
        </View>
        <View style={styles.premiumLockContainer}>
          <View style={styles.lockIconBox}>
            <Icon name="mail-open-outline" size={80} color="#6c5ce7" />
            <Icon
              name="lock-closed"
              size={28}
              color="#ff4757"
              style={{position: 'absolute', bottom: -5, right: -5}}
            />
          </View>
          <Text style={styles.lockTitle}>Vondic Premium Почта</Text>
          <Text style={styles.lockText}>
            Подключение персонального почтового ящика @vondic.ru доступно только пользователям с активной подпиской Premium.
          </Text>
          <TouchableOpacity
            style={styles.premiumBtn}
            onPress={() => {
              navigation.goBack();
            }}>
            <Text style={styles.premiumBtnText}>Перейти в профиль</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {mailbox ? mailbox.address : 'Создание почты'}
        </Text>
        {mailbox ? (
          <TouchableOpacity onPress={() => setComposeVisible(true)} style={styles.composeBtn}>
            <Icon name="create-outline" size={24} color="#6c5ce7" />
          </TouchableOpacity>
        ) : (
          <View style={{width: 40}} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#6c5ce7" size="large" style={{marginTop: 50}} />
      ) : !mailbox ? (
        <ScrollView contentContainerStyle={styles.setupContainer}>
          <Icon name="mail-outline" size={64} color="#6c5ce7" style={{alignSelf: 'center', marginBottom: 20}} />
          <Text style={styles.setupTitle}>Создайте почтовый ящик</Text>
          <Text style={styles.setupSubtitle}>
            Вы сможете отправлять и получать письма на адрес @vondic.ru прямо из мобильного приложения.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Локальная часть адреса (@vondic.ru)</Text>
            <TextInput
              style={styles.input}
              placeholder="Например, username"
              placeholderTextColor="#888"
              value={localPart}
              onChangeText={setLocalPart}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Пароль почтового ящика (мин. 10 символов)</Text>
            <TextInput
              style={styles.input}
              placeholder="Укажите надежный пароль"
              placeholderTextColor="#888"
              secureTextEntry
              value={mailPassword}
              onChangeText={setMailPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreateMailbox}
            disabled={creatingBox}>
            {creatingBox ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Зарегистрировать ящик</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => item.uid}
          renderItem={({item}) => (
            <TouchableOpacity style={styles.mailRow} onPress={() => handleReadMessage(item.uid)}>
              <View style={styles.mailDotColumn}>
                {!item.seen && <View style={styles.unreadDot} />}
              </View>
              <View style={styles.mailBodyColumn}>
                <View style={styles.mailHeaderRow}>
                  <Text style={[styles.mailFrom, !item.seen && styles.unreadText]} numberOfLines={1}>
                    {item.from}
                  </Text>
                  <Text style={styles.mailDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.mailSubject, !item.seen && styles.unreadText]} numberOfLines={1}>
                  {item.subject || '(Без темы)'}
                </Text>
                <Text style={styles.mailSnippet} numberOfLines={1}>
                  {item.snippet || ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Входящие письма отсутствуют</Text>
            </View>
          }
        />
      )}

      {/* COMPOSE MODAL */}
      <Modal visible={composeVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setComposeVisible(false)}>
                <Text style={styles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Новое письмо</Text>
              <TouchableOpacity onPress={handleSendMessage} disabled={sending}>
                {sending ? (
                  <ActivityIndicator size="small" color="#6c5ce7" />
                ) : (
                  <Text style={styles.modalSendText}>Отправить</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView style={{padding: 16}}>
              <TextInput
                style={styles.composeInput}
                placeholder="Кому (email)..."
                placeholderTextColor="#888"
                value={sendTo}
                onChangeText={setSendTo}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.composeInput}
                placeholder="Тема..."
                placeholderTextColor="#888"
                value={sendSubject}
                onChangeText={setSendSubject}
              />
              <TextInput
                style={[styles.composeInput, {height: 200, textAlignVertical: 'top'}]}
                placeholder="Текст письма..."
                placeholderTextColor="#888"
                multiline
                value={sendBody}
                onChangeText={setSendBody}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* READ MODAL */}
      <Modal visible={readVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReadVisible(false)}>
                <Text style={styles.modalCancelText}>Закрыть</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Письмо</Text>
              <View style={{width: 50}} />
            </View>
            {reading ? (
              <ActivityIndicator color="#6c5ce7" size="large" style={{marginTop: 50}} />
            ) : activeMessage ? (
              <ScrollView style={{padding: 16}}>
                <Text style={styles.readLabel}>От: <Text style={styles.readVal}>{activeMessage.from}</Text></Text>
                <Text style={styles.readLabel}>Дата: <Text style={styles.readVal}>{new Date(activeMessage.date).toLocaleString()}</Text></Text>
                <Text style={styles.readSubject}>{activeMessage.subject || '(Без темы)'}</Text>
                <View style={styles.readBodyContainer}>
                  <Text style={styles.readBodyText}>
                    {activeMessage.body || activeMessage.snippet || ''}
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.errorText}>Не удалось прочитать сообщение</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  composeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumLockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockIconBox: {
    position: 'relative',
    marginBottom: 20,
  },
  lockTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  premiumBtn: {
    backgroundColor: '#6c5ce7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  premiumBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  setupContainer: {
    padding: 24,
  },
  setupTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  setupSubtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
  },
  createBtn: {
    backgroundColor: '#6c5ce7',
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  mailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  mailDotColumn: {
    width: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c5ce7',
  },
  mailBodyColumn: {
    flex: 1,
  },
  mailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mailFrom: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  mailDate: {
    color: '#666',
    fontSize: 11,
  },
  mailSubject: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  mailSnippet: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  unreadText: {
    fontWeight: '700',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    color: '#666',
    fontSize: 15,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f0f0f',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelText: {
    color: '#ff4757',
    fontSize: 15,
  },
  modalSendText: {
    color: '#6c5ce7',
    fontSize: 15,
    fontWeight: '600',
  },
  composeInput: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    color: '#fff',
    fontSize: 15,
    paddingVertical: 12,
    marginBottom: 8,
  },
  readLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
  },
  readVal: {
    color: '#fff',
  },
  readSubject: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 16,
  },
  readBodyContainer: {
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 16,
  },
  readBodyText: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: '#ff4757',
    textAlign: 'center',
    marginTop: 40,
  },
});
