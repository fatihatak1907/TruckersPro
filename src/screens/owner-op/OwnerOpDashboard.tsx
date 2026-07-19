import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getWeeklyExpenses, deleteLoad, getFuelEntriesForWeek, saveProfileName, getProfileName } from '../../storage/storage';
import { calcOwnerOpSummary } from '../../utils/calculations';
import { useWeek } from '../../context/WeekContext';
import { C } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SignOutButton } from '../../components/SignOutButton';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../../types';
import { addPeriods, periodCalcOpts } from '../../utils/payPeriods';
import { buildInsight, InsightKind, WeekData } from '../../utils/insights';
import { InsightsSheet } from '../../components/InsightsSheet';
import { NameEditModal } from '../../components/NameEditModal';
import { PeriodBar } from '../../components/PeriodBar';
import { PayScheduleBanner } from '../../components/PayScheduleBanner';
import { PayScheduleModal } from '../PayScheduleScreen';
import { usePeriodPaid } from '../../hooks/usePeriodPaid';

const EMPTY_EXPENSES: WeeklyExpenses = {
  weekKey: '',
  truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, truckInsuranceFrequency: 'weekly',
  trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
  trailerLease: 0, trailerLeaseFrequency: 'weekly',
  iftaCost: 0, iftaCostFrequency: 'weekly',
  adminFee: 0, adminFeeFrequency: 'weekly',
  other: 0, otherFrequency: 'weekly',
  startOdometer: 0, endOdometer: 0,
};

type Props = { navigation: any; route: any };

