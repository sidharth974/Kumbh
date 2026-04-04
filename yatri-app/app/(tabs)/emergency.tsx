import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, Linking,
  ActivityIndicator, Platform, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon, { IconName } from '../../src/components/Icon';
import * as api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const SCENARIOS: { key: string; icon: IconName; title: string; color: string }[] = [
  { key: 'medical', icon: 'medical', title: 'Medical', color: '#EF4444' },
  { key: 'missing_person', icon: 'people', title: 'Missing Person', color: '#F97316' },
  { key: 'stampede', icon: 'warning', title: 'Stampede', color: '#EAB308' },
  { key: 'fire', icon: 'flame', title: 'Fire', color: '#DC2626' },
  { key: 'drowning', icon: 'water', title: 'Drowning', color: '#2563EB' },
  { key: 'lost_belongings', icon: 'bag', title: 'Lost Items', color: '#7C3AED' },
];

const HELPLINES = [
  { name: 'Emergency', number: '112', icon: 'shield' as IconName, color: '#DC2626' },
  { name: 'Police', number: '100', icon: 'shield' as IconName, color: '#1E40AF' },
  { name: 'Ambulance', number: '108', icon: 'medical' as IconName, color: '#059669' },
  { name: 'Fire Brigade', number: '101', icon: 'flame' as IconName, color: '#EA580C' },
  { name: 'Kumbh Helpline', number: '1800-120-2027', icon: 'call' as IconName, color: '#7C3AED' },
  { name: 'Missing Persons', number: '1800-222-2027', icon: 'people' as IconName, color: '#0284C7' },
  { name: 'Women Helpline', number: '1091', icon: 'shield' as IconName, color: '#DB2777' },
];

export default function EmergencyScreen() {
  const { user } = useAuth();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [tab, setTab] = useState<'sos' | 'helplines'>('sos');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const triggerSOS = async (scenario: string) => {
    if (Platform.OS !== 'web') Vibration.vibrate([0, 80, 40, 80]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();

    setLoadingKey(scenario); setResponse(null);
    try {
      setResponse(await api.getEmergencyHelp(scenario, user?.preferred_language || 'hi'));
    } catch {
      setResponse({ response: 'Server offline. Call emergency numbers immediately.', helplines: { Police: '100', Ambulance: '108' } });
    } finally { setLoadingKey(null); }
  };

  const call = (num: string) => Linking.openURL(`tel:${num}`).catch(() => {});

  return (
    <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#DC2626', '#B91C1C']} className="px-6 pt-4 pb-5 rounded-b-2xl">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
            <Icon name="alertFilled" size={22} color="#FFF" />
          </View>
          <View>
            <Text className="text-white text-xl font-bold">Emergency SOS</Text>
            <Text className="text-white/60 text-xs">Instant help — no AI delay</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View className="flex-row mx-4 mt-4 bg-surface-100 rounded-xl p-1">
        {(['sos', 'helplines'] as const).map(t => (
          <Pressable
            key={t}
            className={`flex-1 py-2.5 rounded-lg items-center ${tab === t ? 'bg-white shadow-sm' : ''}`}
            onPress={() => setTab(t)}
          >
            <Text className={`text-sm font-semibold ${tab === t ? 'text-red-600' : 'text-ink-400'}`}>
              {t === 'sos' ? 'Quick SOS' : 'Helplines'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-28">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: shakeAnim }] }}>
          {tab === 'sos' ? (
            <>
              <View className="flex-row flex-wrap gap-3">
                {SCENARIOS.map(s => (
                  <Pressable
                    key={s.key}
                    className="bg-white border border-surface-200 rounded-2xl p-4 items-center justify-center active:scale-95"
                    style={{ width: '48%', minHeight: 100,
                      shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
                    }}
                    onPress={() => triggerSOS(s.key)}
                    disabled={loadingKey !== null}
                  >
                    {loadingKey === s.key ? (
                      <ActivityIndicator color={s.color} size="large" />
                    ) : (
                      <>
                        <View className="w-12 h-12 rounded-xl items-center justify-center mb-2"
                          style={{ backgroundColor: s.color + '15' }}
                        >
                          <Icon name={s.icon} size={24} color={s.color} />
                        </View>
                        <Text className="text-ink-800 text-sm font-bold text-center">{s.title}</Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>

              {response && (
                <View className="mt-5 bg-white border-2 border-red-200 rounded-2xl p-5">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Icon name="flash" size={18} color="#DC2626" />
                    <Text className="text-red-700 text-base font-bold">Emergency Response</Text>
                  </View>
                  <Text className="text-ink-700 text-[15px] leading-6">
                    {response.response || response.instructions || JSON.stringify(response)}
                  </Text>
                  {response.helplines && (
                    <View className="mt-4 gap-2">
                      {Object.entries(response.helplines).map(([name, num]: [string, any]) => (
                        <Pressable
                          key={name}
                          className="flex-row items-center bg-red-50 rounded-xl px-4 py-3 active:bg-red-100"
                          onPress={() => call(num)}
                        >
                          <Icon name="call" size={16} color="#DC2626" />
                          <Text className="text-red-700 font-semibold ml-2 flex-1">{name}</Text>
                          <Text className="text-red-800 font-bold">{num}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Big Call 112 */}
              <Pressable className="mt-6 rounded-2xl overflow-hidden active:opacity-90" onPress={() => call('112')}>
                <LinearGradient colors={['#DC2626', '#991B1B']} className="flex-row items-center justify-center py-5 gap-3">
                  <Icon name="callFilled" size={24} color="#FFF" />
                  <Text className="text-white text-lg font-bold">Call 112 Emergency</Text>
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <View className="gap-2.5">
              {HELPLINES.map(h => (
                <Pressable
                  key={h.number}
                  className="flex-row items-center bg-white border border-surface-200 rounded-xl px-4 py-4 active:bg-surface-50"
                  style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 }}
                  onPress={() => call(h.number)}
                >
                  <View className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: h.color + '12' }}
                  >
                    <Icon name={h.icon} size={20} color={h.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink-800 text-sm font-semibold">{h.name}</Text>
                    <Text className="text-ink-900 text-lg font-bold mt-0.5">{h.number}</Text>
                  </View>
                  <View className="bg-red-50 border border-red-200 px-3 py-1 rounded-full">
                    <Text className="text-red-600 text-xs font-extrabold tracking-wider">CALL</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
