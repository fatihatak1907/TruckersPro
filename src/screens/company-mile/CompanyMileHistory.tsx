import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getAllWeekKeys } from '../../storage/storage';
import { calcCompanyMileSummary } from '../../utils/calculations';
import type { CompanyMileWeeklySummary } from '../../types';

export function CompanyMileHistory() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, CompanyMileWeeklySummary>>({});

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('company-mile').then(setWeeks);
    }, [])
  );

  async function toggleWeek(weekKey: string) {
    if (expanded === weekKey) { setExpanded(null); return; }
    const loads = await getLoadsForWeek('company-mile', weekKey);
    const summary = loads.length > 0
      ? calcCompanyMileSummary(loads)
      : { weekKey, totalEarnings: 0, netProfit: 0 };
    setSummaries((prev) => ({ ...prev, [weekKey]: summary }));
    setExpanded(weekKey);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>History</Text>
        {weeks.length === 0 && <Text style={s.empty}>No past weeks yet.</Text>}
        {weeks.map((wk) => (
          <TouchableOpacity key={wk} style={s.weekRow} onPress={() => toggleWeek(wk)}>
            <Text style={s.weekLabel}>Week of {wk}</Text>
            <Text style={s.arrow}>{expanded === wk ? '▲' : '▼'}</Text>
            {expanded === wk && summaries[wk] && (
              <SummaryCard rows={[
                { label: 'Total Earnings', value: fmt(summaries[wk].totalEarnings) },
                { label: 'Net Profit', value: fmt(summaries[wk].netProfit), highlight: true },
              ]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 16 },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  weekRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  weekLabel: { fontWeight: '600', color: '#333' },
  arrow: { position: 'absolute', right: 16, top: 16, color: '#888' },
});
