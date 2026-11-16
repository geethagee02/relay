import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#121614',
  bgRaised: '#1C2320',
  bgInset: '#0C0F0E',
  line: 'rgba(244, 240, 230, 0.12)',
  lineStrong: 'rgba(244, 240, 230, 0.28)',
  text: '#F4F0E6',
  textDim: '#C2CBC4',
  textFaint: '#7E8B84',
  amber: '#E7A23A',
  amberInk: '#2A1E0A',
  ink: '#1A1206',
  critical: '#E15B4C',
  high: '#E7A23A',
  medium: '#7EB8A8',
  low: '#9AA89A',
  good: '#8FCB9B',
  criticalInk: '#2C1512',
  mediumInk: '#152421',
  goodInk: '#152218',
} as const;

export const severityColor = {
  low: colors.low,
  medium: colors.medium,
  high: colors.high,
  critical: colors.critical,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
} as const;

export const mono =
  Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) ?? 'monospace';

export const type = {
  mark: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: colors.amber,
  },
  screenTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.text,
  },
  lede: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textDim,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
} as const satisfies Record<string, TextStyle>;

export const screen: ViewStyle = {
  flex: 1,
  backgroundColor: colors.bg,
};
