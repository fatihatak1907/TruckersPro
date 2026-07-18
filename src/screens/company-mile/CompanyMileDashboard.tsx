import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, deleteLoad } from '../../storage/storage';
import { calcCompanyMileSummary } from '../../utils/calculations';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SignOutButton } from '../../components/SignOutButton';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import type { LoadEntry } from '../../types';

type Props = { navigation: any };

export function CompanyMileDashboard({ navigation }: Props) {
  const { weekKey, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
  const [loads, setLoads] = useState<LoadEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getLoadsForWeek('company-mile', weekKey).then(setLoads);
    }, [weekKey])
  );

  const summary = loads.length > 0 ? calcCompanyMileSummary(loads) : { weekKey, totalEarnings: 0, netProfit: 0 };

  function handleEdit(load: LoadEntry) { navigation.navigate('AddLoad', { load }); }

  function handleDelete(load: LoadEntry) {
    Alert.alert('Delete Load', `Remove ${load.startLocation} → ${load.endLocation}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteLoad('company-mile', load.weekKey, load.id);
        setLoads((prev) => prev.filter((l) => l.id !== load.id));
      }},
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Company Per Mile"
        subtitle="Driver dashboard"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SyncStatusBadge />
            <SignOutButton />
          </View>
        }
      />

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.weekNavCard}>
          <TouchableOpacity onPress={goToPrev} disabled={!canGoPrev} style={[s.navBtn, !canGoPrev && s.navBtnDisabled]}>
            <Ionicons name="chevron-back" size={20} color={C.sub} />
          </TouchableOpacity>
          <Text style={s.weekLabel}>{formatWeekDisplay(weekKey)}</Text>
          <TouchableOpacity onPress={goToNext} disabled={!canGoNext} style={[s.navBtn, !canGoNext && s.navBtnDisabled]}>
            <Ionicons name="chevron-forward" size={20} color={C.sub} />
          </TouchableOpacity>
        </View>

        <View style={s.netCard}>
          <Text style={s.netLabel}>NET PROFIT</Text>
          <Text style={[s.netValue, { color: summary.netProfit >= 0 ? C.success : C.danger }]}>
            {fmt(summary.netProfit)}
          </Text>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="trending-up" size={18} color={C.accent} style={s.statIcon} />
            <Text style={s.statValue}>{fmt(summary.totalEarnings)}</Text>
            <Text style={s.statLabel}>Total Earnings</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="cube-outline" size={18} color={C.accent} style={s.statIcon} />
            <Text style={s.statValue}>{loads.length}</Text>
            <Text style={s.statLabel}>Loads</Text>
          </View>
        </View>

        {loads.length > 0 ? (
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
                <Text style={s.loadDetail}>
                  {load.paidMileage} mi × ${load.centsPerMile?.toFixed(2)}/mi = <Text style={s.loadDetailBold}>{fmt((load.paidMileage ?? 0) * (load.centsPerMile ?? 0))}</Text>
                </Text>
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
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="cube-outline" size={48} color={C.muted} />
            <Text style={s.emptyText}>No loads this week</Text>
            <Text style={s.emptySub}>Tap Add Load to get started</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 120 },
  weekNavCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 12,
  },
  navBtn: { padding: 4 },
  navBtnDisabled: { opacity: 0.3 },
  weekLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  netCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 24,
    alignItems: 'center', marginBottom: 16,
  },
  netLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5 },
  netValue: { fontSize: 40, fontWeight: '900', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14, alignItems: 'center',
  },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', color: C.text },
  statLabel: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.sub, marginBottom: 12 },
  loadCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 14, marginBottom: 10,
  },
  loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  routeBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center' },
  loadRoute: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  loadDetail: { fontSize: 13, color: C.sub, marginBottom: 10 },
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
