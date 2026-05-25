import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, deleteLoad } from '../../storage/storage';
import { calcCompanyCommissionSummary } from '../../utils/calculations';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import type { LoadEntry } from '../../types';

type Props = { navigation: any };

export function CompanyCommissionDashboard({ navigation }: Props) {
  const { weekKey, goToPrev, goToNext } = useWeek();
  const [loads, setLoads] = useState<LoadEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getLoadsForWeek('company-commission', weekKey).then(setLoads);
    }, [weekKey])
  );

  const summary = loads.length > 0 ? calcCompanyCommissionSummary(loads) : { weekKey, totalEarnings: 0, netProfit: 0 };

  function handleEdit(load: LoadEntry) { navigation.navigate('AddLoad', { load }); }

  function handleDelete(load: LoadEntry) {
    Alert.alert('Delete Load', `Remove ${load.startLocation} → ${load.endLocation}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteLoad('company-commission', load.weekKey, load.id);
        setLoads((prev) => prev.filter((l) => l.id !== load.id));
      }},
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerTop}>
            <Text style={s.headerTitle}>Commission Driver</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.homeBtn}>
              <Ionicons name="home-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={s.weekNav}>
            <TouchableOpacity onPress={goToPrev}><Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" /></TouchableOpacity>
            <Text style={s.weekLabel}>{formatWeekDisplay(weekKey)}</Text>
            <TouchableOpacity onPress={goToNext}><Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" /></TouchableOpacity>
          </View>
          <View style={s.netBox}>
            <Text style={s.netLabel}>NET PROFIT</Text>
            <Text style={[s.netValue, { color: summary.netProfit >= 0 ? '#34D399' : '#FCA5A5' }]}>{fmt(summary.netProfit)}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="trending-up" size={18} color={C.gradEnd} />
            <Text style={s.statValue}>{fmt(summary.totalEarnings)}</Text>
            <Text style={s.statLabel}>Total Earnings</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="cube-outline" size={18} color={C.gradEnd} />
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
                  <View style={s.routeBadge}><Ionicons name="navigate-outline" size={14} color={C.gradEnd} /></View>
                  <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                </View>
                <Text style={s.loadDetail}>
                  {fmt(load.earnings ?? 0)} × {((load.commissionRate ?? 0) * 100).toFixed(0)}% = <Text style={{ fontWeight: '700', color: C.text }}>{fmt((load.earnings ?? 0) * (load.commissionRate ?? 0))}</Text>
                </Text>
                <View style={s.loadActions}>
                  <TouchableOpacity style={s.editBtn} onPress={() => handleEdit(load)}>
                    <Ionicons name="pencil-outline" size={14} color={C.gradEnd} />
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
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  homeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  weekLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  netBox: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  netLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 },
  netValue: { fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  body: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, marginTop: -8 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: '#1E3A8A', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 6 },
  statLabel: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  loadCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: '#1E3A8A', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  loadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  routeBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  loadRoute: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  loadDetail: { fontSize: 13, color: C.sub, marginBottom: 10 },
  loadActions: { flexDirection: 'row', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EFF6FF', borderRadius: 8 },
  editBtnText: { color: C.gradEnd, fontSize: 13, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FEF2F2', borderRadius: 8 },
  deleteBtnText: { color: C.danger, fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
});
