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
import { ConfirmedAmountField } from '../../components/ConfirmedAmountField';
import { StatePicker } from '../../components/StatePicker';
import { splitCityState, joinCityState } from '../../utils/usStates';
import { saveLoad } from '../../storage/storage';
import { useWeek } from '../../context/WeekContext';
import { formatPeriodDisplay } from '../../utils/payPeriods';
import { C } from '../../theme';
import type { LoadEntry, DriverType } from '../../types';

type Props = { navigation: any; route: any };

export function OwnerOpAddLoad({ navigation, route }: Props) {
  const driverType = (route.params?.driverType ?? route.params?.load?.driverType ?? 'owner-op') as DriverType;
  const { weekKey, period } = useWeek();
  const editLoad: LoadEntry | undefined = route.params?.load;

  const [startCity, setStartCity] = useState('');
  const [startState, setStartState] = useState<string | null>(null);
  const [endCity, setEndCity] = useState('');
  const [endState, setEndState] = useState<string | null>(null);
  const [earnings, setEarnings] = useState(0);
  const [loadedMiles, setLoadedMiles] = useState(0);
  const [deadheadMiles, setDeadheadMiles] = useState(0);
  const [tonu, setTonu] = useState(0);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);
  const [customerPct, setCustomerPct] = useState(0); // whole percent, e.g. 5 = 5%
  // Inline, per-field validation messages — shown next to the offending field
  // rather than only in a popup, so it's obvious what to fix.
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        setLoadedMiles(editLoad.loadedMiles ?? 0);
        setDeadheadMiles(editLoad.deadheadMiles ?? 0);
        setTonu(editLoad.tonu ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
        setCustomerPct(Math.round(((editLoad.customerCommissionRate ?? 0) * 100) * 100) / 100);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setEarnings(0);
        setLoadedMiles(0);
        setDeadheadMiles(0);
        setTonu(0);
        setCommissionRate(null);
        setCustomerPct(0);
      }
    }, [editLoad?.id])
  );

  const commissionAmount = commissionRate != null && earnings > 0
    ? (earnings * commissionRate).toFixed(2)
    : null;
  const customerAmount = customerPct > 0 && earnings > 0
    ? (earnings * (customerPct / 100)).toFixed(2)
    : null;
  const totalMiles = loadedMiles + deadheadMiles;
  const rpm = totalMiles > 0 && earnings > 0 ? earnings / totalMiles : null;

  async function handleSave() {
    const hasTonu = tonu > 0;
    const next: Record<string, string> = {};
    if (!startCity.trim()) next.startCity = 'Enter the pickup city.';
    if (!startState) next.startState = 'Select the pickup state.';
    if (!endCity.trim()) next.endCity = 'Enter the delivery city.';
    if (!endState) next.endState = 'Select the delivery state.';
    if (!hasTonu && earnings <= 0) {
      next.earnings = 'Enter the load earnings (and tap ✓), or enter a TONU amount below.';
    }
    // TONU alone doesn't need a commission — but if earnings were entered too,
    // a commission choice is still required (0% is a valid choice).
    if (!hasTonu && commissionRate === null) {
      next.commission = 'Pick a commission fee — choose 0% if there is none.';
    } else if (earnings > 0 && commissionRate === null) {
      next.commission = 'Pick a commission fee — choose 0% if there is none.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showDialog(
        'Check the highlighted fields',
        Object.values(next).join('\n\n')
      );
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType,
      // Non-null: the validation above returns unless both states are set.
      startLocation: joinCityState(startCity, startState!),
      endLocation: joinCityState(endCity, endState!),
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      earnings,
      tonu,
      commissionRate: commissionRate ?? 0,
      customerCommissionRate: customerPct > 0 ? customerPct / 100 : undefined,
      loadedMiles: loadedMiles > 0 ? loadedMiles : undefined,
      deadheadMiles: deadheadMiles > 0 ? deadheadMiles : undefined,
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
            placeholder="e.g. Los Angeles" placeholderTextColor={C.muted}
          />
          {err('endCity')}
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={(v) => { setEndState(v); setErrors((e) => ({ ...e, endState: '' })); }} />
          {err('endState')}

          <ConfirmedAmountField
            key={`loadedmi:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="LOADED MILES"
            amount={loadedMiles}
            money={false}
            placeholder="e.g. 1450"
            onCommit={(v) => setLoadedMiles(Math.max(0, Math.round(v)))}
            onDelete={() => setLoadedMiles(0)}
          />

          <ConfirmedAmountField
            key={`deadheadmi:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="DEAD HEAD MILES"
            amount={deadheadMiles}
            money={false}
            placeholder="e.g. 100"
            onCommit={(v) => setDeadheadMiles(Math.max(0, Math.round(v)))}
            onDelete={() => setDeadheadMiles(0)}
          />

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => { setEarnings(v); setErrors((e) => ({ ...e, earnings: '' })); }}
            onDelete={() => setEarnings(0)}
          />
          {err('earnings')}

          <CommissionSelector
            label="COMMISSION FEE"
            options={[0, 0.10, 0.12, 0.15]}
            selected={commissionRate}
            onSelect={(v) => { setCommissionRate(v); setErrors((e) => ({ ...e, commission: '' })); }}
          />
          {err('commission')}

          <ConfirmedAmountField
            key={`custcomm:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="CUSTOMER COMMISSION (%)"
            amount={customerPct}
            percent
            placeholder="e.g. 5"
            onCommit={(v) => setCustomerPct(Math.min(100, Math.max(0, v)))}
            onDelete={() => setCustomerPct(0)}
          />

          {(commissionAmount !== null || customerAmount !== null || rpm !== null) && (
            <View style={s.calcBox}>
              <Ionicons name="calculator-outline" size={16} color={C.accent} />
              <View>
                {rpm !== null && (
                  <Text style={s.calcText}>
                    Rate per mile: ${rpm.toFixed(2)}/mi ({totalMiles.toLocaleString()} mi total)
                  </Text>
                )}
                {commissionAmount !== null && (
                  <Text style={s.calcText}>Commission: ${commissionAmount}</Text>
                )}
                {customerAmount !== null && (
                  <Text style={s.calcText}>Customer commission: ${customerAmount}</Text>
                )}
              </View>
            </View>
          )}

          <ConfirmedAmountField
            key={`tonu:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="TONU ($)"
            amount={tonu}
            onCommit={(v) => setTonu(v)}
            onDelete={() => setTonu(0)}
          />

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
