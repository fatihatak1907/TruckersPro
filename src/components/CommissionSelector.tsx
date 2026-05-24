// src/components/CommissionSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  label: string;
  options: number[];   // e.g. [0.10, 0.12, 0.15]
  selected: number | null;
  onSelect: (v: number) => void;
};

export function CommissionSelector({ label, options, selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pill, selected === opt && styles.pillSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.pillText, selected === opt && styles.pillTextSelected]}>
              {(opt * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, color: '#555', marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5',
  },
  pillSelected: { backgroundColor: '#1a3c6b', borderColor: '#1a3c6b' },
  pillText: { fontSize: 14, color: '#444' },
  pillTextSelected: { color: '#fff', fontWeight: '700' },
});
