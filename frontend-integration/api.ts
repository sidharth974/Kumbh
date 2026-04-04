/**
 * Kumbh Mela 2027 AI Assistant — React Native API Client
 * Drop this into your React Native project: src/services/kumbhApi.ts
 */

import { Platform } from "react-native";

// Change this to your server IP when deploying
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? Platform.OS === "android"
      ? "http://10.0.2.2:8000" // Android emulator → localhost
      : "http://localhost:8000" // iOS simulator
    : "https://your-production-server.com"); // Production

const API_V1 = `${API_BASE}/api/v1`;

export type Language =
  | "en"
  | "hi"
  | "mr"
  | "gu"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "auto";

export interface QueryRequest {
  query: string;
  language?: Language;
  session_id?: string;
  domain?: string;
}

export interface QueryResponse {
  response: string;
  language: string;
  sources: { text: string; domain: string; source: string }[];
  domain: string;
  confidence: number;
  session_id: string;
}

export interface VoiceInputResponse {
  audio_base64: string;
  transcript: string;
  response_text: string;
  language: string;
  duration_ms: number;
}

export interface EmergencyRequest {
  query: string;
  language: Language;
  location?: { lat: number; lon: number };
}

export interface EmergencyResponse {
  type: string;
  response: string;
  contacts: { name: string; number: string }[];
  nearest_facility?: {
    name: string;
    distance_m: number;
    phone: string;
    address: string;
  };
}

export interface Place {
  id: string;
  name: string;
  category: string;
  description: string;
  coordinates: { lat: number; lon: number };
  timings?: string;
  how_to_reach?: string;
  tips?: string;
  entry_fee?: string;
}

// ─── Core API Functions ────────────────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_V1}${endpoint}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  return res.json();
}

// ─── Text Query ───────────────────────────────────────────────────────────────

export async function sendQuery(req: QueryRequest): Promise<QueryResponse> {
  return request<QueryResponse>("/query", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ─── Voice Input → Voice Output ───────────────────────────────────────────────

/**
 * Send audio blob/file → get back audio + transcript + response text.
 * audioUri: local file URI from expo-av recording.
 */
export async function sendVoiceInput(
  audioUri: string,
  languageHint?: Language
): Promise<VoiceInputResponse> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  if (languageHint && languageHint !== "auto") {
    formData.append("language", languageHint);
  }

  const url = `${API_V1}/voice/input`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Voice API error ${res.status}`);
  }

  return res.json();
}

/**
 * Text → speech (returns audio URL to play).
 */
export async function textToSpeech(
  text: string,
  language: Language
): Promise<string> {
  const url = `${API_V1}/voice/tts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });

  if (!res.ok) throw new Error(`TTS error ${res.status}`);

  // Returns audio/mp3 — create local blob URL
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Speech → text only.
 */
export async function speechToText(
  audioUri: string
): Promise<{ transcript: string; language: string; confidence: number }> {
  const formData = new FormData();
  formData.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const url = `${API_V1}/voice/stt`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`STT error ${res.status}`);
  return res.json();
}

// ─── Emergency ────────────────────────────────────────────────────────────────

export async function getEmergencyHelp(
  req: EmergencyRequest
): Promise<EmergencyResponse> {
  return request<EmergencyResponse>("/emergency", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getEmergencyContacts(language: Language = "en") {
  return request<{ contacts: Record<string, string> }>(
    `/emergency/contacts?language=${language}`
  );
}

export async function getNearestFacility(
  lat: number,
  lon: number,
  type: "hospital" | "police" | "fire" | "lost_found"
) {
  return request(`/emergency/nearest?lat=${lat}&lon=${lon}&type=${type}`);
}

// ─── Places ───────────────────────────────────────────────────────────────────

export async function getPlaces(
  category?: string,
  language: Language = "en"
): Promise<Place[]> {
  const params = new URLSearchParams({ language });
  if (category) params.append("category", category);
  return request<Place[]>(`/places?${params}`);
}

export async function getPlaceById(
  placeId: string,
  language: Language = "en"
): Promise<Place> {
  return request<Place>(`/places/${placeId}?language=${language}`);
}

export async function getNearbyPlaces(
  lat: number,
  lon: number,
  radiusKm = 5,
  category?: string,
  language: Language = "en"
): Promise<Place[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: `${radiusKm}km`,
    language,
  });
  if (category) params.append("category", category);
  return request<Place[]>(`/places/nearby?${params}`);
}

export async function getRecommendedItinerary(
  interests: string[],
  language: Language,
  daysAvailable: number
) {
  return request("/places/recommend", {
    method: "POST",
    body: JSON.stringify({ interests, language, days_available: daysAvailable }),
  });
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return request<{
    status: string;
    model: string;
    uptime_seconds: number;
    gpu_memory_used_gb: number;
  }>("/health");
}
