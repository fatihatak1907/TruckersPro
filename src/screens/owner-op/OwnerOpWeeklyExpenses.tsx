import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import type { WeeklyExpenses } from '../../types';

function Field({ label, value, onChange, keyboard = 'decimal-pad' as any, placeholder = '0.00' }: {
  label: string; value: string; onChange: (v: string) => void; keyboard?: any; placeholder?: string;
}) {
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        <Text style={s.prefix}>$</Text>
        <TextInput
          style={s.inputFlex}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
        />
      </View>
    </>
  );
}

export function OwnerOpWeeklyExpenses({ route }: { route: any }) {
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const { weekKey } = useWeek();
  const [truckPayment, setTruckPayment] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [truckInsurance, setTruckInsurance] = useState('');
  const [trailerInsurance, setTrailerInsurance] = useState('');
  const [trailerLease, setTrailerLease] = useState('');
  const [iftaCost, setIftaCost] = useState('');
  const [adminFee, setAdminFee] = useState('');
  const [other, setOther] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');

  useFocusEffect(
    useCallback(() => {
      getWeeklyExpenses(driverType, weekKey).then((saved) => {
        if (!saved) {
          setTruckPayment(''); setFrequency('weekly'); setTruckInsurance('');
          setTrailerInsurance(''); setTrailerLease(''); setIftaCost('');
          setAdminFee(''); setOther(''); setStartOdometer(''); setEndOdometer('');
          return;
        }
        setTruckPayment(String(saved.truckPayment));
        setFrequency(saved.truckPaymentFrequency);
        setTruckInsurance(String(saved.truckInsurance));
        setTrailerInsurance(String(saved.trailerInsurance));
        setTrailerLease(String(saved.trailerLease));
        setIftaCost(String(saved.iftaCost));
        setAdminFee(String(saved.adminFee));
        setOther(String(saved.other ?? 0));
        setStartOdometer(String(saved.startOdometer));
        setEndOdometer(String(saved.endOdometer));
      });
    }, [weekKey])
  );

  const startOdo = parseFloat(startOdometer) || 0;
  const endOdo = parseFloat(endOdometer) || 0;
  const milesDriven = endOdo > startOdo ? endOdo - startOdo : 0;
  const mileageDeduction = milesDriven * 0.14;

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
      other: parseFloat(other) || 0,
      startOdometer: startOdo,
      endOdometer: endOdo,
    };
    await saveWeeklyExpenses(driverType, expenses);
    Alert.alert('Saved', 'Weekly expenses updated.');
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerInner}>
            <Text style={s.headerTitle}>Weekly Expenses</Text>
            <Text style={s.headerSub}>{formatWeekDisplay(weekKey)}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.sectionTitle}>TRUCK PAYMENT</Text>
          <View style={s.inputRow}>
            <Text style={s.prefix}>$</Text>
            <TextInput
              style={s.inputFlex}
              value={truckPayment}
              onChangeText={setTruckPayment}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.muted}
            />
          </View>
          <View style={s.toggleRow}>
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

          <Text style={s.sectionTitle}>INSURANCE & FEES</Text>
          <Field label="TRUCK INSURANCE (WEEKLY)" value={truckInsurance} onChange={setTruckInsurance} />
          <Field label="TRAILER INSURANCE (WEEKLY)" value={trailerInsurance} onChange={setTrailerInsurance} />
          <Field label="TRAILER LEASE (WEEKLY)" value={trailerLease} onChange={setTrailerLease} />
          <Field label="IFTA STICKER COST (WEEKLY)" value={iftaCost} onChange={setIftaCost} />
          <Field label="ADMIN FEE (WEEKLY)" value={adminFee} onChange={setAdminFee} />
          <Field label="OTHER (WEEKLY)" value={other} onChange={setOther} />

          <Text style={s.sectionTitle}>MILEAGE (ODOMETER)</Text>
          <Text style={s.fieldLabel}>STARTING ODOMETER</Text>
          <TextInput
            style={s.input}
            value={startOdometer}
            onChangeText={setStartOdometer}
            keyboardType="number-pad"
            placeholder="e.g. 100000"
            placeholderTextColor={C.muted}
          />
          <Text style={s.fieldLabel}>ENDING ODOMETER</Text>
          <TextInput
            style={s.input}
            value={endOdometer}
            onChangeText={setEndOdometer}
            keyboardType="number-pad"
            placeholder="e.g. 103500"
            placeholderTextColor={C.muted}
          />

          {milesDriven > 0 && (
            <View style={s.calcBox}>
              <Ionicons name="speedometer-outline" size={16} color={C.gradEnd} />
              <View>
                <Text style={s.calcText}>Miles driven: {milesDriven.toLocaleString()} mi</Text>
                <Text style={s.calcText}>Mileage deduction: ${mileageDeduction.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.saveBtn}>
              <Text style={s.saveBtnText}>Save Expenses</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerInner: { paddingTop: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  form: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 14, marginBottom: 16, backgroundColor: C.inputBg, fontSize: 16, color: C.text,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    backgroundColor: C.inputBg, paddingHorizontal: 14, marginBottom: 16,
  },
  prefix: { fontSize: 16, color: C.sub, marginRight: 6 },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 14, color: C.text },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, alignItems: 'center',
  },
  toggleActive: { backgroundColor: C.gradEnd, borderColor: C.gradEnd },
  toggleText: { fontSize: 14, color: C.sub, fontWeight: '600' },
  toggleTextActive: { color: '#fff', fontWeight: '700' },
  calcBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 14, marginBottom: 20,
  },
  calcText: { color: C.gradEnd, fontWeight: '600', fontSize: 14, lineHeight: 22 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
