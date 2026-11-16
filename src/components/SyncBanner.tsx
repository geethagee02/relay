import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatWhen } from '../domain/time';
import type { Online } from '../services/sync-engine';
import { colors, radius } from '../theme/tokens';

type Props = {
  hydrated: boolean;
  syncing: boolean;
  online: Online;
  pendingCount: number;
  rejectedCount: number;
  lastSyncedAt: string | null;
  onSync: () => void;
};

export function SyncBanner(props: Props) {
  const copy = bannerCopy(props);
  const waiting = props.online !== 'ok' || props.pendingCount > 0 || props.rejectedCount > 0;
  return (
    <View style={styles.banner}>
      <View style={[styles.dot, waiting ? styles.dotWait : styles.dotOk]} />
      <View style={styles.copy}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sync now"
        disabled={!props.hydrated || props.syncing}
        onPress={props.onSync}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, (!props.hydrated || props.syncing) && styles.disabled]}
      >
        <Text style={styles.buttonText}>{props.syncing ? 'Syncing' : 'Sync'}</Text>
      </Pressable>
    </View>
  );
}

function bannerCopy({ hydrated, syncing, online, pendingCount, rejectedCount, lastSyncedAt }: Props): { title: string; body: string } {
  if (!hydrated) {
    return { title: 'Opening the log', body: 'Reading handoffs saved on this device.' };
  }
  if (rejectedCount > 0) {
    return {
      title: 'Needs a retry',
      body: 'The API rejected a handoff. Sync to try it again.',
    };
  }
  if (pendingCount > 0) {
    const noun = pendingCount === 1 ? 'handoff is' : 'handoffs are';
    return {
      title: syncing ? 'Sending' : 'On this device',
      body: syncing
        ? 'Trying the API with what is saved here.'
        : `${pendingCount} ${noun} waiting to send.`,
    };
  }
  if (online === 'offline') {
    return {
      title: 'API unreachable',
      body: 'Showing the last log this device opened. New handoffs stay here.',
    };
  }
  if (online === 'ok') {
    return {
      title: 'Log is current',
      body: lastSyncedAt ? `Synced ${formatWhen(lastSyncedAt)}.` : 'Synced.',
    };
  }
  return {
    title: syncing ? 'Connecting' : 'Not synced yet',
    body: 'Looking for the API. You can still write a handoff.',
  };
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bgInset,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOk: {
    backgroundColor: colors.good,
  },
  dotWait: {
    backgroundColor: colors.amber,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  buttonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.45,
  },
});
