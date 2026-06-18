import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItem,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/Ionicons';
import {useAppSelector} from '@/store/hooks';

const MENU_ITEMS = [
  {label: 'Лента', icon: 'newspaper-outline', route: 'FeedTab'},
  {label: 'Сообщения', icon: 'chatbubbles-outline', route: 'MessagesTab'},
  {label: 'Звонки', icon: 'call-outline', route: 'CallsTab'},
  {label: 'Профиль', icon: 'person-outline', route: 'ProfileTab'},
];

const EXTRA_ITEMS = [
  {label: 'Друзья', icon: 'people-outline', route: 'Friends'},
  {label: 'Сообщества', icon: 'globe-outline', route: 'Communities'},
  {label: 'Почта', icon: 'mail-outline', route: 'Mail'},
];

export default function DrawerContent(props: DrawerContentComponentProps) {
  const {user} = useAppSelector(state => state.auth);

  const navigateTo = (route: string) => {
    props.navigation.navigate('Tabs', {screen: route});
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{flex: 1, backgroundColor: '#0f0f0f'}}>
      <View style={styles.profileSection}>
        {user?.avatar_url ? (
          <Image source={{uri: user.avatar_url}} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={32} color="#fff" />
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {user?.displayName || user?.username || 'Пользователь'}
        </Text>
        <Text style={styles.status} numberOfLines={1}>
          @{user?.username || 'user'}
        </Text>
      </View>

      <View style={styles.section}>
        {MENU_ITEMS.map(item => (
          <DrawerItem
            key={item.route}
            label={item.label}
            icon={({color, size}) => (
              <Icon name={item.icon} size={size} color={color} />
            )}
            labelStyle={styles.label}
            style={styles.item}
            onPress={() => navigateTo(item.route)}
          />
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        {EXTRA_ITEMS.map(item => (
          <DrawerItem
            key={item.route}
            label={item.label}
            icon={({color, size}) => (
              <Icon name={item.icon} size={size} color={color} />
            )}
            labelStyle={styles.label}
            style={styles.item}
            onPress={() => {
              props.navigation.navigate(item.route);
              props.navigation.closeDrawer();
            }}
          />
        ))}
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6c5ce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
  },
  item: {
    marginVertical: 2,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    marginLeft: -16,
  },
});
