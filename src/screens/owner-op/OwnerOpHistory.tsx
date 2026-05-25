import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fmt } from '../../components/SummaryCard';
import {
  getLoadsForWeek, getWeeklyExpenses, getAllWeekKeys,
  getFuelEntriesForWeek, deleteLoad, deleteWeekData,
} from '../../storage/storage';
import { calcOwnerOpSummary } from '../../utils/calculations';
import { formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import type { WeeklyExpenses, LoadEntry } from '../../types';

const EMPTY_EXPENSES: WeeklyExpenses = {
  weekKey: '', truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, trailerInsurance: 0, trailerLease: 0,
  iftaCost: 0, adminFee: 0, startOdometer: 0, endOdometer: 0,
};

type Props = { navigation: any };

type WeekData = {
  summary: ReturnType<typeof calcOwnerOpSummary>;
  loads: LoadEntry[];
};

export function OwnerOpHistory({ navigation }: Props) {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [weekData, setWeekData] = useState<Record<string, WeekData>>({});

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('owner-op').then(setWeeks);
    }, [])
  );

  async function loadWeekData(weekKey: string) {
    const [loads, expenses, fuelEntries] = await Promise.all([
      getLoadsForWeek('owner-op', weekKey),
      getWeeklyExpenses(weekKey),
      getFuelEntriesForWeek(weekKey),
    ]);
    const summary = calcOwnerOpSummary(
      loads,
      expenses ?? { ...EMPTY_EXPENSES, weekKey },
      fuelEntries
    );
    setWeekData((prev) => ({ ...prev, [weekKey]: { summary, loads } }));
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
          await deleteLoad('owner-op', load.weekKey, load.id);
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
    Alert.alert('Delete Week', 'Delete all data for this week?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteWeekData('owner-op', weekKey);
          setWeeks((prev) => prev.filter((w) => w !== weekKey));
          if (expanded === weekKey) setExpanded(null);
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <Text style={s.headerTitle}>History</Text>
          <Text style={s.headerSub}>Owner Operator — all weeks</Text>
        </SafeAreaView>
      </LinearGradient>

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
                <Ionicons name="calendar-outline" size={18} color={C.gradEnd} />
              </View>
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatWeekDisplay(wk)}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''}`
                    : 'Tap to expand'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteWeek(wk)} style={s.deleteWeekBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={15} color={C.danger} />
              </TouchableOpacity>
              <Ionicons
                name={expanded === wk ? 'chevron-up' : 'chevron-down'}
                size={18} color={C.muted} style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {expanded === wk && weekData[wk] && (
              <View style={s.weekContent}>
                {/* Summary strip */}
                <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={s.summaryStrip}>
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Earnings</Text>
                    <Text style={s.summaryValue}>{fmt(weekData[wk].summary.totalEarnings)}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Expenses</Text>
                    <Text style={s.summaryValue}>{fmt(weekData[wk].summary.totalExpenses)}</Text>
                  </View>
                  <View style={s.summaryDivider} />
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>Miles</Text>
                    <Text style={s.summaryValue}>{weekData[wk].summary.milesDriven.toLocaleString()}</Text>
                  </View>
                </LinearGradient>

                {/* Net Profit */}
                <View style={s.netRow}>
                  <Text style={s.netLabel}>Net Profit</Text>
                  <Text style={[s.netValue, { color: weekData[wk].summary.netProfit >= 0 ? C.accent : C.danger }]}>
                    {fmt(weekData[wk].summary.netProfit)}
                  </Text>
                </View>

                {/* Loads */}
                {weekData[wk].loads.length > 0 && (
                  <>
                    <Text style={s.loadsTitle}>Loads</Text>
                    {weekData[wk].loads.map((load) => (
                      <View key={load.id} style={s.loadCard}>
                        <View style={s.loadTop}>
                          <View style={s.routeBadge}>
                            <Ionicons name="navigate-outline" size={12} color={C.gradEnd} />
                          </View>
                          <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                        </View>
                        <Text style={s.loadDetail}>
                          Earnings: <Text style={s.bold}>{fmt(load.earnings ?? 0)}</Text>
                          {(load.tonu ?? 0) > 0 ? `  TONU: ${fmt(load.tonu ?? 0)}` : ''}
                          {'  '}Commission fee: <Text style={s.bold}>{((load.commissionRate ?? 0) * 100).toFixed(0)}%</Text>
                        </Text>
                        <View style={s.loadActions}>
                          <TouchableOpacity style={s.editBtn} onPress={() => handleEditLoad(load)}>
                            <Ionicons name="pencil-outline" size={13} color={C.gradEnd} />
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
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 12 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  body: { padding: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4 },
  weekCard: {
    backgroundColor: C.card, borderRadius: 16, marginBottom: 12,
    shadowColor: '#1E3A8A', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    overflow: 'hidden',
  },
  weekHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  weekIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  weekLabelBox: { flex: 1 },
  weekLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  weekSub: { fontSize: 12, color: C.muted, marginTop: 1 },
  deleteWeekBtn: { padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 },
  weekContent: { paddingHorizontal: 14, paddingBottom: 14 },
  summaryStrip: { flexDirection: 'row', borderRadius: 12, padding: 12, marginBottom: 10 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 11, color: C.sub, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '800', color: C.text, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: '#BFDBFE', marginHorizontal: 4 },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 2 },
  netLabel: { fontSize: 14, fontWeight: '700', color: C.sub },
  netValue: { fontSize: 20, fontWeight: '900' },
  loadsTitle: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 8, letterSpacing: 0.5 },
  loadCard: { backgroundColor: C.bg, borderRadius: 12, padding: 12, marginBottom: 8 },
  loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  routeBadge: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  loadRoute: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  loadDetail: { fontSize: 12, color: C.sub, marginBottom: 8 },
  bold: { fontWeight: '700', color: C.text },
  loadActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 8 },
  editBtnText: { color: C.gradEnd, fontSize: 12, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FEF2F2', borderRadius: 8 },
  deleteBtnText: { color: C.danger, fontSize: 12, fontWeight: '600' },
});
