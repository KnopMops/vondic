import { Config } from '@/constants/config';
import { User } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as Keychain from 'react-native-keychain';
import { apiClient } from '../api/client';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

export const fetchUser = createAsyncThunk('auth/fetchUser', async (_, {dispatch, rejectWithValue}) => {
  try {
    let token = await AsyncStorage.getItem('access_token');

    if (!token) {
      try {
        const credentials = await Keychain.getGenericPassword({
          service: 'com.vondic.mobile.access_token',
        });
        if (credentials) {
          token = credentials.password;
          await AsyncStorage.setItem('access_token', token);

          const refreshCreds = await Keychain.getGenericPassword({
            service: 'com.vondic.mobile.refresh_token',
          });
          if (refreshCreds) {
            await AsyncStorage.setItem('refresh_token', refreshCreds.password);
          }
        }
      } catch (keychainError) {
        console.warn('[authSlice] Failed to read from Keychain:', keychainError);
      }
    }

    if (!token) return null;

    // Try to load cached user from AsyncStorage first
    let cachedUser: User | null = null;
    try {
      const cachedUserRaw = await AsyncStorage.getItem('user');
      if (cachedUserRaw) {
        cachedUser = JSON.parse(cachedUserRaw);
        if (cachedUser) {
          // Immediately set the user in state so UI navigation resolves
          dispatch(setUser(cachedUser));
        }
      }
    } catch (cacheError) {
      console.warn('[authSlice] Failed to parse cached user:', cacheError);
    }

    try {
      const data = await apiClient.get<{ user: User }>('/auth/me');
      if (data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
      }
      return data.user;
    } catch (networkError: any) {
      console.warn('[authSlice] Failed to fetch user from network:', networkError);
      const msg = networkError.message || '';
      
      // If it's a session expiration/unauthorized error, we clear tokens and log out
      if (
        msg.includes('SESSION_EXPIRED') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('session')
      ) {
        await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
        try {
          await Keychain.resetGenericPassword({ service: 'com.vondic.mobile.access_token' });
          await Keychain.resetGenericPassword({ service: 'com.vondic.mobile.refresh_token' });
        } catch {}
        return null;
      }
      
      // If we have cached user, just return it instead of rejecting
      if (cachedUser) {
        return cachedUser;
      }
      
      return rejectWithValue(msg || 'Failed to fetch user');
    }
  } catch (error: any) {
    return rejectWithValue(error.message || 'Failed to fetch user');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isInitialized = true;
      if (action.payload) {
        AsyncStorage.setItem('user', JSON.stringify(action.payload)).catch(() => {});
      } else {
        AsyncStorage.removeItem('user').catch(() => {});
      }
    },
    setSocketId: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.socket_id = action.payload;
        AsyncStorage.setItem('user', JSON.stringify(state.user)).catch(() => {});
      }
    },
    logout: state => {
      state.user = null;
      state.isInitialized = true;
      AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']).catch(() => {});
      Keychain.resetGenericPassword({ service: 'com.vondic.mobile.access_token' }).catch(() => {});
      Keychain.resetGenericPassword({ service: 'com.vondic.mobile.refresh_token' }).catch(() => {});
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchUser.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.isLoading = false;
        if (
          action.payload &&
          !action.payload.socket_id &&
          state.user?.socket_id
        ) {
          state.user = {...action.payload, socket_id: state.user.socket_id};
        } else {
          state.user = action.payload;
        }
        state.isInitialized = true;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || 'Failed to fetch user';
        state.isInitialized = true;
      });
  },
});

export const {setUser, logout, setSocketId} = authSlice.actions;
export default authSlice.reducer;
