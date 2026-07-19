import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fmt } from '../../components/SummaryCard';
import { ScreenHeader } from '../../components/ScreenHeader';
import { getLoadsForWeek, getAllWeekKeys, deleteLoad, deleteWeekData, getPaidPeriodKeys } from '../../storage/storage';
import { calcCompanyMileSummary } from '../../utils/calculations';
import { useWeek } from '../../context/WeekContext';
import { getPeriod, formatPeriodDisplay, formatPayDate } from '../../utils/payPeriods';
import { C } from '../../theme';
import type { LoadEntry } from '../../types';

type Props = { navigation: any };
type WeekData = { totalEarnings: number; netProfit: number; loads: LoadEntry[] };

export function CompanyMileHistory({ navigation }: Props) {
  const { schedule } = useWeek();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<Record<string, WeekData>>({});
  const [paidKeys, setPaidKeys] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('company-mile').then(setWeeks);
      getPaidPeriodKeys('company-mile').then(setPaidKeys);
    }, [])
  );

  async function loadWeekData(weekKey: string) {
    const loads = await getLoadsForWeek('company-mile', weekKey);
    const summary = loads.length > 0
      ? calcCompanyMileSummary(loads)
      : { weekKey, totalEarnings: 0, netProfit: 0 };
    setWeekData((prev) => ({ ...prev, [weekKey]: { ...summary, loads } }));
  }

  async function toggleWeek(weekKey: string) {
    if (expanded === weekKey) { setExpanded(null); return; }
    await loadWeekData(weekKey);
    setExpanded(weekKey);
  }

  function handleEditLoad(load: LoadEntry) {
    navigation.navigate('AddLoad', { load });
  }

  async function handleDeleteLoad(load: LoadEntry) {
    Alert.alert('Delete Load', `Remove ${load.startLocation} → ${load.endLocation}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteLoad('company-mile', load.weekKey, load.id);
          const remaining = (weekData[load.weekKey]?.loads ?? []).filter((l) => l.id !== load.id);
          if (remaining.length === 0) {
            setWeeks((prev) => prev.filter((w) => w !== load.weekKey));
            setExpanded(null);
          } else {
            await loadWeekData(load.weekKey);
          }
        },
      },
    ]);
  }

  async function handleDeleteWeek(weekKey: string) {
    Alert.alert('Delete Week', 'Delete all loads for this week?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteWeekData('company-mile', weekKey);
          setWeeks((prev) => prev.filter((w) => w !== weekKey));
          if (expanded === weekKey) setExpanded(null);
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="History"
        subtitle="Company Per Mile — all weeks"
      />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {weeks.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="time-outline" size={48} color={C.muted} />
            <Text style={s.emptyText}>No history yet</Text>
            <Text style={s.emptySub}>Your weekly summaries will appear here</Text>
          </View>
        )}

        {weeks.map((wk) => (
          <View key={wk} style={s.weekCard}>
            <TouchableOpacity style={s.weekHeader} onPress={() => toggleWeek(wk)} activeOpacity={0.7}>
              <View style={s.weekIconBox}>
                <Ionicons
                  name={paidKeys.has(wk) ? 'checkmark-circle' : 'calendar-outline'}
                  size={18}
                  color={paidKeys.has(wk) ? C.success : C.accent}
                />
              </View>
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatPeriodDisplay(getPeriod(wk, schedule))}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''} · pay day ${formatPayDate(getPeriod(wk, schedule))}`
                    : `Pay day ${formatPayDate(getPeriod(wk, schedule))}`}
                  {paidKeys.has(wk) ? <Text style={s.paidNote}> · Paid</Text> : null}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteWeek(wk)} style={s.deleteWeekBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={15} color={C.danger} />
              </TouchableOpacity>
              <Ionicons name={expanded === wk ? 'chevron-up' : 'chevron-down'} size={18} color={C.muted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {expanded === wk && weekData[wk] && (
              <View style={s.weekContent}>
                <View style={s.summaryStrip}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Earnings</Text>
                    <Text style={s.summaryValue}>{fmt(weekData[wk].totalEarnings)}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Loads</Text>
                    <Text style={s.summaryValue}>{weekData[wk].loads.length}</Text>
                  </View>
                </View>

                <View style={s.netRow}>
                  <Text style={s.netLabel}>Net Profit</Text>
                  <Text style={[s.netValue, { color: weekData[wk].netProfit >= 0 ? C.success : C.danger }]}>
                    {fmt(weekData[wk].netProfit)}
                  </Text>
                </View>

                {weekData[wk].loads.length > 0 && (
                  <>
                    <Text style={s.loadsTitle}>Loads</Text>
                    {weekData[wk].loads.map((load) => (
                      <View key={load.id} style={s.loadCard}>
                        <View style={s.loadTop}>
                          <View style={s.routeBadge}>
                            <Ionicons name="navigate-outline" size={12} color={C.accent} />
                          </View>
                          <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                        </View>
                        <Text style={s.loadDetail}>
                          {load.paidMileage} mi{(load.extraMileage ?? 0) > 0 ? ` + ${load.extraMileage} extra` : ''} × ${load.centsPerMile?.toFixed(2)}/mi = <Text style={s.bold}>{fmt(((load.paidMileage ?? 0) + (load.extraMileage ?? 0)) * (load.centsPerMile ?? 0))}</Text>
                        </Text>
                        <View style={s.loadActions}>
                          <TouchableOpacity style={s.editBtn} onPress={() => handleEditLoad(load)}>
                            <Ionicons name="pencil-outline" size={13} color={C.accent} />
                            <Text style={s.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteLoad(load)}>
                            <Ionicons name="trash-outline" size={13} color={C.danger} />
                            <Text style={s.deleteBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 140 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4 },
  weekCard: {
    backgroundColor: C.card, borderRadius: 20, marginBottom: 12,
    overflow: 'hidden',
  },
  weekHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  weekIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center' },
  weekLabelBox: { flex: 1 },
  weekLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  weekSub: { fontSize: 12, color: C.sub, marginTop: 1 },
  paidNote: { color: C.success, fontWeight: '700' },
  deleteWeekBtn: { padding: 6, backgroundColor: C.cardElevated, borderRadius: 8 },
  weekContent: { paddingHorizontal: 14, paddingBottom: 14 },
  summaryStrip: { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: C.cardElevated },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: C.sub, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: C.text, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: C.border, marginHorizontal: 4 },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 2 },
  netLabel: { fontSize: 14, fontWeight: '700', color: C.sub },
  netValue: { fontSize: 20, fontWeight: '900' },
  loadsTitle: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 8, letterSpacing: 0.5 },
  loadCard: { backgroundColor: C.cardElevated, borderRadius: 14, padding: 12, marginBottom: 8 },
  loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  routeBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  loadRoute: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  loadDetail: { fontSize: 12, color: C.sub, marginBottom: 8 },
  bold: { fontWeight: '700', color: C.text },
  loadActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.card, borderRadius: 8 },
  editBtnText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.card, borderRadius: 8 },
  deleteBtnText: { color: C.danger, fontSize: 12, fontWeight: '600' },
});
