import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';

type Props = {
  label: string;
  options: number[];
  selected: number | null;
  onSelect: (v: number) => void;
};

export function CommissionSelector({ label, options, selected, onSelect }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[s.pill, selected === opt && s.pillSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[s.pillText, selected === opt && s.pillTextSelected]}>
              {(opt * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    backgroundColor: C.card,
  },
  pillSelected: { backgroundColor: C.accent },
  pillText: { fontSize: 14, color: C.text, fontWeight: '600' },
  pillTextSelected: { color: C.accentText, fontWeight: '700' },
});
