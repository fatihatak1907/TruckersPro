import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek } from '../../storage/storage';
import { calcCompanyCommissionSummary } from '../../utils/calculations';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyCommissionDashboard() {
  const weekKey = getCurrentWeekKey();
  const [loads, setLoads] = useState<LoadEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getLoadsForWeek('company-commission', weekKey).then(setLoads);
    }, [weekKey])
  );

  const summary = loads.length > 0
    ? calcCompanyCommissionSummary(loads)
    : { weekKey, totalEarnings: 0, netProfit: 0 };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Commission Driver</Text>
        <Text style={s.week}>Week of {weekKey}</Text>
        <Text style={s.sub}>{loads.length} load{loads.length !== 1 ? 's' : ''} this week</Text>

        <SummaryCard rows={[
          { label: 'Total Earnings', value: fmt(summary.totalEarnings) },
          { label: 'Net Profit', value: fmt(summary.netProfit), highlight: true },
        ]} />

        {loads.length > 0 && (
          <>
            <Text style={s.loadsTitle}>Loads This Week</Text>
            {loads.map((load) => (
              <View key={load.id} style={s.loadCard}>
                <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                <Text style={s.loadDetail}>
                  {fmt(load.earnings ?? 0)} × {((load.commissionRate ?? 0) * 100).toFixed(0)}% = {fmt((load.earnings ?? 0) * (load.commissionRate ?? 0))}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a3c6b' },
  week: { color: '#888', marginBottom: 4 },
  sub: { color: '#aaa', marginBottom: 16, fontSize: 13 },
  loadsTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  loadCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  loadRoute: { fontWeight: '700', color: '#222', marginBottom: 4 },
  loadDetail: { color: '#666', fontSize: 13 },
});
