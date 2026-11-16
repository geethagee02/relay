import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { HandoffCard } from '../components/HandoffCard';
import { PrimaryButton } from '../components/Controls';
import { SyncBanner } from '../components/SyncBanner';
import type { HandoffView } from '../domain/handoff';
import type { RootStackParamList } from '../navigation';
import { useRelay } from '../services/relay';
import { colors, space, type } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'List'>;
type Filter = 'active' | 'open' | 'all';

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'open', label: 'Open' },
  { id: 'all', label: 'All' },
];

function matches(filter: Filter, handoff: HandoffView): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return handoff.status === 'open';
  return handoff.status !== 'resolved';
}

export function HandoffListScreen({ navigation }: Props) {
  const relay = useRelay();
  const [filter, setFilter] = useState<Filter>('active');
  const [pulling, setPulling] = useState(false);
  const visible = relay.handoffs.filter((handoff) => matches(filter, handoff));
  const rejectedCount = relay.handoffs.filter((handoff) => handoff.rejected).length;

  async function onRefresh() {
    setPulling(true);
    try {
      await relay.sync({ includeRejected: true });
    } finally {
      setPulling(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={type.mark}>RELAY</Text>
        <Text style={type.screenTitle}>Night bridge</Text>
        <Text style={styles.lede}>What the next person on the pager needs to know.</Text>
        {relay.hydrated ? <Text style={styles.handle}>Signing as {relay.handle}</Text> : null}
      </View>
      <SyncBanner
        hydrated={relay.hydrated}
        syncing={relay.syncing}
        online={relay.online}
        pendingCount={relay.pendingCount}
        rejectedCount={rejectedCount}
        lastSyncedAt={relay.lastSyncedAt}
        onSync={() => {
          void relay.sync({ includeRejected: true });
        }}
      />
      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          const count = relay.handoffs.filter((handoff) => matches(item.id, handoff)).length;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item.id)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{item.label}</Text>
              <Text style={[styles.chipCount, selected && styles.chipLabelOn]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>
      {relay.hydrated ? (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={() => void onRefresh()} tintColor={colors.amber} colors={[colors.amber]} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState filter={filter} online={relay.online} hasAny={relay.handoffs.length > 0} />}
          renderItem={({ item }) => (
            <HandoffCard handoff={item} onPress={() => navigation.navigate('Detail', { id: item.id })} />
          )}
        />
      ) : (
        <View style={styles.opening}>
          <Text style={styles.openingText}>Opening the log…</Text>
        </View>
      )}
      <View style={styles.bottom}>
        <PrimaryButton
          label="New handoff"
          disabled={!relay.hydrated}
          onPress={() => navigation.navigate('Create')}
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyState({ filter, online, hasAny }: { filter: Filter; online: string; hasAny: boolean }) {
  const title = !hasAny && online === 'offline' ? 'Nothing on this device yet' : 'Nothing in this filter';
  const body =
    !hasAny && online === 'offline'
      ? 'The API is unreachable. A handoff you write now stays here and sends later.'
      : filter === 'all'
        ? 'When you hand off, it lands here — even if the network does not.'
        : 'Resolved notes are under All. Open ones stay in front.';
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: 4,
  },
  lede: {
    ...type.lede,
    marginTop: 4,
  },
  handle: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: 4,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.amberInk,
    borderColor: colors.amber,
  },
  chipLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelOn: {
    color: colors.amber,
  },
  chipCount: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  opening: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingText: {
    color: colors.textDim,
    fontSize: 15,
  },
  empty: {
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 22,
  },
  bottom: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
