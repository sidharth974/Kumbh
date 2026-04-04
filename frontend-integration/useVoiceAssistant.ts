/**
 * useVoiceAssistant — React Native hook for voice input/output
 * Uses expo-av for recording + expo-audio for playback.
 *
 * Install deps:
 *   npx expo install expo-av expo-audio
 *
 * Drop into: src/hooks/useVoiceAssistant.ts
 */

import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import { sendVoiceInput, Language } from "../services/kumbhApi";

export type AssistantState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioBase64?: string;
  language: string;
  timestamp: Date;
}

export interface UseVoiceAssistantOptions {
  language?: Language;
  onMessage?: (message: Message) => void;
  onError?: (error: Error) => void;
  sessionId?: string;
}

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const { language = "auto", onMessage, onError, sessionId } = options;

  const [state, setState] = useState<AssistantState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const addMessage = useCallback(
    (msg: Omit<Message, "id" | "timestamp">) => {
      const full: Message = {
        ...msg,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, full]);
      onMessage?.(full);
      return full;
    },
    [onMessage]
  );

  // ── Start Recording ─────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (state !== "idle") return;

    try {
      // Request permissions
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) throw new Error("Microphone permission denied");

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState("recording");
      setCurrentTranscript("");
      setError(null);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
      setState("error");
      onError?.(e);
    }
  }, [state, onError]);

  // ── Stop Recording & Process ─────────────────────────────────────────────────

  const stopRecording = useCallback(async () => {
    if (state !== "recording" || !recordingRef.current) return;

    try {
      setState("processing");

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error("No recording URI");

      // Add user message placeholder
      const userMsg = addMessage({
        role: "user",
        text: "🎤 Recording...",
        language: language,
      });

      // Send to backend
      const response = await sendVoiceInput(uri, language === "auto" ? undefined : language);

      // Update user message with transcript
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id ? { ...m, text: response.transcript } : m
        )
      );
      setCurrentTranscript(response.transcript);

      // Add assistant response
      addMessage({
        role: "assistant",
        text: response.response_text,
        audioBase64: response.audio_base64,
        language: response.language,
      });

      // Play audio response
      if (response.audio_base64) {
        await playAudioBase64(response.audio_base64);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message);
      setState("error");
      onError?.(e);
    }
  }, [state, language, addMessage, onError]);

  // ── Tap to Toggle (Press & Hold alternative) ────────────────────────────────

  const toggleRecording = useCallback(async () => {
    if (state === "idle") {
      await startRecording();
    } else if (state === "recording") {
      await stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  // ── Play Audio Response ─────────────────────────────────────────────────────

  const playAudioBase64 = useCallback(async (base64Audio: string) => {
    try {
      setState("speaking");

      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState("idle");
          sound.unloadAsync();
        }
      });
    } catch (err) {
      setState("idle");
    }
  }, []);

  const stopSpeaking = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState("idle");
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCurrentTranscript("");
    setError(null);
    setState("idle");
  }, []);

  return {
    state,
    messages,
    currentTranscript,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
    stopSpeaking,
    clearMessages,
    isRecording: state === "recording",
    isProcessing: state === "processing",
    isSpeaking: state === "speaking",
    isIdle: state === "idle",
  };
}
