import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface SearchModalProps<T> {
  visible: boolean;
  onClose: () => void;
  data: T[];
  placeholder?: string;
  searchKey?: (item: T) => string;
  renderItem: (info: {item: T; index: number}) => React.ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  emptyText?: string;
}

export default function SearchModal<T>({
  visible,
  onClose,
  data,
  placeholder = 'Поиск...',
  searchKey,
  renderItem,
  keyExtractor,
  emptyText = 'Ничего не найдено',
}: SearchModalProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter(item => {
      const text = searchKey ? searchKey(item) : String(item);
      return text.toLowerCase().includes(q);
    });
  }, [data, query, searchKey]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      onShow={() => setQuery('')}>
      <KeyboardAvoidingView
        style={{flex: 1, backgroundColor: '#0f0f0f'}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.inputWrapper}>
            <Icon name="search" size={18} color="#888" />
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#666"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Icon name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{paddingBottom: 24}}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    marginLeft: 8,
    fontSize: 15,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});
