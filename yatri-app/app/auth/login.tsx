import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Animated, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import Icon from '../../src/components/Icon';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    if (!email || !password) { setError('Please fill all fields'); return; }
    setLoading(true); setError('');
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) { setError(e.message || 'Login failed'); }
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
                <Icon name="temple" size={28} color="#EA580C" />
              </View>
              <Text className="text-2xl font-bold text-ink-900">Welcome back</Text>
              <Text className="text-ink-500 text-sm mt-1">Sign in to your Yatri account</Text>
            </View>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-600 text-sm text-center">{error}</Text>
              </View>
            ) : null}

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

            <View className="mb-6">
              <Text className="text-xs font-semibold text-ink-700 mb-1.5 uppercase tracking-wider">Password</Text>
              <TextInput
                className="border-[1.5px] border-ink-200 rounded-xl px-4 py-3 text-base text-ink-900 bg-surface-50"
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                value={password} onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Pressable
              className="rounded-xl overflow-hidden active:opacity-90"
              onPress={handleLogin} disabled={loading}
            >
              <LinearGradient
                colors={['#F97316', '#EA580C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                className="py-4 items-center rounded-xl"
              >
                {loading ? <ActivityIndicator color="#FFF" /> :
                  <Text className="text-white text-base font-bold">Sign In</Text>}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.push('/auth/register')} className="mt-5 items-center">
              <Text className="text-ink-500 text-sm">
                No account? <Text className="text-brand-600 font-bold">Create one</Text>
              </Text>
            </Pressable>

            <Pressable onPress={() => router.replace('/(tabs)')} className="mt-3 items-center">
              <Text className="text-ink-400 text-xs">Continue as guest</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
