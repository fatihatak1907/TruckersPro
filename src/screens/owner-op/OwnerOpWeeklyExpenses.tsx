import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import type { WeeklyExpenses, Frequency } from '../../types';

function FreqToggle({ value, onChange }: { value: Frequency; onChange: (v: Frequency) => void }) {
  return (
    <View style={s.freqRow}>
      {(['weekly', 'monthly'] as const).map((f) => (
        <TouchableOpacity
          key={f}
          style={[s.freqBtn, value === f && s.freqBtnActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.8}
        >
          <Text style={[s.freqText, value === f && s.freqTextActive]}>
            {f === 'weekly' ? 'W' : 'M'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ExpenseRow({
  label, amount, onAmountChange, frequency, onFrequencyChange,
}: {
  label: string;
  amount: string;
  onAmountChange: (v: string) => void;
  frequency: Frequency;
  onFrequencyChange: (v: Frequency) => void;
}) {
  return (
    <View style={s.expenseBlock}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        <Text style={s.prefix}>$</Text>
        <TextInput
          style={s.inputFlex}
          value={amount}
          onChangeText={onAmountChange}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={C.muted}
        />
        <FreqToggle value={frequency} onChange={onFrequencyChange} />
      </View>
    </View>
  );
}

export function OwnerOpWeeklyExpenses({ route }: { route: any }) {
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const { weekKey } = useWeek();

  const [truckPayment, setTruckPayment] = useState('');
  const [truckPaymentFreq, setTruckPaymentFreq] = useState<Frequency>('weekly');
  const [truckInsurance, setTruckInsurance] = useState('');
  const [truckInsuranceFreq, setTruckInsuranceFreq] = useState<Frequency>('weekly');
  const [trailerInsurance, setTrailerInsurance] = useState('');
  const [trailerInsuranceFreq, setTrailerInsuranceFreq] = useState<Frequency>('weekly');
  const [trailerLease, setTrailerLease] = useState('');
  const [trailerLeaseFreq, setTrailerLeaseFreq] = useState<Frequency>('weekly');
  const [iftaCost, setIftaCost] = useState('');
  const [iftaCostFreq, setIftaCostFreq] = useState<Frequency>('weekly');
  const [adminFee, setAdminFee] = useState('');
  const [adminFeeFreq, setAdminFeeFreq] = useState<Frequency>('weekly');
  const [other, setOther] = useState('');
  const [otherFreq, setOtherFreq] = useState<Frequency>('weekly');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');

  useFocusEffect(
    useCallback(() => {
      getWeeklyExpenses(driverType, weekKey).then((saved) => {
        if (!saved) {
          setTruckPayment(''); setTruckPaymentFreq('weekly');
          setTruckInsurance(''); setTruckInsuranceFreq('weekly');
          setTrailerInsurance(''); setTrailerInsuranceFreq('weekly');
          setTrailerLease(''); setTrailerLeaseFreq('weekly');
          setIftaCost(''); setIftaCostFreq('weekly');
          setAdminFee(''); setAdminFeeFreq('weekly');
          setOther(''); setOtherFreq('weekly');
          setStartOdometer(''); setEndOdometer('');
          return;
        }
        setTruckPayment(String(saved.truckPayment));
        setTruckPaymentFreq(saved.truckPaymentFrequency);
        setTruckInsurance(String(saved.truckInsurance));
        setTruckInsuranceFreq(saved.truckInsuranceFrequency ?? 'weekly');
        setTrailerInsurance(String(saved.trailerInsurance));
        setTrailerInsuranceFreq(saved.trailerInsuranceFrequency ?? 'weekly');
        setTrailerLease(String(saved.trailerLease));
        setTrailerLeaseFreq(saved.trailerLeaseFrequency ?? 'weekly');
        setIftaCost(String(saved.iftaCost));
        setIftaCostFreq(saved.iftaCostFrequency ?? 'weekly');
        setAdminFee(String(saved.adminFee));
        setAdminFeeFreq(saved.adminFeeFrequency ?? 'weekly');
        setOther(String(saved.other ?? 0));
        setOtherFreq(saved.otherFrequency ?? 'weekly');
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
      truckPaymentFrequency: truckPaymentFreq,
      truckInsurance: parseFloat(truckInsurance) || 0,
      truckInsuranceFrequency: truckInsuranceFreq,
      trailerInsurance: parseFloat(trailerInsurance) || 0,
      trailerInsuranceFrequency: trailerInsuranceFreq,
      trailerLease: parseFloat(trailerLease) || 0,
      trailerLeaseFrequency: trailerLeaseFreq,
      iftaCost: parseFloat(iftaCost) || 0,
      iftaCostFrequency: iftaCostFreq,
      adminFee: parseFloat(adminFee) || 0,
      adminFeeFrequency: adminFeeFreq,
      other: parseFloat(other) || 0,
      otherFrequency: otherFreq,
      startOdometer: startOdo,
      endOdometer: endOdo,
    };
    await saveWeeklyExpenses(driverType, expenses);
    Alert.alert('Saved', 'Expenses updated.');
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Expenses"
        subtitle={formatWeekDisplay(weekKey)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.sectionTitle}>RECURRING EXPENSES</Text>
          <ExpenseRow label="TRUCK PAYMENT"     amount={truckPayment}     onAmountChange={setTruckPayment}     frequency={truckPaymentFreq}     onFrequencyChange={setTruckPaymentFreq} />
          <ExpenseRow label="TRUCK INSURANCE"   amount={truckInsurance}   onAmountChange={setTruckInsurance}   frequency={truckInsuranceFreq}   onFrequencyChange={setTruckInsuranceFreq} />
          <ExpenseRow label="TRAILER INSURANCE" amount={trailerInsurance} onAmountChange={setTrailerInsurance} frequency={trailerInsuranceFreq} onFrequencyChange={setTrailerInsuranceFreq} />
          <ExpenseRow label="TRAILER LEASE"     amount={trailerLease}     onAmountChange={setTrailerLease}     frequency={trailerLeaseFreq}     onFrequencyChange={setTrailerLeaseFreq} />
          <ExpenseRow label="IFTA STICKER COST" amount={iftaCost}         onAmountChange={setIftaCost}         frequency={iftaCostFreq}         onFrequencyChange={setIftaCostFreq} />
          <ExpenseRow label="ADMIN FEE"         amount={adminFee}         onAmountChange={setAdminFee}         frequency={adminFeeFreq}         onFrequencyChange={setAdminFeeFreq} />
          <ExpenseRow label="OTHER"             amount={other}            onAmountChange={setOther}            frequency={otherFreq}            onFrequencyChange={setOtherFreq} />

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>MILEAGE (ODOMETER)</Text>
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
              <Ionicons name="speedometer-outline" size={16} color={C.accent} />
              <View>
                <Text style={s.calcText}>Miles driven: {milesDriven.toLocaleString()} mi</Text>
                <Text style={s.calcText}>Mileage deduction: ${mileageDeduction.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <View style={s.saveBtn}>
              <Text style={s.saveBtnText}>Save Expenses</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  form: { padding: 20, paddingBottom: 140 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  expenseBlock: { marginBottom: 4 },
  input: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, marginBottom: 12,
    fontSize: 16, color: C.text,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16,
    paddingLeft: 16, paddingRight: 6, marginBottom: 12,
  },
  prefix: { fontSize: 16, color: C.sub },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  freqRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: C.bg, borderRadius: 999,
    padding: 3,
  },
  freqBtn: {
    width: 32, height: 28,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  freqBtnActive: { backgroundColor: C.accent },
  freqText: { fontSize: 11, color: C.sub, fontWeight: '700' },
  freqTextActive: { color: C.accentText, fontWeight: '800' },
  calcBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 20, marginTop: 8,
  },
  calcText: { color: C.accent, fontWeight: '600', fontSize: 14, lineHeight: 22 },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
});
