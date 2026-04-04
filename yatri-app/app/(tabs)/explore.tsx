import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon, { IconName } from '../../src/components/Icon';
import * as api from '../../src/services/api';

const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: 'all', label: 'All', icon: 'star' },
  { key: 'ghat', label: 'Ghats', icon: 'waves' },
  { key: 'temple', label: 'Temples', icon: 'temple' },
  { key: 'tourist', label: 'Tourist', icon: 'compass' },
  { key: 'transport', label: 'Transport', icon: 'bus' },
];

const categoryMeta = (cat: string): { icon: IconName; color: string } => {
  if (cat?.includes('temple')) return { icon: 'temple', color: '#EA580C' };
  if (cat?.includes('ghat')) return { icon: 'waves', color: '#0284C7' };
  if (cat?.includes('transport')) return { icon: 'bus', color: '#059669' };
  return { icon: 'compass', color: '#7C3AED' };
};

export default function ExploreScreen() {
  const [places, setPlaces] = useState<any[]>([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPlaces();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadPlaces = async () => {
    try {
      const data = await api.getPlaces();
      setPlaces(Array.isArray(data) ? data : data.places || []);
    } catch {
      setPlaces([
        { id: '1', name: 'Ramkund', category: 'ghat', description: 'Sacred bathing ghat on Godavari. Main site for Kumbh Mela rituals.', timings: '24/7', entry_fee: 'Free' },
        { id: '2', name: 'Trimbakeshwar', category: 'temple', description: 'One of 12 Jyotirlinga temples. Source of Godavari river.', timings: '5:30 AM - 9 PM', entry_fee: 'Free' },
        { id: '3', name: 'Kalaram Temple', category: 'temple', description: 'Famous black stone Ram temple in Panchavati area.', timings: '6 AM - 8:30 PM', entry_fee: 'Free' },
        { id: '4', name: 'Pandav Leni Caves', category: 'tourist', description: '24 ancient Buddhist caves from 2nd century BCE.', timings: '9 AM - 6 PM', entry_fee: '₹25' },
        { id: '5', name: 'Saptashrungi', category: 'temple', description: 'Goddess temple on seven peaks. One of 3.5 Shakti Peethas.', timings: '5 AM - 9 PM', entry_fee: 'Free' },
        { id: '6', name: 'Sula Vineyards', category: 'tourist', description: "India's premier wine estate with tours and tastings.", timings: '11 AM - 11 PM', entry_fee: '₹400' },
        { id: '7', name: 'Nashik Road Railway', category: 'transport', description: 'Main railway station. Mumbai, Pune, Delhi connections.', timings: '24/7' },
        { id: '8', name: 'CBS Bus Stand', category: 'transport', description: 'Central Bus Stand. MSRTC buses to all Maharashtra cities.', timings: '5 AM - 11 PM' },
      ]);
    } finally { setLoading(false); }
  };

  const filtered = category === 'all' ? places :
    places.filter(p => (p.category || '').toLowerCase().includes(category));

  return (
    <SafeAreaView className="flex-1 bg-surface-50" edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#1E40AF', '#1E3A8A']} className="px-6 pt-4 pb-5 rounded-b-2xl">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
            <Icon name="compass" size={22} color="#FFF" />
          </View>
          <View>
            <Text className="text-white text-xl font-bold">Explore Nashik</Text>
            <Text className="text-white/60 text-xs">{places.length} places to discover</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-3 px-4">
        {CATEGORIES.map(c => (
          <Pressable
            key={c.key}
            className={`flex-row items-center gap-1.5 px-4 py-2 mr-2 rounded-full border-[1.5px] ${
              category === c.key ? 'bg-blue-600 border-blue-600' : 'bg-white border-surface-200'
            }`}
            onPress={() => setCategory(c.key)}
          >
            <Icon name={c.icon} size={15} color={category === c.key ? '#FFF' : '#64748B'} />
            <Text className={`text-sm font-semibold ${category === c.key ? 'text-white' : 'text-ink-600'}`}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" contentContainerClassName="pb-28">
          <Animated.View style={{ opacity: fadeAnim }} className="gap-3">
            {filtered.map((place, idx) => {
              const meta = categoryMeta(place.category);
              const expanded = expandedId === place.id;
              return (
                <Pressable
                  key={place.id || idx}
                  className="bg-white border border-surface-200 rounded-2xl overflow-hidden active:scale-[0.99]"
                  style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
                  onPress={() => setExpandedId(expanded ? null : place.id)}
                >
                  <View className="flex-row items-center p-4">
                    <View className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: meta.color + '12' }}
                    >
                      <Icon name={meta.icon} size={24} color={meta.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-ink-900 text-[15px] font-bold">
                        {place.name || place.name_en}
                      </Text>
                      <Text className="text-ink-400 text-xs capitalize mt-0.5">{place.category}</Text>
                    </View>
                    <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={18} color="#94A3B8" />
                  </View>

                  {expanded && (
                    <View className="px-4 pb-4 pt-0 border-t border-surface-100">
                      <Text className="text-ink-600 text-sm leading-[22px] mt-3">
                        {place.description || place.description_en || 'A notable place in Nashik.'}
                      </Text>
                      <View className="mt-3 gap-2">
                        {place.timings && (
                          <View className="flex-row items-center gap-2">
                            <Icon name="time" size={14} color="#64748B" />
                            <Text className="text-ink-500 text-sm">{place.timings}</Text>
                          </View>
                        )}
                        {place.entry_fee && (
                          <View className="flex-row items-center gap-2">
                            <Icon name="ticket" size={14} color="#64748B" />
                            <Text className="text-ink-500 text-sm">{place.entry_fee}</Text>
                          </View>
                        )}
                        {place.how_to_reach_en && (
                          <View className="flex-row items-start gap-2">
                            <Icon name="navigate" size={14} color="#64748B" />
                            <Text className="text-ink-500 text-sm flex-1">{place.how_to_reach_en}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
