import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import Icon from 'react-native-vector-icons/Ionicons';

type RoutePropType = RouteProp<MainStackParamList, 'GroupSettings'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function GroupSettingsScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {groupId} = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки группы</Text>
        <View style={{width: 28}} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>ID группы</Text>
        <Text style={styles.value}>{groupId}</Text>
        {/* TODO: add group info editing, participants list, invite code, etc. */}
      </View>
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  value: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
});
