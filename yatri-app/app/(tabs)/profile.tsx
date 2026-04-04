import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/context/AuthContext';
import Icon, { IconName } from '../../src/components/Icon';
import { LANGUAGES } from '../../src/constants/theme';
import * as api from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateUser } = useAuth();
  const [stats, setStats] = useState({ total_queries: 0, languages_used: [] as string[], favorite_places: 0 });
  const [health, setHealth] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    loadData();
  }, []);

  const loadData = async () => {
    try { setStats(await api.getUserStats()); } catch {}
    try { setHealth(await api.checkHealth()); } catch {}
  };

  const handleLogout = () => { signOut(); router.replace('/'); };
  const initials = (user?.name || 'Y').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
      <ScrollView contentContainerClassName="pb-28">
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <LinearGradient colors={['#0F172A', '#1E293B']} className="items-center pt-8 pb-10 rounded-b-3xl">
            <View className="w-20 h-20 rounded-full bg-brand-500 items-center justify-center mb-3"
              style={{ shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }}
            >
              <Text className="text-white text-2xl font-bold">{initials}</Text>
            </View>
            <Text className="text-white text-xl font-bold">{user?.name || 'Guest Yatri'}</Text>
            <Text className="text-ink-400 text-sm mt-0.5">{user?.email || 'Not signed in'}</Text>
            {user?.preferred_language && (
              <View className="mt-3 bg-white/10 border border-white/10 px-4 py-1.5 rounded-full">
                <Text className="text-white/80 text-xs font-medium">
                  {LANGUAGES.find(l => l.code === user.preferred_language)?.native}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Stats */}
          {user && (
            <View className="flex-row mx-4 -mt-5 gap-3">
              {[
                { num: stats.total_queries, label: 'Questions' },
                { num: stats.languages_used.length, label: 'Languages' },
                { num: stats.favorite_places, label: 'Favorites' },
              ].map((s, i) => (
                <View key={i} className="flex-1 bg-white rounded-xl py-3.5 items-center border border-surface-200"
                  style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}
                >
                  <Text className="text-brand-600 text-xl font-extrabold">{s.num}</Text>
                  <Text className="text-ink-400 text-[10px] font-semibold mt-0.5">{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Language Preference */}
          {user && (
            <View className="mx-6 mt-7">
              <Text className="text-ink-900 text-base font-bold mb-3">Preferred Language</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {LANGUAGES.map(l => (
                    <Pressable
                      key={l.code}
                      className={`px-4 py-2 rounded-full border-[1.5px] ${
                        user.preferred_language === l.code
                          ? 'bg-brand-500 border-brand-500'
                          : 'bg-white border-surface-300'
                      }`}
                      onPress={() => updateUser({ preferred_language: l.code })}
                    >
                      <Text className={`text-sm font-medium ${
                        user.preferred_language === l.code ? 'text-white' : 'text-ink-600'
                      }`}>
                        {l.native}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* System Status */}
          <View className="mx-6 mt-7">
            <Text className="text-ink-900 text-base font-bold mb-3">System Status</Text>
            <View className="bg-white border border-surface-200 rounded-xl overflow-hidden"
              style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 }}
            >
              {[
                { label: 'Server', value: health ? 'Online' : 'Offline', ok: !!health },
                ...(health ? [
                  { label: 'AI Model', value: health.model, ok: true },
                  { label: 'Backend', value: health.backend, ok: true },
                  { label: 'Documents', value: `${health.total_documents}`, ok: true },
                  { label: 'Uptime', value: `${Math.round(health.uptime_seconds / 60)} min`, ok: true },
                ] : []),
                { label: 'App Version', value: '1.0.0', ok: true },
              ].map((row, i) => (
                <View key={i} className={`flex-row justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-surface-100' : ''}`}>
                  <Text className="text-ink-500 text-sm">{row.label}</Text>
                  <View className="flex-row items-center gap-1.5">
                    {row.label === 'Server' && (
                      <View className={`w-2 h-2 rounded-full ${row.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    )}
                    <Text className="text-ink-800 text-sm font-semibold">{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mx-6 mt-7 gap-3">
            {!user ? (
              <Pressable
                className="bg-brand-500 rounded-xl py-4 flex-row items-center justify-center gap-2 active:opacity-90"
                onPress={() => router.push('/auth/login')}
              >
                <Icon name="logIn" size={18} color="#FFF" />
                <Text className="text-white text-base font-bold">Sign In</Text>
              </Pressable>
            ) : (
              <Pressable
                className="bg-red-50 border border-red-200 rounded-xl py-4 flex-row items-center justify-center gap-2 active:bg-red-100"
                onPress={handleLogout}
              >
                <Icon name="logOut" size={18} color="#DC2626" />
                <Text className="text-red-600 text-base font-bold">Sign Out</Text>
              </Pressable>
            )}
          </View>

          {/* Footer */}
          <View className="items-center mt-10 gap-1">
            <View className="flex-row items-center gap-2">
              <Icon name="temple" size={16} color="#EA580C" />
              <Text className="text-ink-400 text-sm font-medium">Yatri AI</Text>
            </View>
            <Text className="text-ink-300 text-xs">Nashik Kumbh Mela 2027</Text>
            <Text className="text-ink-300 text-xs mt-1">Whisper + Qwen + ChromaDB + gTTS</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
