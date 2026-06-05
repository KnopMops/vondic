import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {store} from '@/store';
import {fetchUser} from '@/store/authSlice';
import RootNavigator from '@/navigation';
import {useDeepLinks} from '@/hooks/useDeepLinks';
import {crashLogger} from '@/utils/crashLogger';

crashLogger.setupGlobalHandler();

function App(): React.JSX.Element {
  useDeepLinks();

  useEffect(() => {
    store.dispatch(fetchUser());
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
        <RootNavigator />
      </NavigationContainer>
    </Provider>
  );
}

export default App;