export function OwnerOpDashboard({ navigation, route }: Props) {
  const driverType: string = route.params?.driverType ?? 'owner-op';
  const { weekKey, period, schedule, needsSetup, reloadSchedule } = useWeek();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [expenses, setExpenses] = useState<WeeklyExpenses>({ ...EMPTY_EXPENSES, weekKey });
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [driverName, setDriverName] = useState('');
  const [openInsight, setOpenInsight] = useState<InsightKind | null>(null);
  const [prevWeek, setPrevWeek] = useState<WeekData | null>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const { paid, togglePaid } = usePeriodPaid(driverType);

  useFocusEffect(
    useCallback(() => {
      const prevKey = addPeriods(weekKey, -1, schedule);
      Promise.all([
        getLoadsForWeek(driverType, weekKey),
        getWeeklyExpenses(driverType, weekKey),
        getFuelEntriesForWeek(driverType, weekKey),
        getProfileName(),
        getLoadsForWeek(driverType, prevKey),
        getWeeklyExpenses(driverType, prevKey),
        getFuelEntriesForWeek(driverType, prevKey),
      ]).then(([l, e, f, name, pl, pe, pf]) => {
        setLoads(l);
        setExpenses(e ?? { ...EMPTY_EXPENSES, weekKey });
        setFuelEntries(f);
        setDriverName(name);
        setPrevWeek({
          loads: pl,
          expenses: pe ?? { ...EMPTY_EXPENSES, weekKey: prevKey },
          fuelEntries: pf,
        });
      });
    }, [weekKey, schedule])
  );

  const mileageOn = driverType !== 'owner-op';
  const calcPeriod = periodCalcOpts(period, schedule);
  const summary = calcOwnerOpSummary(loads, expenses, fuelEntries, { mileage: mileageOn, period: calcPeriod });
  const title = driverType === 'lease' ? 'Lease Driver' : 'Owner Operator';

  function handleEditName() {
    setNameModalOpen(true);
  }

  function handleEdit(load: LoadEntry) {
    navigation.navigate('AddLoad', { load });
  }

  function handleDelete(load: LoadEntry) {
    Alert.alert('Delete Load', `Remove ${load.startLocation} → ${load.endLocation}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteLoad(driverType, load.weekKey, load.id);
        setLoads((prev) => prev.filter((l) => l.id !== load.id));
      }},
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={driverName || 'Tap to add name'}
        subtitle={title}
        onPress={handleEditName}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SyncStatusBadge />
            <SignOutButton />
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <PayScheduleBanner onOpen={() => setScheduleOpen(true)} />
        <PeriodBar onOpenSchedule={() => setScheduleOpen(true)} paid={paid} onTogglePaid={togglePaid} />

        <TouchableOpacity
          style={[s.netCard, paid && s.netCardPaid]}
          onPress={() => setOpenInsight('net')}
          activeOpacity={0.8}
        >
          {paid && (
            <View style={s.paidBadge}>
              <Ionicons name="checkmark-circle" size={13} color={C.accentText} />
              <Text style={s.paidBadgeText}>Paid</Text>
            </View>
          )}
          <Text style={s.netLabel}>NET PROFIT</Text>
          <Text style={[s.netValue, { color: summary.netProfit >= 0 ? C.success : C.danger }]}>
            {fmt(summary.netProfit)}
          </Text>
          <Text style={s.tapHint}>Tap for details</Text>
        </TouchableOpacity>

        <View style={s.statsGrid}>
          {([
            { label: 'Earnings', value: fmt(summary.totalEarnings), icon: 'trending-up', kind: 'earnings' },
            { label: 'Expenses', value: fmt(summary.totalExpenses), icon: 'trending-down', kind: 'expenses' },
            { label: 'Diesel', value: fmt(summary.totalDiesel), icon: 'water', kind: 'diesel' },
            { label: 'DEF', value: fmt(summary.totalDef), icon: 'water-outline', kind: 'def' },
            ...(mileageOn
              ? [
                  { label: 'Miles', value: `${summary.milesDriven.toLocaleString()} mi`, icon: 'speedometer-outline', kind: 'miles' },
                  { label: 'Mi. Deduct', value: fmt(summary.mileageDeduction), icon: 'remove-circle-outline', kind: 'deduction' },
                ]
              : []),
          ] as { label: string; value: string; icon: string; kind: InsightKind }[]).map((item) => (
            <TouchableOpacity key={item.label} style={[s.statCard, !mileageOn && s.statCardWide]} onPress={() => setOpenInsight(item.kind)} activeOpacity={0.8}>
              <Ionicons name={item.icon as any} size={18} color={C.accent} style={s.statIcon} />
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={12} color={C.muted} style={s.statChevron} />
            </TouchableOpacity>
          ))}
        </View>

        {loads.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Loads This Week</Text>
            {loads.map((load) => (
              <View key={load.id} style={s.loadCard}>
                <View style={s.loadTop}>
                  <View style={s.routeBadge}>
                    <Ionicons name="navigate-outline" size={14} color={C.accent} />
                  </View>
                  <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                </View>
                <View style={s.loadDetails}>
                  <Text style={s.loadDetail}>Earnings: <Text style={s.loadDetailBold}>{fmt(load.earnings ?? 0)}</Text></Text>
                  {(load.tonu ?? 0) > 0 && (
                    <Text style={s.loadDetail}>TONU: <Text style={s.loadDetailBold}>{fmt(load.tonu ?? 0)}</Text></Text>
                  )}
                  <Text style={s.loadDetail}>Commission fee: <Text style={s.loadDetailBold}>{((load.commissionRate ?? 0) * 100).toFixed(0)}%</Text></Text>
                </View>
                <View style={s.loadActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => handleEdit(load)}>
                    <Ionicons name="pencil-outline" size={14} color={C.accent} />
                    <Text style={s.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(load)}>
                    <Ionicons name="trash-outline" size={14} color={C.danger} />
                    <Text style={s.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {loads.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="cube-outline" size={48} color={C.muted} />
            <Text style={s.emptyText}>No loads this week</Text>
            <Text style={s.emptySub}>Tap Add Load to get started</Text>
          </View>
        )}
      </ScrollView>
      <InsightsSheet
        insight={
          openInsight
            ? buildInsight(openInsight, { loads, expenses, fuelEntries }, prevWeek, { mileage: mileageOn, period: calcPeriod })
            : null
        }
        onClose={() => setOpenInsight(null)}
      />
      <PayScheduleModal
        visible={scheduleOpen}
        initialSchedule={needsSetup ? null : schedule}
        onClose={() => setScheduleOpen(false)}
        onSaved={reloadSchedule}
      />
      <NameEditModal
        visible={nameModalOpen}
        initialName={driverName}
        onSave={async (name) => {
          await saveProfileName(name);
          setDriverName(name);
        }}
        onClose={() => setNameModalOpen(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 120 },
  netCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  netCardPaid: { borderWidth: 1.5, borderColor: C.success, backgroundColor: 'rgba(52, 199, 89, 0.08)' },
  paidBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.success, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  paidBadgeText: { fontSize: 10, fontWeight: '800', color: C.accentText },
  netLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5 },
  netValue: { fontSize: 40, fontWeight: '900', marginTop: 8 },
  tapHint: { fontSize: 11, color: C.muted, marginTop: 6, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: '30%', backgroundColor: C.card, borderRadius: 18, padding: 12,
    alignItems: 'center',
  },
  // Owner-op only (4 cards): 45% + gap forces exactly 2 equal cards per row.
  statCardWide: { minWidth: '45%' },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 15, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  statChevron: { position: 'absolute', top: 8, right: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.sub, marginBottom: 12 },
  loadCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 10,
  },
  loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  routeBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center' },
  loadRoute: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  loadDetails: { gap: 2, marginBottom: 10 },
  loadDetail: { fontSize: 13, color: C.sub },
  loadDetailBold: { fontWeight: '700', color: C.text },
  loadActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.cardElevated, borderRadius: 8 },
  editBtnText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.cardElevated, borderRadius: 8 },
  deleteBtnText: { color: C.danger, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 4 },
});
