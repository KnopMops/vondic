import React, {Component, ReactNode} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {crashLogger} from '@/utils/crashLogger';

interface Props {
  children: ReactNode;
  screenName?: string;
}

interface State {
  hasError: boolean;
  error?: any;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(error: any): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: any, errorInfo: any) {
    crashLogger.logCrash(error, this.props.screenName || 'ErrorBoundary', {
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>⚠️ Ошибка</Text>
          <Text style={styles.message}>{this.state.error?.message || 'Неизвестная ошибка'}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({hasError: false, error: undefined})}>
            <Text style={styles.buttonText}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', padding: 24},
  title: {color: '#ff6b6b', fontSize: 20, fontWeight: 'bold', marginBottom: 12},
  message: {color: '#ccc', fontSize: 14, textAlign: 'center', marginBottom: 24},
  button: {backgroundColor: '#6c5ce7', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
});
