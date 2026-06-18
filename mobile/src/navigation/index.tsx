import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {useAppSelector} from '@/store/hooks';
import AuthStack from './AuthStack';
import MainStack from './MainStack';

function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6c5ce7" />
    </View>
  );
}

export default function RootNavigator() {
  const {user, isInitialized} = useAppSelector(state => state.auth);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return user ? <MainStack /> : <AuthStack />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
