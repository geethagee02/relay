import { StyleSheet, Text, View } from 'react-native';

import { statusLabel } from '../domain/labels';
import type { Status } from '../domain/handoff';
import { colors } from '../theme/tokens';

const tone: Record<Status, { bg: string; fg: string }> = {
  open: { bg: colors.amberInk, fg: colors.amber },
  acknowledged: { bg: colors.mediumInk, fg: colors.medium },
  resolved: { bg: colors.goodInk, fg: colors.good },
};

export function StatusPill({ status }: { status: Status }) {
  const palette = tone[status];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
