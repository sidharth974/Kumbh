import { API_URL } from '../constants/theme';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'yatri_token';
const USER_KEY = 'yatri_user';

// Token management — SecureStore on native, AsyncStorage on web
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function removeToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<any | null> {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(USER_KEY)
      : await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function setUser(user: any): Promise<void> {
  const raw = JSON.stringify(user);
  if (Platform.OS === 'web') {
    localStorage.setItem(USER_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, raw);
}

async function removeUser(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(USER_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(USER_KEY);
}

// Fetch wrapper
async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

// Auth
export async function register(name: string, email: string, password: string, language: string = 'hi') {
  const data = await apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, preferred_language: language }),
  });
  await setToken(data.token);
  await setUser(data.user);
  return data;
}

export async function login(email: string, password: string) {
  const data = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setToken(data.token);
  await setUser(data.user);
  return data;
}

export async function logout() {
  await removeToken();
  await removeUser();
}

export async function getProfile() {
  return apiFetch('/api/v1/auth/profile');
}

export async function updateProfile(updates: { name?: string; phone?: string; preferred_language?: string }) {
  const data = await apiFetch('/api/v1/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  await setUser(data);
  return data;
}

export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

// Chat / Query
export async function sendQuery(query: string, language: string) {
  return apiFetch('/api/v1/query', {
    method: 'POST',
    body: JSON.stringify({ query, language }),
  });
}

// Voice
export async function sendVoiceInput(audioUri: string, language: string = 'auto') {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(audioUri);
    const blob = await response.blob();
    form.append('audio', blob, 'recording.webm');
  } else {
    form.append('audio', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
  }

  if (language !== 'auto') {
    form.append('language', language);
  }

  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1/voice/input`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) throw new Error('Voice request failed');
  return res.json();
}

// TTS
export async function textToSpeech(text: string, language: string): Promise<ArrayBuffer> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1/voice/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, language }),
  });
  if (!res.ok) throw new Error('TTS failed');
  return res.arrayBuffer();
}

// Emergency
export async function getEmergencyHelp(scenario: string, language: string) {
  return apiFetch('/api/v1/emergency', {
    method: 'POST',
    body: JSON.stringify({ scenario, language }),
  });
}

export async function getEmergencyContacts() {
  return apiFetch('/api/v1/emergency/contacts');
}

// Places
export async function getPlaces() {
  return apiFetch('/api/v1/places');
}

export async function getPlaceById(id: string) {
  return apiFetch(`/api/v1/places/${id}`);
}

// Sessions
export async function getSessionHistory() {
  return apiFetch('/api/v1/sessions/');
}

export async function getUserStats() {
  return apiFetch('/api/v1/sessions/stats');
}

// Health
export async function checkHealth() {
  return apiFetch('/api/v1/health');
}
