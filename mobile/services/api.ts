import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const TOKEN_KEY = 'english-learning.auth-token';
let inMemoryWebToken: string | null = null;

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:3000/api`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

export const API_BASE_URL = getApiBaseUrl();

export async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') return inMemoryWebToken;
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    inMemoryWebToken = token;
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}

export async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') {
    inMemoryWebToken = null;
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiError {
  message?: string;
  errors?: string[];
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string | null,
): Promise<T> {
  const token = tokenOverride !== undefined ? tokenOverride : await readToken();
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (fetchError) {
    console.warn(`[API] Request failed at ${url}:`, fetchError);
    throw new Error(`Cannot reach the server at ${API_BASE_URL}. Check your connection or backend status.`);
  }

  let body: ApiEnvelope<T> | ApiError;
  try {
    body = (await response.json()) as ApiEnvelope<T> | ApiError;
  } catch {
    throw new Error(`Invalid server response (${response.status})`);
  }

  if (!response.ok || !('success' in body)) {
    const apiError = body as ApiError;
    const detail = apiError.errors?.length ? ` ${apiError.errors.join(' ')}` : '';
    throw new Error(`${apiError.message || 'Request failed.'}${detail}`);
  }

  return body.data;
}
