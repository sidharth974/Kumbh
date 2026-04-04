export const Colors = {
  primary: '#FF6B00',
  primaryLight: '#FF8F3F',
  primaryDark: '#E55A00',
  primaryGlow: 'rgba(255, 107, 0, 0.15)',

  secondary: '#1A1A2E',
  secondaryLight: '#16213E',

  accent: '#FF9F43',
  accentSoft: '#FFF0E0',

  success: '#00C851',
  successLight: '#E8F8EF',
  danger: '#FF4444',
  dangerLight: '#FFE8E8',
  warning: '#FFBB33',
  warningLight: '#FFF8E8',
  info: '#33B5E5',

  bg: '#FAFBFD',
  card: '#FFFFFF',
  cardBorder: '#F0F0F5',
  surface: '#F5F6FA',
  surfaceHover: '#EEEEF5',

  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#F0F0F5',

  shadow: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
  '4xl': 42,
};

export const LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
] as const;

export const API_URL = __DEV__
  ? 'http://localhost:8000'
  : 'https://your-production-url.com';
