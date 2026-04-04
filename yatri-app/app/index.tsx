import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import Icon from '../src/components/Icon';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: 'mic' as const, title: 'Voice in 8 Languages', desc: 'Speak naturally, get instant answers' },
  { icon: 'compass' as const, title: 'Navigate Kumbh Mela', desc: 'Ghats, temples, routes & schedules' },
  { icon: 'shield' as const, title: 'Emergency SOS', desc: 'Instant help with one tap' },
  { icon: 'sparkles' as const, title: 'AI-Powered', desc: 'Smart answers from local knowledge' },
];

export default function LandingScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const staggerAnims = FEATURES.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    if (!loading && user) { router.replace('/(tabs)'); return; }

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(120, staggerAnims.map(a =>
        Animated.spring(a, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true })
      )).start();
    });
  }, [loading, user]);

  if (loading) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} className="flex-1 items-center justify-center">
        <View className="w-16 h-16 rounded-full bg-brand-500/20 items-center justify-center">
          <Icon name="temple" size={32} color="#F97316" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} className="flex-1">
      {/* Ambient glow */}
      <View className="absolute top-[-100px] right-[-60px] w-[300px] h-[300px] rounded-full bg-brand-500/[0.06]" />
      <View className="absolute bottom-[20%] left-[-80px] w-[250px] h-[250px] rounded-full bg-brand-400/[0.04]" />

      <Animated.View
        className="flex-1 justify-center px-6 max-w-[460px] self-center w-full"
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Brand */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 items-center justify-center mb-5">
            <Icon name="temple" size={40} color="#F97316" />
          </View>
          <Text className="text-[38px] font-extrabold text-white tracking-tight">Yatri AI</Text>
          <Text className="text-base text-ink-400 mt-1 font-medium">Nashik Kumbh Mela 2027</Text>
        </View>

        {/* Features */}
        <View className="mb-10 gap-3">
          {FEATURES.map((f, i) => (
            <Animated.View
              key={i}
              style={{ opacity: staggerAnims[i], transform: [{ translateY: Animated.multiply(Animated.subtract(1, staggerAnims[i]), new Animated.Value(20)) }] }}
            >
              <View className="flex-row items-center bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3.5">
                <View className="w-10 h-10 rounded-xl bg-brand-500/10 items-center justify-center mr-3">
                  <Icon name={f.icon} size={20} color="#FB923C" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-[15px]">{f.title}</Text>
                  <Text className="text-ink-400 text-xs mt-0.5">{f.desc}</Text>
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* CTAs */}
        <View className="gap-3">
          <Pressable
            className="bg-brand-500 rounded-2xl py-4 items-center active:opacity-90 active:scale-[0.98]"
            style={{ shadowColor: '#F97316', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}
            onPress={() => router.push('/auth/register')}
          >
            <Text className="text-white text-lg font-bold">Get Started</Text>
          </Pressable>

          <Pressable
            className="border border-white/20 rounded-2xl py-3.5 items-center active:bg-white/5"
            onPress={() => router.push('/auth/login')}
          >
            <Text className="text-white/80 text-base font-medium">Sign In</Text>
          </Pressable>

          <Pressable
            className="py-2 items-center"
            onPress={() => router.replace('/(tabs)')}
          >
            <Text className="text-ink-500 text-sm">Skip for now</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Text className="text-ink-600 text-xs text-center pb-8">
        Nashik Simhastha Kumbh Mela 2027
      </Text>
    </LinearGradient>
  );
}
