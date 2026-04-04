import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import Icon from '../../src/components/Icon';
import { LANGUAGES } from '../../src/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('hi');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) { setError('Please fill all fields'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      await signUp(name.trim(), email.trim().toLowerCase(), password, language);
      router.replace('/(tabs)');
    } catch (e: any) { setError(e.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="flex-1 justify-center px-6" keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} className="absolute top-14 left-4 p-2 z-10">
            <Icon name="arrowBack" size={24} color="#94A3B8" />
          </Pressable>

          <Animated.View
            className="bg-white rounded-3xl p-7 max-w-[420px] w-full self-center"
            style={{
              opacity: fadeAnim, transform: [{ translateY: slideAnim }],
              shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.15, shadowRadius: 30, elevation: 12,
            }}
          >
            <View className="items-center mb-6">
              <View className="w-14 h-14 rounded-2xl bg-brand-50 items-center justify-center mb-3">
                <Icon name="sparkles" size={28} color="#EA580C" />
              </View>
              <Text className="text-2xl font-bold text-ink-900">Join Yatri AI</Text>
              <Text className="text-ink-500 text-sm mt-1">Your Kumbh Mela companion</Text>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-600 text-sm text-center">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-xs font-semibold text-ink-700 mb-1.5 uppercase tracking-wider">Full Name</Text>
              <TextInput
                className="border-[1.5px] border-ink-200 rounded-xl px-4 py-3 text-base text-ink-900 bg-surface-50"
                placeholder="Your name"
                placeholderTextColor="#94A3B8"
                value={name} onChangeText={setName} autoComplete="name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-xs font-semibold text-ink-700 mb-1.5 uppercase tracking-wider">Email</Text>
              <TextInput
                className="border-[1.5px] border-ink-200 rounded-xl px-4 py-3 text-base text-ink-900 bg-surface-50"
                placeholder="you@email.com"
                placeholderTextColor="#94A3B8"
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email"
              />
            </View>

            <View className="mb-4">
              <Text className="text-xs font-semibold text-ink-700 mb-1.5 uppercase tracking-wider">Password</Text>
              <TextInput
                className="border-[1.5px] border-ink-200 rounded-xl px-4 py-3 text-base text-ink-900 bg-surface-50"
                placeholder="Min 6 characters"
                placeholderTextColor="#94A3B8"
                value={password} onChangeText={setPassword} secureTextEntry
              />
            </View>

            <View className="mb-6">
              <Text className="text-xs font-semibold text-ink-700 mb-2 uppercase tracking-wider">Preferred Language</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {LANGUAGES.map((l) => (
                    <Pressable
                      key={l.code}
                      onPress={() => setLanguage(l.code)}
                      className={`px-4 py-2 rounded-full border-[1.5px] ${
                        language === l.code
                          ? 'bg-brand-500 border-brand-500'
                          : 'bg-white border-ink-200'
                      }`}
                    >
                      <Text className={`text-sm font-medium ${
                        language === l.code ? 'text-white' : 'text-ink-600'
                      }`}>
                        {l.native}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Pressable
              className="rounded-xl overflow-hidden active:opacity-90"
              onPress={handleRegister} disabled={loading}
            >
              <LinearGradient
                colors={['#F97316', '#EA580C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                className="py-4 items-center rounded-xl"
              >
                {loading ? <ActivityIndicator color="#FFF" /> :
                  <Text className="text-white text-base font-bold">Create Account</Text>}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/auth/login')} className="mt-5 items-center">
              <Text className="text-ink-500 text-sm">
                Have an account? <Text className="text-brand-600 font-bold">Sign In</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
