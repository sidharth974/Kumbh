import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, RefreshControl, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import Icon, { IconName } from '../../src/components/Icon';
import * as api from '../../src/services/api';

const { width } = Dimensions.get('window');

const QUICK_ACTIONS: { icon: IconName; title: string; sub: string; route: string; colors: [string, string] }[] = [
  { icon: 'mic', title: 'Voice Assistant', sub: 'Ask anything', route: '/(tabs)/assistant', colors: ['#F97316', '#EA580C'] },
  { icon: 'calendar', title: 'Kumbh Schedule', sub: 'Dates & events', route: '/(tabs)/assistant', colors: ['#8B5CF6', '#7C3AED'] },
  { icon: 'compass', title: 'Explore Places', sub: '12+ locations', route: '/(tabs)/explore', colors: ['#3B82F6', '#2563EB'] },
  { icon: 'shield', title: 'Emergency SOS', sub: 'Instant help', route: '/(tabs)/emergency', colors: ['#EF4444', '#DC2626'] },
  { icon: 'bus', title: 'Transport', sub: 'Routes & info', route: '/(tabs)/assistant', colors: ['#10B981', '#059669'] },
  { icon: 'bed', title: 'Stay & Dharamshala', sub: 'Accommodation', route: '/(tabs)/assistant', colors: ['#EC4899', '#DB2777'] },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = QUICK_ACTIONS.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.stagger(60, cardAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true })
    )).start();
    checkServer();
  }, []);

  const checkServer = async () => {
    try { setHealth(await api.checkHealth()); } catch { setHealth(null); }
  };

  const onRefresh = async () => { setRefreshing(true); await checkServer(); setRefreshing(false); };
  const greetName = user?.name?.split(' ')[0] || 'Yatri';

  return (
    <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
      >
        {/* Header */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          className="px-6 pt-4 pb-14 rounded-b-3xl"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-white/60 text-sm font-medium">Namaste</Text>
              <View className="flex-row items-center gap-1.5 bg-white/[0.08] px-3 py-1.5 rounded-full">
                <View className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <Text className="text-white/60 text-xs font-medium">
                  {health ? 'AI Online' : 'Offline'}
                </Text>
              </View>
            </View>
            <Text className="text-white text-[28px] font-bold">{greetName}</Text>
            {health && (
              <Text className="text-ink-400 text-xs mt-1">
                {health.total_documents} docs loaded · {health.backend}
              </Text>
            )}
          </Animated.View>
        </LinearGradient>

        {/* Voice CTA Card */}
        <Pressable
          className="mx-4 -mt-8 active:scale-[0.98]"
          onPress={() => router.push('/(tabs)/assistant')}
        >
          <LinearGradient
            colors={['#F97316', '#EA580C']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="flex-row items-center px-5 py-5 rounded-2xl"
            style={{
              shadowColor: '#F97316', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
            }}
          >
            <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center">
              <Icon name="mic" size={24} color="#FFF" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-white text-lg font-bold">Ask Yatri AI</Text>
              <Text className="text-white/70 text-sm">Tap to speak in any language</Text>
            </View>
            <Icon name="chevronRight" size={24} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </Pressable>

        {/* Quick Actions */}
        <Text className="text-ink-900 text-lg font-bold px-6 mt-6 mb-3">Quick Actions</Text>
        <View className="flex-row flex-wrap px-4 gap-3">
          {QUICK_ACTIONS.map((action, i) => (
            <Animated.View
              key={i}
              style={{
                width: (width - 44) / 3,
                opacity: cardAnims[i],
                transform: [{ scale: cardAnims[i] }],
              }}
            >
              <Pressable
                className="bg-white rounded-2xl py-4 px-2 items-center border border-surface-200 active:scale-95"
                style={{
                  shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                }}
                onPress={() => router.push(action.route as any)}
              >
                <LinearGradient
                  colors={action.colors}
                  className="w-11 h-11 rounded-xl items-center justify-center mb-2.5"
                >
                  <Icon name={action.icon} size={22} color="#FFF" />
                </LinearGradient>
                <Text className="text-ink-800 text-xs font-semibold text-center leading-4">{action.title}</Text>
                <Text className="text-ink-400 text-[10px] mt-0.5">{action.sub}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Kumbh Info */}
        <View className="mx-4 mt-6 bg-white border border-surface-200 rounded-2xl overflow-hidden"
          style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
        >
          <LinearGradient colors={['#FFF7ED', '#FFEDD5']} className="p-5">
            <View className="flex-row items-center mb-3">
              <Icon name="temple" size={22} color="#C2410C" />
              <Text className="text-brand-800 text-base font-bold ml-2">Nashik Kumbh 2027</Text>
            </View>
            <View className="gap-2.5">
              {[
                { icon: 'calendar' as const, text: 'July – September 2027' },
                { icon: 'location' as const, text: 'Ramkund, Godavari River, Nashik' },
                { icon: 'people' as const, text: 'Expected: 5 Crore+ pilgrims' },
              ].map((item, i) => (
                <View key={i} className="flex-row items-center gap-2.5">
                  <Icon name={item.icon} size={16} color="#9A3412" />
                  <Text className="text-ink-700 text-sm">{item.text}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Tips */}
        <Text className="text-ink-900 text-lg font-bold px-6 mt-6 mb-3">How It Works</Text>
        {[
          { icon: 'globe' as const, title: 'Auto-detects your language', desc: 'Hindi, Marathi, English & 5 more' },
          { icon: 'flash' as const, title: 'Instant SOS', desc: 'Emergency help without internet' },
          { icon: 'sparkles' as const, title: 'AI Knowledge Base', desc: '285+ documents about Kumbh Mela' },
        ].map((tip, i) => (
          <View key={i} className="mx-4 mb-2 flex-row items-center bg-white border border-surface-200 rounded-xl px-4 py-3.5">
            <View className="w-9 h-9 rounded-lg bg-surface-100 items-center justify-center mr-3">
              <Icon name={tip.icon} size={18} color="#64748B" />
            </View>
            <View className="flex-1">
              <Text className="text-ink-800 text-sm font-semibold">{tip.title}</Text>
              <Text className="text-ink-400 text-xs mt-0.5">{tip.desc}</Text>
            </View>
          </View>
        ))}

        <View className="h-28" />
      </ScrollView>
    </SafeAreaView>
  );
}
