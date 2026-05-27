// src/components/CurrencyInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { C } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
};

export function CurrencyInput({ label, value, onChangeText, placeholder = '0.00' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={C.muted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, color: C.sub, marginBottom: 4, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  prefix: { fontSize: 16, color: C.sub },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
});
