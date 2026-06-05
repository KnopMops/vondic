import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {MainStackParamList} from '@/navigation/MainStack';
import {apiClient} from '@/api/client';
import {Config} from '@/constants/config';
import {User} from '@/types';
import Icon from 'react-native-vector-icons/Ionicons';

type RoutePropType = RouteProp<MainStackParamList, 'UserProfile'>;
type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

export default function UserProfileScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation<NavigationProp>();
  const {userId} = route.params;
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    apiClient.post<User>('/users/get', {user_id: userId}).then(data => {
      setProfile(data);
    }).catch(() => {});
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={{width: 28}} />
      </View>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profile?.avatar_url ? (
            <Image source={{uri: profile.avatar_url.startsWith('http') ? profile.avatar_url : Config.BACKEND_URL + profile.avatar_url}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {profile?.username?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <Text style={styles.username}>{profile?.username || 'Загрузка...'}</Text>
        <Text style={styles.description}>{profile?.description || ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() =>
          navigation.navigate('Chat', {type: 'dm', id: userId, name: profile?.username || 'Пользователь'})
        }>
        <Text style={styles.actionButtonText}>Написать</Text>
      </TouchableOpacity>
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
  profileCard: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  username: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  description: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  actionButton: {
    marginHorizontal: 24,
    backgroundColor: '#6c5ce7',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
