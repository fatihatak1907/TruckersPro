import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyInput } from '../../components/CurrencyInput';
import { CommissionSelector } from '../../components/CommissionSelector';
import { saveLoad } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function OwnerOpAddLoad() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [earnings, setEarnings] = useState('');
  const [diesel, setDiesel] = useState('');
  const [def, setDef] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  const commissionAmount = commissionRate && earnings
    ? (parseFloat(earnings) * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !earnings || !commissionRate) {
      Alert.alert('Missing fields', 'Please fill in all required fields and select a commission rate.');
      return;
    }
    const load: LoadEntry = {
      id: uuidv4(),
      weekKey: getCurrentWeekKey(),
      driverType: 'owner-op',
      startLocation,
      endLocation,
      createdAt: new Date().toISOString(),
      earnings: parseFloat(earnings),
      commissionRate,
      diesel: parseFloat(diesel) || 0,
      def: parseFloat(def) || 0,
    };
    await saveLoad(load);
    Alert.alert('Saved', 'Load added successfully.');
    setStartLocation(''); setEndLocation('');
    setEarnings(''); setDiesel(''); setDef('');
    setCommissionRate(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Add Load</Text>

        <Text style={s.label}>Starting State / Address</Text>
        <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX or Dallas, TX" placeholderTextColor="#999" />

        <Text style={s.label}>End State / Address</Text>
        <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. CA or Los Angeles, CA" placeholderTextColor="#999" />

        <CurrencyInput label="Earnings (Load Pay)" value={earnings} onChangeText={setEarnings} />
        <CurrencyInput label="Diesel Cost" value={diesel} onChangeText={setDiesel} />
        <CurrencyInput label="DEF Cost" value={def} onChangeText={setDef} />

        <CommissionSelector
          label="Commission Fee"
          options={[0.10, 0.12, 0.15]}
          selected={commissionRate}
          onSelect={setCommissionRate}
        />

        {commissionAmount && (
          <Text style={s.commCalc}>Commission: ${commissionAmount}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Load</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16, color: '#111',
  },
  commCalc: { color: '#1a6b3c', fontWeight: '600', marginBottom: 16, fontSize: 15 },
  btn: {
    backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
