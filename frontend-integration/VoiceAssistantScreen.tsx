/**
 * VoiceAssistantScreen — Main AI assistant screen
 * Drop into: src/screens/VoiceAssistantScreen.tsx
 *
 * Features:
 *   - Press mic button to record voice query
 *   - Auto-detects language (or user selects)
 *   - Shows transcript + AI response text
 *   - Plays audio response
 *   - Shows conversation history
 *   - Emergency quick-access button
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { useVoiceAssistant, Language } from "../hooks/useVoiceAssistant";
import { getEmergencyHelp } from "../services/kumbhApi";

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: "auto", label: "Auto", native: "Auto" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "en", label: "English", native: "English" },
];

const STATE_COLORS = {
  idle: "#FF6B35",
  recording: "#FF2D55",
  processing: "#FF9500",
  speaking: "#34C759",
  error: "#FF3B30",
};

const STATE_LABELS = {
  idle: "Tap to speak",
  recording: "Listening...",
  processing: "Processing...",
  speaking: "Speaking...",
  error: "Error — tap to retry",
};

export default function VoiceAssistantScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("auto");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyResponse, setEmergencyResponse] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const {
    state,
    messages,
    error,
    toggleRecording,
    stopSpeaking,
    clearMessages,
    isRecording,
    isSpeaking,
  } = useVoiceAssistant({
    language: selectedLanguage,
    onMessage: () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
  });

  // Pulse animation when recording
  React.useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handleMicPress = async () => {
    if (isSpeaking) {
      await stopSpeaking();
    } else {
      await toggleRecording();
    }
  };

  const handleEmergency = async () => {
    setShowEmergency(true);
    setEmergencyLoading(true);
    setEmergencyResponse(null);
    try {
      const res = await getEmergencyHelp({
        query: "emergency help",
        language: selectedLanguage === "auto" ? "en" : selectedLanguage,
      });
      setEmergencyResponse(res.response);
    } catch (e) {
      setEmergencyResponse("Call 108 (Ambulance) | 100 (Police) | 101 (Fire)\nKumbh Helpline: 1800-120-2027");
    } finally {
      setEmergencyLoading(false);
    }
  };

  const micColor = STATE_COLORS[state];
  const micLabel = STATE_LABELS[state];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>कुंभ सहायक</Text>
          <Text style={styles.headerSubtitle}>Kumbh Mela 2027 • Nashik</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Language Picker */}
          <TouchableOpacity
            style={styles.langButton}
            onPress={() => setShowLangPicker(true)}
          >
            <Text style={styles.langButtonText}>
              {LANGUAGES.find((l) => l.code === selectedLanguage)?.native || "Auto"}
            </Text>
          </TouchableOpacity>

          {/* Emergency */}
          <TouchableOpacity style={styles.emergencyBtn} onPress={handleEmergency}>
            <Text style={styles.emergencyBtnText}>🚨</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🕉️</Text>
            <Text style={styles.emptyTitle}>नमस्ते! Namaste!</Text>
            <Text style={styles.emptySubtitle}>
              Ask me anything about Nashik Kumbh Mela 2027{"\n"}
              Tap the mic and speak in any language
            </Text>
            <View style={styles.suggestionsContainer}>
              {[
                "When is the main Shahi Snan?",
                "रामकुंड कैसे पहुंचें?",
                "त्र्यंबकेश्वर कब जाएं?",
                "நாசிக்கில் என்ன பார்க்க வேண்டும்?",
              ].map((q) => (
                <Text key={q} style={styles.suggestion}>💬 {q}</Text>
              ))}
            </View>
          </View>
        )}

        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              msg.role === "user" ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            {msg.role === "assistant" && (
              <Text style={styles.assistantIcon}>🤖</Text>
            )}
            <View style={styles.bubbleContent}>
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === "assistant" && styles.assistantText,
                ]}
              >
                {msg.text}
              </Text>
              <Text style={styles.bubbleTime}>
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {msg.language && msg.language !== "auto"
                  ? ` · ${msg.language.toUpperCase()}`
                  : ""}
              </Text>
            </View>
          </View>
        ))}

        {state === "processing" && (
          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={styles.assistantIcon}>🤖</Text>
            <View style={styles.bubbleContent}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.processingText}>Thinking...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Mic Button */}
      <View style={styles.controls}>
        {messages.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearMessages}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            style={[styles.micButton, { backgroundColor: micColor }]}
            onPress={handleMicPress}
            android_ripple={{ color: "rgba(255,255,255,0.3)", radius: 45 }}
          >
            <Text style={styles.micIcon}>
              {isRecording ? "⏹" : isSpeaking ? "🔊" : "🎤"}
            </Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.micLabel}>{micLabel}</Text>
      </View>

      {/* Language Picker Modal */}
      <Modal visible={showLangPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.langOption,
                    selectedLanguage === item.code && styles.langOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedLanguage(item.code);
                    setShowLangPicker(false);
                  }}
                >
                  <Text style={styles.langOptionNative}>{item.native}</Text>
                  <Text style={styles.langOptionLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowLangPicker(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Emergency Modal */}
      <Modal visible={showEmergency} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.emergencyModal]}>
            <Text style={styles.emergencyModalTitle}>🚨 Emergency Help</Text>
            {emergencyLoading ? (
              <ActivityIndicator size="large" color="#FF3B30" />
            ) : (
              <ScrollView>
                <Text style={styles.emergencyModalText}>
                  {emergencyResponse}
                </Text>
                <View style={styles.emergencyNumbers}>
                  {[
                    { label: "Ambulance", number: "108" },
                    { label: "Police", number: "100" },
                    { label: "Kumbh Helpline", number: "1800-120-2027" },
                    { label: "Missing Persons", number: "1800-222-2027" },
                  ].map((item) => (
                    <View key={item.number} style={styles.emergencyNumber}>
                      <Text style={styles.emergencyNumberLabel}>{item.label}</Text>
                      <Text style={styles.emergencyNumberValue}>{item.number}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowEmergency(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#FF6B35" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  langButton: {
    backgroundColor: "rgba(255,107,53,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  langButtonText: { color: "#FF6B35", fontWeight: "600", fontSize: 13 },
  emergencyBtn: {
    backgroundColor: "#FF3B30",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyBtnText: { fontSize: 18 },
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  emptyState: { alignItems: "center", paddingTop: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyTitle: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 22 },
  suggestionsContainer: { marginTop: 24, gap: 8, width: "100%" },
  suggestion: { color: "rgba(255,255,255,0.5)", fontSize: 13, paddingVertical: 4 },
  bubble: { flexDirection: "row", maxWidth: "85%", gap: 8 },
  userBubble: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  assistantBubble: { alignSelf: "flex-start" },
  assistantIcon: { fontSize: 20, marginTop: 4 },
  bubbleContent: { flex: 1 },
  bubbleText: {
    backgroundColor: "#FF6B35",
    color: "#fff",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleTime: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, marginHorizontal: 4 },
  processingText: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 },
  errorBanner: {
    backgroundColor: "rgba(255,59,48,0.2)",
    margin: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  errorText: { color: "#FF3B30", fontSize: 13 },
  controls: { paddingVertical: 24, alignItems: "center", gap: 12 },
  clearBtn: { position: "absolute", top: 24, right: 24 },
  clearBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  micIcon: { fontSize: 32 },
  micLabel: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContainer: {
    backgroundColor: "#16213e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  langOptionSelected: { backgroundColor: "rgba(255,107,53,0.2)" },
  langOptionNative: { fontSize: 17, color: "#fff", fontWeight: "600" },
  langOptionLabel: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  modalClose: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  modalCloseText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  emergencyModal: { maxHeight: "80%" },
  emergencyModalTitle: { fontSize: 22, fontWeight: "800", color: "#FF3B30", marginBottom: 16, textAlign: "center" },
  emergencyModalText: { color: "#fff", fontSize: 15, lineHeight: 24, marginBottom: 16 },
  emergencyNumbers: { gap: 8 },
  emergencyNumber: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,59,48,0.15)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.3)",
  },
  emergencyNumberLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  emergencyNumberValue: { color: "#FF3B30", fontSize: 16, fontWeight: "700" },
});
