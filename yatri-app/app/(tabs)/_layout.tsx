import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import Icon, { IconName } from '../../src/components/Icon';

const TAB_CONFIG: { name: string; icon: IconName; iconActive: IconName; label: string }[] = [
  { name: 'index', icon: 'home', iconActive: 'homeFilled', label: 'Home' },
  { name: 'assistant', icon: 'chatbubble', iconActive: 'mic', label: 'Ask AI' },
  { name: 'explore', icon: 'compass', iconActive: 'compassFilled', label: 'Explore' },
  { name: 'emergency', icon: 'alert', iconActive: 'alertFilled', label: 'SOS' },
  { name: 'profile', icon: 'person', iconActive: 'personFilled', label: 'Profile' },
];

function TabIcon({ icon, iconActive, label, focused }: {
  icon: IconName; iconActive: IconName; label: string; focused: boolean;
}) {
  return (
    <View className="items-center justify-center pt-1.5 w-16">
      {focused && <View className="absolute top-0 w-8 h-[3px] rounded-full bg-brand-500" />}
      <Icon
        name={focused ? iconActive : icon}
        size={focused ? 24 : 22}
        color={focused ? '#F97316' : '#94A3B8'}
      />
      <Text className={`text-[10px] mt-0.5 font-semibold ${focused ? 'text-brand-600' : 'text-ink-400'}`}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 4,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.04,
          shadowRadius: 16,
          elevation: 16,
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon
                icon={tab.icon}
                iconActive={tab.iconActive}
                label={tab.label}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
