import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HandoffView } from '../domain/handoff';
import { severityLabel } from '../domain/labels';
import { formatWhen } from '../domain/time';
import { colors, mono, radius, severityColor } from '../theme/tokens';
import { StatusPill } from './StatusPill';

export function HandoffCard({ handoff, onPress }: { handoff: HandoffView; onPress: () => void }) {
  const queued = handoff.pending ? ', waiting to send' : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${severityLabel(handoff.severity)} handoff, ${handoff.title}, ${handoff.status}${queued}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View style={[styles.card, handoff.pending && styles.cardPending]}>
        <View style={[styles.rail, { backgroundColor: severityColor[handoff.severity] }]} />
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={styles.service}>{handoff.service}</Text>
            <Text style={[styles.severity, { color: severityColor[handoff.severity] }]}>
              {severityLabel(handoff.severity)}
            </Text>
            <View style={styles.spacer} />
            <StatusPill status={handoff.status} />
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {handoff.title}
          </Text>
          <Text style={styles.notes} numberOfLines={2}>
            {handoff.notes}
          </Text>
          <View style={styles.meta}>
            <Text style={styles.time}>{formatWhen(handoff.createdAt)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.author}>{handoff.author}</Text>
            {handoff.pending ? <Text style={styles.queued}>Queued</Text> : null}
            {handoff.attempts > 0 ? (
              <Text style={styles.attempts}>
                Tried {handoff.attempts} {handoff.attempts === 1 ? 'time' : 'times'}
              </Text>
            ) : null}
          </View>
          {handoff.lastError ? <Text style={styles.error}>{handoff.lastError}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.bgRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardPending: {
    borderColor: colors.amber,
  },
  rail: {
    width: 4,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  service: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  severity: {
    fontSize: 11,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  notes: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  time: {
    color: colors.textFaint,
    fontFamily: mono,
    fontSize: 12,
  },
  dot: {
    color: colors.textFaint,
  },
  author: {
    color: colors.textFaint,
    fontSize: 12,
  },
  queued: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: '700',
  },
  attempts: {
    color: colors.textFaint,
    fontSize: 12,
  },
  error: {
    color: colors.critical,
    fontSize: 13,
    lineHeight: 18,
  },
});
