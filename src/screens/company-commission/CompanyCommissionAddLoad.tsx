import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { showDialog } from '../../components/AppDialog';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { CommissionSelector } from '../../components/CommissionSelector';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatePicker } from '../../components/StatePicker';
import { ConfirmedAmountField } from '../../components/ConfirmedAmountField';
import { splitCityState, joinCityState } from '../../utils/usStates';
import { saveLoad } from '../../storage/storage';
import { useWeek } from '../../context/WeekContext';
import { formatPeriodDisplay } from '../../utils/payPeriods';
import { C } from '../../theme';
import type { LoadEntry } from '../../types';

type Props = { navigation: any; route: any };

export function CompanyCommissionAddLoad({ navigation, route }: Props) {
  const { weekKey, period } = useWeek();
  const editLoad: LoadEntry | undefined = route.params?.load;

  const [startCity, setStartCity] = useState('');
  const [startState, setStartState] = useState<string | null>(null);
  const [endCity, setEndCity] = useState('');
  const [endState, setEndState] = useState<string | null>(null);
  // Inline, per-field validation messages — shown next to the offending field
  // rather than only in a popup, so it's obvious what to fix.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [earnings, setEarnings] = useState(0);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (editLoad) {
        const start = splitCityState(editLoad.startLocation);
        const end = splitCityState(editLoad.endLocation);
        setStartCity(start.city);
        setStartState(start.state);
        setEndCity(end.city);
        setEndState(end.state);
        setEarnings(editLoad.earnings ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setEarnings(0);
        setCommissionRate(null);
      }
    }, [editLoad?.id])
  );

  const driverCut = commissionRate != null && earnings > 0
    ? (earnings * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    const next: Record<string, string> = {};
    if (!startCity.trim()) next.startCity = 'Enter the pickup city.';
    if (!startState) next.startState = 'Select the pickup state.';
    if (!endCity.trim()) next.endCity = 'Enter the delivery city.';
    if (!endState) next.endState = 'Select the delivery state.';
    if (earnings <= 0) next.earnings = 'Enter the load earnings and tap ✓ to confirm.';
    if (commissionRate === null) next.commission = 'Pick your commission rate.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showDialog('Check the highlighted fields', Object.values(next).join('\n\n'));
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType: 'company-commission',
      startLocation: joinCityState(startCity, startState!),
      endLocation: joinCityState(endCity, endState!),
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      earnings,
      // Non-null: the validation above returns unless a rate is picked.
      commissionRate: commissionRate!,
    };
    setErrors({});
    await saveLoad(load);
    navigation.setParams({ load: undefined });
    navigation.navigate('Dashboard');
  }

  const err = (k: string) => (errors[k] ? <Text style={s.errorText}>{errors[k]}</Text> : null);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title={editLoad ? 'Edit Load' : 'Add Load'}
        subtitle={formatPeriodDisplay(period)}
        left={
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.fieldLabel}>STARTING CITY</Text>
          <TextInput
            style={[s.input, errors.startCity && s.inputError]}
            value={startCity}
            onChangeText={(t) => { setStartCity(t); if (errors.startCity) setErrors((e) => ({ ...e, startCity: '' })); }}
            placeholder="e.g. Dallas" placeholderTextColor={C.muted}
          />
          {err('startCity')}
          <Text style={s.fieldLabel}>STARTING STATE</Text>
          <StatePicker label="Select state" value={startState} onSelect={(v) => { setStartState(v); setErrors((e) => ({ ...e, startState: '' })); }} />
          {err('startState')}

          <Text style={s.fieldLabel}>ENDING CITY</Text>
          <TextInput
            style={[s.input, errors.endCity && s.inputError]}
            value={endCity}
            onChangeText={(t) => { setEndCity(t); if (errors.endCity) setErrors((e) => ({ ...e, endCity: '' })); }}
            placeholder="e.g. Miami" placeholderTextColor={C.muted}
          />
          {err('endCity')}
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={(v) => { setEndState(v); setErrors((e) => ({ ...e, endState: '' })); }} />
          {err('endState')}

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => { setEarnings(v); setErrors((e) => ({ ...e, earnings: '' })); }}
            onDelete={() => setEarnings(0)}
          />
          {err('earnings')}

          <CommissionSelector
            label="COMMISSION RATE"
            options={[0, 0.20, 0.25, 0.30, 0.35]}
            selected={commissionRate}
            onSelect={(v) => { setCommissionRate(v); setErrors((e) => ({ ...e, commission: '' })); }}
          />
          {err('commission')}

          {driverCut !== null && (
            <View style={s.calcBox}>
              <Ionicons name="calculator-outline" size={16} color={C.accent} />
              <Text style={s.calcText}>Your Cut: ${driverCut}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <View style={s.saveBtn}>
              <Text style={s.saveBtnText}>{editLoad ? 'Update Load' : 'Save Load'}</Text>
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
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, marginBottom: 12,
    fontSize: 16, color: C.text,
  },
  inputError: { borderWidth: 1, borderColor: C.danger, marginBottom: 4 },
  errorText: { color: C.danger, fontSize: 12, fontWeight: '600', marginBottom: 10, paddingLeft: 6 },
  calcBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 20,
  },
  calcText: { color: C.accent, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  saveBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
});
