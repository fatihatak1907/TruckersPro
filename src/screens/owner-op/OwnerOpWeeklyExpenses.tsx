import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { CurrencyInput } from '../../components/CurrencyInput';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { WeeklyExpenses } from '../../types';

export function OwnerOpWeeklyExpenses() {
  const weekKey = getCurrentWeekKey();
  const [truckPayment, setTruckPayment] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [truckInsurance, setTruckInsurance] = useState('');
  const [trailerInsurance, setTrailerInsurance] = useState('');
  const [trailerLease, setTrailerLease] = useState('');
  const [iftaCost, setIftaCost] = useState('');
  const [adminFee, setAdminFee] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');

  useEffect(() => {
    getWeeklyExpenses(weekKey).then((saved) => {
      if (!saved) return;
      setTruckPayment(String(saved.truckPayment));
      setFrequency(saved.truckPaymentFrequency);
      setTruckInsurance(String(saved.truckInsurance));
      setTrailerInsurance(String(saved.trailerInsurance));
      setTrailerLease(String(saved.trailerLease));
      setIftaCost(String(saved.iftaCost));
      setAdminFee(String(saved.adminFee));
      setStartOdometer(String(saved.startOdometer));
      setEndOdometer(String(saved.endOdometer));
    });
  }, []);

  async function handleSave() {
    const expenses: WeeklyExpenses = {
      weekKey,
      truckPayment: parseFloat(truckPayment) || 0,
      truckPaymentFrequency: frequency,
      truckInsurance: parseFloat(truckInsurance) || 0,
      trailerInsurance: parseFloat(trailerInsurance) || 0,
      trailerLease: parseFloat(trailerLease) || 0,
      iftaCost: parseFloat(iftaCost) || 0,
      adminFee: parseFloat(adminFee) || 0,
      startOdometer: parseFloat(startOdometer) || 0,
      endOdometer: parseFloat(endOdometer) || 0,
    };
    await saveWeeklyExpenses(expenses);
    Alert.alert('Saved', 'Weekly expenses updated.');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Weekly Expenses</Text>
        <Text style={s.week}>Week of {weekKey}</Text>

        <Text style={s.label}>Truck Payment</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <CurrencyInput label="" value={truckPayment} onChangeText={setTruckPayment} />
          </View>
          <View style={s.toggle}>
            {(['weekly', 'monthly'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.toggleBtn, frequency === f && s.toggleActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[s.toggleText, frequency === f && s.toggleTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <CurrencyInput label="Truck Insurance (Weekly)" value={truckInsurance} onChangeText={setTruckInsurance} />
        <CurrencyInput label="Trailer Insurance (Weekly)" value={trailerInsurance} onChangeText={setTrailerInsurance} />
        <CurrencyInput label="Trailer Lease (Weekly)" value={trailerLease} onChangeText={setTrailerLease} />
        <CurrencyInput label="IFTA Sticker Cost (Weekly)" value={iftaCost} onChangeText={setIftaCost} />
        <CurrencyInput label="Admin Fee (Weekly)" value={adminFee} onChangeText={setAdminFee} />

        <Text style={s.section}>Mileage (Odometer)</Text>
        <Text style={s.label}>Starting Odometer</Text>
        <TextInput style={s.input} value={startOdometer} onChangeText={setStartOdometer} keyboardType="number-pad" placeholder="e.g. 100000" placeholderTextColor="#999" />
        <Text style={s.label}>Ending Odometer</Text>
        <TextInput style={s.input} value={endOdometer} onChangeText={setEndOdometer} keyboardType="number-pad" placeholder="e.g. 103500" placeholderTextColor="#999" />

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Expenses</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 4 },
  week: { color: '#888', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  section: { fontSize: 16, fontWeight: '700', color: '#1a3c6b', marginTop: 8, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16, color: '#111',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  toggle: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5',
  },
  toggleActive: { backgroundColor: '#1a3c6b', borderColor: '#1a3c6b' },
  toggleText: { fontSize: 13, color: '#444' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
