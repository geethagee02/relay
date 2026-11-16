import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PrimaryButton } from '../components/Controls';
import { PhotoCard } from '../components/PhotoCard';
import { StatusPill } from '../components/StatusPill';
import { canAdvance, type Status } from '../domain/handoff';
import { severityLabel } from '../domain/labels';
import { formatStamp } from '../domain/time';
import type { RootStackParamList } from '../navigation';
import { useRelay } from '../services/relay';
import { colors, mono, space, severityColor } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export function HandoffDetailScreen({ route }: Props) {
  const relay = useRelay();
  const handoff = relay.handoffs.find((item) => item.id === route.params.id);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!relay.hydrated) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Opening the log…</Text>
      </View>
    );
  }

  if (!handoff) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingTitle}>Not on this device</Text>
        <Text style={styles.muted}>This handoff is not in the saved log.</Text>
      </View>
    );
  }

  async function advance(status: Status) {
    if (!handoff) return;
    setActionError(null);
    try {
      await relay.setStatus(handoff.id, status);
    } catch {
      setActionError('Could not save that on this device.');
    }
  }

  const showAcknowledge = canAdvance(handoff.status, 'acknowledged');
  const showResolve = canAdvance(handoff.status, 'resolved');

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {handoff.pending ? (
          <View style={styles.pending}>
            <Text style={styles.pendingText}>On this device until the API accepts it.</Text>
          </View>
        ) : null}
        <Text style={styles.service}>{handoff.service}</Text>
        <Text style={styles.title}>{handoff.title}</Text>
        <View style={styles.row}>
          <StatusPill status={handoff.status} />
          <Text style={[styles.severity, { color: severityColor[handoff.severity] }]}>
            {severityLabel(handoff.severity)}
          </Text>
        </View>
        <Text style={styles.byline}>
          {handoff.author} · {formatStamp(handoff.createdAt)}
        </Text>
        {handoff.updatedAt !== handoff.createdAt ? (
          <Text style={styles.updated}>Updated {formatStamp(handoff.updatedAt)}</Text>
        ) : null}
        <Text selectable style={styles.notes}>
          {handoff.notes}
        </Text>
        {handoff.photoKind ? <PhotoCard kind={handoff.photoKind} /> : <Text style={styles.noPhoto}>No snapshot attached.</Text>}
        {handoff.lastError ? <Text style={styles.error}>{handoff.lastError}</Text> : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </ScrollView>
      <View style={styles.actions}>
        {showAcknowledge ? (
          <PrimaryButton label="Acknowledge" tone="secondary" onPress={() => void advance('acknowledged')} />
        ) : null}
        {showResolve ? <PrimaryButton label="Resolve" onPress={() => void advance('resolved')} /> : null}
        {handoff.status === 'resolved' ? (
          <Text style={styles.done}>Resolved. The next shift can leave this.</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: 8,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  muted: {
    color: colors.textDim,
    fontSize: 15,
    textAlign: 'center',
  },
  content: {
    padding: space.xl,
    gap: 12,
  },
  pending: {
    backgroundColor: colors.amberInk,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingText: {
    color: colors.amber,
    fontSize: 14,
    lineHeight: 20,
  },
  service: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  severity: {
    fontSize: 13,
    fontWeight: '700',
  },
  byline: {
    color: colors.textDim,
    fontFamily: mono,
    fontSize: 13,
  },
  updated: {
    color: colors.textFaint,
    fontSize: 13,
  },
  notes: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
  },
  noPhoto: {
    color: colors.textFaint,
    fontSize: 13,
  },
  error: {
    color: colors.critical,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 8,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  done: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
