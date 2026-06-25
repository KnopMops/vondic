import AsyncStorage from '@react-native-async-storage/async-storage';
import {Config} from '@/constants/config';

interface RequestOptions extends RequestInit {
  body?: any;
}

async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem('refresh_token');
}

async function setTokens(access: string, refresh?: string) {
  await AsyncStorage.setItem('access_token', access);
  if (refresh) {
    await AsyncStorage.setItem('refresh_token', refresh);
  }
}

async function clearTokens() {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;

  try {
    // Desktop pattern: send refresh token as Bearer header
    const res = await fetch(`${Config.BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refresh}`,
      },
      body: JSON.stringify({
        device_type: 'mobile',
      }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      await setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    let token = await getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (options.body && typeof options.body !== 'string') {
      config.body = JSON.stringify(options.body);
    }

    console.log(`[API] REQUEST ${options.method || 'GET'} ${url}`, {body: options.body, hasToken: !!token});

    let response = await fetch(url, config);

    // Auto-refresh on 401
    if (response.status === 401 && token) {
      console.log('[API] 401 received, attempting token refresh...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        console.log('[API] Retry request with new token:', url);
        response = await fetch(url, {...config, headers});
      } else {
        console.error('[API] Token refresh failed, SESSION_EXPIRED');
        throw new Error('SESSION_EXPIRED');
      }
    }

    console.log(`[API] RESPONSE ${options.method || 'GET'} ${url} status=${response.status}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[API] ERROR ${options.method || 'GET'} ${url}:`, errorData);
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      console.log(`[API] JSON ${options.method || 'GET'} ${url}:`, JSON.stringify(json).slice(0, 500));
      return json as T;
    }
    const text = await response.text();
    console.log(`[API] TEXT ${options.method || 'GET'} ${url}:`, text.slice(0, 500));
    return text as T;
  }

  get<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, {...options, method: 'GET', cache: 'no-store'});
  }

  post<T>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {...options, method: 'POST', body});
  }

  put<T>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {...options, method: 'PUT', body});
  }

  delete<T>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, {...options, method: 'DELETE'});
  }

  // Upload with multipart/form-data
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    let token = await getAccessToken();
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (response.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, {method: 'POST', headers, body: formData});
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  }
}

// API v1 client — all requests go through frontend proxy /api/v1/*
export const apiClient = new ApiClient(`${Config.BACKEND_URL}/api/v1`);
// Public API client — for frontend-native routes like /api/posts
export const publicApiClient = new ApiClient(`${Config.BACKEND_URL}/api`);
export {getAccessToken, getRefreshToken, setTokens, clearTokens, refreshAccessToken};
