import { StyleSheet, Text, View } from 'react-native';

import { photoLabel } from '../domain/labels';
import type { PhotoKind } from '../domain/handoff';
import { colors, mono, radius } from '../theme/tokens';

export function PhotoCard({ kind }: { kind: PhotoKind }) {
  return (
    <View style={styles.frame} accessibilityLabel={`${photoLabel(kind)} snapshot placeholder`}>
      <View style={styles.chrome}>
        <View style={styles.dots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.chromeText}>{photoLabel(kind)}</Text>
      </View>
      <View style={styles.canvas}>
        {kind === 'graph' ? <GraphBody /> : null}
        {kind === 'dashboard' ? <DashboardBody /> : null}
        {kind === 'runbook' ? <RunbookBody /> : null}
        {kind === 'pager' ? <PagerBody /> : null}
      </View>
      <Text style={styles.caption}>Illustration only. Relay does not attach a real screenshot yet.</Text>
    </View>
  );
}

function GraphBody() {
  const heights = [28, 36, 34, 48, 70, 96, 58];
  return (
    <View style={styles.graph}>
      {heights.map((height, index) => (
        <View key={`bar-${index}`} style={[styles.bar, { height }, index >= 4 ? styles.barHot : null]} />
      ))}
    </View>
  );
}

function DashboardBody() {
  const tiles = [
    ['p99', '1.8s'],
    ['errors', '0.4%'],
    ['queue', '12k'],
    ['pods', '3'],
  ] as const;
  return (
    <View style={styles.tiles}>
      {tiles.map(([label, value]) => (
        <View key={label} style={styles.tile}>
          <Text style={styles.tileLabel}>{label}</Text>
          <Text style={styles.tileValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function RunbookBody() {
  const widths = ['92%', '78%', '86%', '64%', '72%'] as const;
  return (
    <View style={styles.lines}>
      {widths.map((width) => (
        <View key={width} style={[styles.line, { width }]} />
      ))}
    </View>
  );
}

function PagerBody() {
  return (
    <View style={styles.pager}>
      <View style={styles.pagerDot} />
      <Text style={styles.pagerText}>PAGE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.bgInset,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lineStrong,
  },
  chromeText: {
    color: colors.textFaint,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  canvas: {
    minHeight: 120,
    padding: 12,
    justifyContent: 'flex-end',
  },
  caption: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  graph: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#31423C',
  },
  barHot: {
    backgroundColor: colors.amber,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgRaised,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  tileLabel: {
    color: colors.textFaint,
    fontFamily: mono,
    fontSize: 11,
  },
  tileValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  lines: {
    gap: 8,
    paddingVertical: 8,
  },
  line: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#31423C',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  pagerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.critical,
  },
  pagerText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
