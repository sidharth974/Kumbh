import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];
type FeatherName = ComponentProps<typeof Feather>['name'];
type MCIName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_MAP = {
  // Navigation
  home: { set: 'ion', name: 'home-outline' as IoniconsName },
  homeFilled: { set: 'ion', name: 'home' as IoniconsName },
  mic: { set: 'ion', name: 'mic-outline' as IoniconsName },
  micFilled: { set: 'ion', name: 'mic' as IoniconsName },
  micOff: { set: 'ion', name: 'mic-off-outline' as IoniconsName },
  stop: { set: 'ion', name: 'stop-circle-outline' as IoniconsName },
  compass: { set: 'ion', name: 'compass-outline' as IoniconsName },
  compassFilled: { set: 'ion', name: 'compass' as IoniconsName },
  alert: { set: 'ion', name: 'alert-circle-outline' as IoniconsName },
  alertFilled: { set: 'ion', name: 'alert-circle' as IoniconsName },
  person: { set: 'ion', name: 'person-outline' as IoniconsName },
  personFilled: { set: 'ion', name: 'person' as IoniconsName },

  // Actions
  send: { set: 'ion', name: 'send' as IoniconsName },
  play: { set: 'ion', name: 'play-circle-outline' as IoniconsName },
  volumeHigh: { set: 'ion', name: 'volume-high-outline' as IoniconsName },
  chevronDown: { set: 'ion', name: 'chevron-down' as IoniconsName },
  chevronUp: { set: 'ion', name: 'chevron-up' as IoniconsName },
  chevronRight: { set: 'ion', name: 'chevron-forward' as IoniconsName },
  arrowBack: { set: 'ion', name: 'arrow-back' as IoniconsName },
  close: { set: 'ion', name: 'close' as IoniconsName },
  search: { set: 'ion', name: 'search-outline' as IoniconsName },
  globe: { set: 'ion', name: 'globe-outline' as IoniconsName },
  settings: { set: 'ion', name: 'settings-outline' as IoniconsName },
  logOut: { set: 'feather', name: 'log-out' as FeatherName },
  logIn: { set: 'feather', name: 'log-in' as FeatherName },
  check: { set: 'ion', name: 'checkmark-circle' as IoniconsName },
  refresh: { set: 'ion', name: 'refresh' as IoniconsName },

  // Features
  call: { set: 'ion', name: 'call-outline' as IoniconsName },
  callFilled: { set: 'ion', name: 'call' as IoniconsName },
  location: { set: 'ion', name: 'location-outline' as IoniconsName },
  map: { set: 'ion', name: 'map-outline' as IoniconsName },
  navigate: { set: 'ion', name: 'navigate-outline' as IoniconsName },
  bus: { set: 'ion', name: 'bus-outline' as IoniconsName },
  bed: { set: 'ion', name: 'bed-outline' as IoniconsName },
  restaurant: { set: 'ion', name: 'restaurant-outline' as IoniconsName },
  time: { set: 'ion', name: 'time-outline' as IoniconsName },
  ticket: { set: 'ion', name: 'ticket-outline' as IoniconsName },
  calendar: { set: 'ion', name: 'calendar-outline' as IoniconsName },
  star: { set: 'ion', name: 'star-outline' as IoniconsName },
  starFilled: { set: 'ion', name: 'star' as IoniconsName },
  heart: { set: 'ion', name: 'heart-outline' as IoniconsName },
  heartFilled: { set: 'ion', name: 'heart' as IoniconsName },
  water: { set: 'ion', name: 'water-outline' as IoniconsName },
  flame: { set: 'ion', name: 'flame-outline' as IoniconsName },
  medical: { set: 'ion', name: 'medkit-outline' as IoniconsName },
  shield: { set: 'ion', name: 'shield-checkmark-outline' as IoniconsName },
  warning: { set: 'ion', name: 'warning-outline' as IoniconsName },
  people: { set: 'ion', name: 'people-outline' as IoniconsName },
  bag: { set: 'ion', name: 'bag-outline' as IoniconsName },
  chatbubble: { set: 'ion', name: 'chatbubble-ellipses-outline' as IoniconsName },
  flash: { set: 'ion', name: 'flash-outline' as IoniconsName },
  wifi: { set: 'ion', name: 'wifi-outline' as IoniconsName },
  wifiOff: { set: 'ion', name: 'cloud-offline-outline' as IoniconsName },
  sparkles: { set: 'ion', name: 'sparkles-outline' as IoniconsName },

  // Domain
  temple: { set: 'mci', name: 'temple-hindu' as MCIName },
  temple2: { set: 'mci', name: 'temple-buddhist' as MCIName },
  yoga: { set: 'mci', name: 'yoga' as MCIName },
  waves: { set: 'mci', name: 'waves' as MCIName },
  handsPray: { set: 'mci', name: 'hands-pray' as MCIName },
} as const;

export type IconName = keyof typeof ICON_MAP;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export default function Icon({ name, size = 24, color = '#1E293B' }: IconProps) {
  const entry = ICON_MAP[name];
  if (!entry) return null;

  if (entry.set === 'feather') {
    return <Feather name={entry.name as FeatherName} size={size} color={color} />;
  }
  if (entry.set === 'mci') {
    return <MaterialCommunityIcons name={entry.name as MCIName} size={size} color={color} />;
  }
  return <Ionicons name={entry.name as IoniconsName} size={size} color={color} />;
}
