// src/components/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Row = { label: string; value: string; highlight?: boolean };

type Props = { rows: Row[] };

export function SummaryCard({ rows }: Props) {
  return (
    <View style={styles.card}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.highlight && styles.highlight]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function fmt(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, color: '#111', fontWeight: '600' },
  highlight: { color: '#1a6b3c', fontSize: 16, fontWeight: '700' },
});
