import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export type DriverTypeChoice = 'owner-op' | 'lease' | 'company-mile' | 'company-commission';

const OPTIONS: { value: DriverTypeChoice; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'owner-op',           label: 'Owner Op',     icon: 'car-sport-outline' },
  { value: 'lease',              label: 'Lease',        icon: 'key-outline' },
  { value: 'company-mile',       label: 'Company $/mi', icon: 'speedometer-outline' },
  { value: 'company-commission', label: 'Company %',    icon: 'briefcase-outline' },
];

type Props = {
  selected: DriverTypeChoice | null;
  onSelect: (v: DriverTypeChoice) => void;
};

export function DriverTypeGrid({ selected, onSelect }: Props) {
  return (
    <View style={s.grid}>
      {OPTIONS.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.cell, active && s.cellActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={opt.icon}
              size={28}
              color={active ? C.accentText : C.text}
            />
            <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    flexBasis: '47%',
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    minHeight: 100,
  },
  cellActive: {
    backgroundColor: C.accent,
  },
  label: { color: C.text, fontSize: 13, fontWeight: '700' },
  labelActive: { color: C.accentText },
});
