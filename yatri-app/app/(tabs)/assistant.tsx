import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Animated,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../../src/components/Icon';
import { LANGUAGES } from '../../src/constants/theme';
import * as api from '../../src/services/api';

type Message = {
  id: string;
  type: 'user' | 'bot' | 'system';
  text: string;
  audioB64?: string;
  language?: string;
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLang, setSelectedLang] = useState('auto');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    addMsg('system', 'Tap the mic and speak in any language. I will auto-detect and respond.');
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
      ringAnim.stopAnimation(); ringAnim.setValue(0);
    }
  }, [isRecording]);

  const addMsg = useCallback((type: Message['type'], text: string, audioB64?: string, language?: string) => {
    setMessages(prev => [...prev, { id: Date.now() + '' + Math.random(), type, text, audioB64, language }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { addMsg('system', 'Microphone permission required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch { addMsg('system', 'Could not start recording'); }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      addMsg('user', 'Voice message...');
      setIsProcessing(true);

      const result = await api.sendVoiceInput(uri, selectedLang === 'auto' ? 'auto' : selectedLang);

      setMessages(prev => {
        const copy = [...prev];
        const last = [...copy].reverse().find(m => m.type === 'user');
        if (last) last.text = result.transcript || '(inaudible)';
        return copy;
      });

      addMsg('bot', result.response_text || 'No response', result.audio_base64, result.language);
      if (result.audio_base64) playAudio(result.audio_base64);
    } catch { addMsg('system', 'Voice processing failed. Check server.'); }
    finally { setIsProcessing(false); }
  };

  const toggleRecording = () => {
    if (isProcessing) return;
    isRecording ? stopRecording() : startRecording();
  };

  const sendText = async () => {
    const text = textInput.trim();
    if (!text || isProcessing) return;
    setTextInput('');
    addMsg('user', text);
    setIsProcessing(true);
    try {
      const lang = selectedLang === 'auto' ? 'en' : selectedLang;
      const result = await api.sendQuery(text, lang);
      addMsg('bot', result.response || 'No response', undefined, result.language);
      try {
        const audioBuffer = await api.textToSpeech(result.response, result.language || lang);
        const b64 = bufferToBase64(audioBuffer);
        setMessages(prev => {
          const copy = [...prev];
          const last = [...copy].reverse().find(m => m.type === 'bot');
          if (last) last.audioB64 = b64;
          return copy;
        });
        playAudio(b64);
      } catch {}
    } catch { addMsg('system', 'Could not reach server'); }
    finally { setIsProcessing(false); }
  };

  const playAudio = async (base64: string) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${base64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(s => {
        if ('didJustFinish' in s && s.didJustFinish) { sound.unloadAsync(); soundRef.current = null; }
      });
    } catch {}
  };

  function bufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  const langLabel = selectedLang === 'auto' ? 'Auto' :
    LANGUAGES.find(l => l.code === selectedLang)?.native || selectedLang;

  return (
    <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
      {/* Header */}
      <View className="bg-white border-b border-surface-200 px-4 py-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-lg bg-brand-50 items-center justify-center">
            <Icon name="sparkles" size={18} color="#EA580C" />
          </View>
          <View>
            <Text className="text-ink-900 text-base font-bold">Yatri AI</Text>
            <Text className="text-ink-400 text-[10px]">Kumbh Mela Assistant</Text>
          </View>
        </View>
        <Pressable
          className="flex-row items-center gap-1.5 bg-surface-100 px-3 py-1.5 rounded-full border border-surface-200"
          onPress={() => setShowLangPicker(!showLangPicker)}
        >
          <Icon name="globe" size={14} color="#64748B" />
          <Text className="text-ink-600 text-xs font-semibold">{langLabel}</Text>
          <Icon name="chevronDown" size={12} color="#94A3B8" />
        </Pressable>
      </View>

      {/* Language Picker */}
      {showLangPicker && (
        <View className="bg-white border-b border-surface-200 px-3 py-2.5 flex-row flex-wrap gap-1.5">
          <Pressable
            className={`px-3 py-1.5 rounded-full border ${selectedLang === 'auto' ? 'bg-brand-500 border-brand-500' : 'border-surface-300'}`}
            onPress={() => { setSelectedLang('auto'); setShowLangPicker(false); }}
          >
            <Text className={`text-xs font-semibold ${selectedLang === 'auto' ? 'text-white' : 'text-ink-600'}`}>
              Auto-detect
            </Text>
          </Pressable>
          {LANGUAGES.map(l => (
            <Pressable
              key={l.code}
              className={`px-3 py-1.5 rounded-full border ${selectedLang === l.code ? 'bg-brand-500 border-brand-500' : 'border-surface-300'}`}
              onPress={() => { setSelectedLang(l.code); setShowLangPicker(false); }}
            >
              <Text className={`text-xs font-semibold ${selectedLang === l.code ? 'text-white' : 'text-ink-600'}`}>
                {l.native}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 pt-3"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            className={`mb-2 max-w-[85%] ${
              msg.type === 'user' ? 'self-end' :
              msg.type === 'system' ? 'self-center max-w-[95%]' : 'self-start'
            }`}
          >
            <View className={`px-4 py-3 ${
              msg.type === 'user'
                ? 'bg-brand-500 rounded-2xl rounded-br-sm'
                : msg.type === 'system'
                ? 'bg-surface-100 rounded-xl'
                : 'bg-white border border-surface-200 rounded-2xl rounded-bl-sm shadow-sm'
            }`}>
              {msg.type === 'bot' && msg.language && (
                <Text className="text-[9px] text-ink-400 uppercase tracking-widest mb-0.5 font-semibold">{msg.language}</Text>
              )}
              <Text className={`text-[15px] leading-[22px] ${
                msg.type === 'user' ? 'text-white' :
                msg.type === 'system' ? 'text-ink-500 text-center text-[13px]' : 'text-ink-800'
              }`}>
                {msg.text}
              </Text>
              {msg.audioB64 && (
                <Pressable
                  className="flex-row items-center gap-1.5 mt-2 bg-brand-50 self-start px-3 py-1.5 rounded-full"
                  onPress={() => playAudio(msg.audioB64!)}
                >
                  <Icon name="volumeHigh" size={14} color="#EA580C" />
                  <Text className="text-brand-700 text-xs font-semibold">Play</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}

        {isProcessing && (
          <View className="self-start bg-white border border-surface-200 rounded-2xl rounded-bl-sm px-4 py-3 mb-2 shadow-sm">
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#F97316" />
              <Text className="text-ink-400 text-sm">Thinking...</Text>
            </View>
          </View>
        )}
        <View className="h-4" />
      </ScrollView>

      {/* Input Bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
        <View className="bg-white border-t border-surface-200 px-3 py-2.5 flex-row items-center gap-2">
          <TextInput
            className="flex-1 bg-surface-50 border border-surface-200 rounded-2xl px-4 py-2.5 text-[15px] text-ink-900"
            placeholder="Type a question..."
            placeholderTextColor="#94A3B8"
            value={textInput}
            onChangeText={setTextInput}
            onSubmitEditing={sendText}
            editable={!isProcessing}
          />

          {/* Send button */}
          <Pressable
            className={`w-10 h-10 rounded-xl items-center justify-center ${
              textInput.trim() && !isProcessing ? 'bg-brand-500' : 'bg-surface-100'
            }`}
            onPress={sendText}
            disabled={!textInput.trim() || isProcessing}
          >
            <Icon name="send" size={18} color={textInput.trim() && !isProcessing ? '#FFF' : '#CBD5E1'} />
          </Pressable>

          {/* Mic button */}
          <View className="items-center justify-center">
            {/* Animated ring */}
            {isRecording && (
              <Animated.View
                className="absolute w-14 h-14 rounded-full border-2 border-red-400"
                style={{
                  opacity: Animated.subtract(1, ringAnim),
                  transform: [{ scale: Animated.add(1, Animated.multiply(ringAnim, new Animated.Value(0.5))) }],
                }}
              />
            )}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                className={`w-14 h-14 rounded-full items-center justify-center ${
                  isRecording ? 'bg-red-500' : 'bg-ink-900'
                } ${isProcessing ? 'opacity-50' : ''}`}
                style={{
                  shadowColor: isRecording ? '#EF4444' : '#0F172A',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
                }}
                onPress={toggleRecording}
                disabled={isProcessing}
              >
                <Icon
                  name={isRecording ? 'stop' : 'micFilled'}
                  size={24}
                  color="#FFF"
                />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
