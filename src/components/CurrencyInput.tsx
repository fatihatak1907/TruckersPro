// src/components/CurrencyInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

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
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, color: '#555', marginBottom: 4, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: '#fafafa',
  },
  prefix: { fontSize: 16, color: '#333', marginRight: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, color: '#111' },
});
