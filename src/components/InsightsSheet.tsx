import React from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import type { Insight, InsightChange } from '../utils/insights';
import { fmt } from '../utils/format';

function ChangeChip({
  change,
  unit,
  higherIsBad,
}: {
  change: InsightChange;
  unit: 'currency' | 'miles';
  higherIsBad: boolean;
}) {
  if (change === null) {
    return <Text style={s.noData}>No data last week</Text>;
  }
  const up = change.delta >= 0;
  const good = higherIsBad ? change.delta <= 0 : change.delta >= 0;
  const color = good ? C.success : C.danger;
  const pctText = change.pct !== null ? ` (${Math.abs(change.pct).toFixed(0)}%)` : '';
  const deltaText =
    unit === 'miles'
      ? `${Math.abs(change.delta).toLocaleString()} mi`
      : fmt(Math.abs(change.delta));
  return (
    <View style={[s.chip, { borderColor: color }]}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <Text style={[s.chipText, { color }]}>
        {`${deltaText}${pctText} vs last week`}
      </Text>
    </View>
  );
}

type Props = { insight: Insight | null; onClose: () => void };

export function InsightsSheet({ insight, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={insight !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: 32 + insets.bottom }]}>
        <View style={s.handle} />
        {insight && (
          <>
            <Text style={s.title}>{insight.title}</Text>
            <Text style={s.headline}>{insight.headline}</Text>
            <ChangeChip change={insight.change} unit={insight.unit} higherIsBad={insight.higherIsBad} />
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
              {insight.rows.length === 0 && (
                <Text style={s.empty}>Nothing recorded this week</Text>
              )}
              {insight.rows.map((r, idx) => (
                <View key={`${r.label}-${idx}`} style={s.row}>
                  <View style={s.rowLeft}>
                    <Text style={s.rowLabel}>{r.label}</Text>
                    {r.sub ? <Text style={s.rowSub}>{r.sub}</Text> : null}
                  </View>
                  <Text style={s.rowValue}>{r.value}</Text>
                </View>
              ))}
              {insight.footer.length > 0 && (
                <View style={s.footer}>
                  {insight.footer.map((r) => (
                    <View key={r.label} style={s.row}>
                      <Text style={s.rowSub}>{r.label}</Text>
                      <Text style={s.footerValue}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeText}>Close</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.muted, marginBottom: 14 },
  title: { fontSize: 12, fontWeight: '700', color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontSize: 34, fontWeight: '900', color: C.text, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  noData: { fontSize: 12, color: C.muted, marginTop: 8 },
  scroll: { marginTop: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.cardElevated,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  rowSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: '800', color: C.text },
  footer: { marginTop: 8 },
  footerValue: { fontSize: 13, fontWeight: '800', color: C.accent },
  empty: { fontSize: 13, color: C.muted, paddingVertical: 16, textAlign: 'center' },
  closeBtn: { marginTop: 16, backgroundColor: C.accent, borderRadius: 14, alignItems: 'center', paddingVertical: 12 },
  closeText: { color: C.accentText, fontSize: 15, fontWeight: '800' },
});
