import React from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import {useCallStore} from '@/store/callStore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function CallsScreen() {
  const {callHistory, activeCalls} = useCallStore();

  const renderItem = ({item}: {item: any}) => (
    <View style={styles.callItem}>
      <View style={styles.callIcon}>
        <Icon
          name={
            item.type === 'incoming'
              ? 'call-received'
              : item.type === 'outgoing'
              ? 'call-made'
              : 'call-missed'
          }
          size={20}
          color={item.status === 'completed' ? '#6c5ce7' : '#ff6b6b'}
        />
      </View>
      <View style={styles.callInfo}>
        <Text style={styles.callName}>{item.receiverName || item.callerName}</Text>
        <Text style={styles.callDetail}>
          {item.type} · {new Date(item.startTime).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.callDuration}>
        {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Звонки</Text>
      </View>
      {activeCalls.size > 0 && (
        <View style={styles.activeCallsBanner}>
          <Text style={styles.activeCallsText}>
            {activeCalls.size} активный звонок{activeCalls.size > 1 ? 'а' : ''}
          </Text>
        </View>
      )}
      <FlatList
        data={callHistory}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{paddingBottom: 16}}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Пока нет звонков</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeCallsBanner: {
    backgroundColor: '#6c5ce7',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
  },
  activeCallsText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: '#1a1a1a',
    borderBottomWidth: 1,
  },
  callIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  callDetail: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  callDuration: {
    color: '#888',
    fontSize: 14,
  },
  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
});
