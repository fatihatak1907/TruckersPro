import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyInput } from '../../components/CurrencyInput';
import { saveLoad } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyMileAddLoad() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [paidMileage, setPaidMileage] = useState('');
  const [centsPerMile, setCentsPerMile] = useState('');

  const loadEarnings = paidMileage && centsPerMile
    ? (parseFloat(paidMileage) * parseFloat(centsPerMile)).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !paidMileage || !centsPerMile) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    const load: LoadEntry = {
      id: uuidv4(),
      weekKey: getCurrentWeekKey(),
      driverType: 'company-mile',
      startLocation, endLocation,
      createdAt: new Date().toISOString(),
      paidMileage: parseFloat(paidMileage),
      centsPerMile: parseFloat(centsPerMile),
    };
    await saveLoad(load);
    Alert.alert('Saved', 'Load added successfully.');
    setStartLocation(''); setEndLocation('');
    setPaidMileage(''); setCentsPerMile('');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Add Load</Text>

        <Text style={s.label}>Starting State / Address</Text>
        <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX" placeholderTextColor="#999" />

        <Text style={s.label}>End State / Address</Text>
        <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. CA" placeholderTextColor="#999" />

        <Text style={s.label}>Paid Mileage</Text>
        <TextInput style={s.input} value={paidMileage} onChangeText={setPaidMileage} keyboardType="number-pad" placeholder="e.g. 500" placeholderTextColor="#999" />

        <CurrencyInput label="Paid Amount ($ per mile)" value={centsPerMile} onChangeText={setCentsPerMile} placeholder="0.55" />

        {loadEarnings && (
          <Text style={s.calc}>Load Earnings: ${loadEarnings}</Text>
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
  calc: { color: '#1a6b3c', fontWeight: '600', marginBottom: 16, fontSize: 15 },
  btn: { backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
