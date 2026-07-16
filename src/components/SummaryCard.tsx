// src/components/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

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

export { fmt } from '../utils/format';

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  label: { fontSize: 14, color: C.sub },
  value: { fontSize: 14, color: C.text, fontWeight: '700' },
  highlight: { color: C.accent, fontSize: 16, fontWeight: '700' },
});
