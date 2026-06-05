import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import MessagesScreen from '@/screens/MessagesScreen';
import FeedScreen from '@/screens/FeedScreen';
import CallsScreen from '@/screens/CallsScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import ChatScreen from '@/screens/ChatScreen';
import CallScreen from '@/screens/CallScreen';
import ChannelSettingsScreen from '@/screens/ChannelSettingsScreen';
import GroupSettingsScreen from '@/screens/GroupSettingsScreen';
import UserProfileScreen from '@/screens/UserProfileScreen';
import PrivacySettingsScreen from '@/screens/PrivacySettingsScreen';
import NotificationsSettingsScreen from '@/screens/NotificationsSettingsScreen';
import {useAppSelector} from '@/store/hooks';

export type MainTabParamList = {
  MessagesTab: undefined;
  FeedTab: undefined;
  CallsTab: undefined;
  ProfileTab: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Chat: {
    type: 'dm' | 'group' | 'channel';
    id: string;
    name: string;
    avatar?: string | null;
  };
  Call: {targetUserId?: string; isIncoming?: boolean; callerSocketId?: string};
  ChannelSettings: {channelId: string};
  GroupSettings: {groupId: string};
  UserProfile: {userId: string};
  PrivacySettings: undefined;
  NotificationsSettings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

function TabNavigator() {
  const {user} = useAppSelector(state => state.auth);

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#2a2a2a',
          paddingBottom: 4,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#6c5ce7',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({focused, color, size}) => {
          let iconName = 'help-circle';
          if (route.name === 'MessagesTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'FeedTab') {
            iconName = focused ? 'newspaper' : 'newspaper-outline';
          } else if (route.name === 'CallsTab') {
            iconName = focused ? 'call' : 'call-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen
        name="MessagesTab"
        component={MessagesScreen}
        options={{tabBarLabel: 'Сообщения'}}
      />
      <Tab.Screen
        name="FeedTab"
        component={FeedScreen}
        options={{tabBarLabel: 'Лента'}}
      />
      <Tab.Screen
        name="CallsTab"
        component={CallsScreen}
        options={{tabBarLabel: 'Звонки'}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{tabBarLabel: 'Профиль'}}
      />
    </Tab.Navigator>
  );
}

export default function MainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: '#0f0f0f'},
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{animation: 'fade_from_bottom'}}
      />
      <Stack.Screen name="ChannelSettings" component={ChannelSettingsScreen} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} />
    </Stack.Navigator>
  );
}
