import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
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
  const [tonu, setTonu] = useState(0);
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
        setTonu(editLoad.tonu ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setEarnings(0);
        setTonu(0);
        setCommissionRate(null);
      }
    }, [editLoad?.id])
  );

  const commissionAmount = commissionRate != null && earnings > 0
    ? (earnings * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    const hasTonu = tonu > 0;
    if (!startCity.trim() || !startState || !endCity.trim() || !endState) {
      Alert.alert('Missing fields', 'Please enter city and select a state for both start and end.');
      return;
    }
    if (!hasTonu && (earnings <= 0 || commissionRate === null)) {
      Alert.alert('Missing fields', 'Enter earnings and select a commission rate, or enter a TONU amount.');
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType,
      startLocation: joinCityState(startCity, startState),
      endLocation: joinCityState(endCity, endState),
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      earnings,
      tonu,
      commissionRate: commissionRate ?? 0,
    };
    await saveLoad(load);
    navigation.setParams({ load: undefined });
    navigation.navigate('Dashboard');
  }

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
          <TextInput style={s.input} value={startCity} onChangeText={setStartCity} placeholder="e.g. Dallas" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>STARTING STATE</Text>
          <StatePicker label="Select state" value={startState} onSelect={setStartState} />

          <Text style={s.fieldLabel}>ENDING CITY</Text>
          <TextInput style={s.input} value={endCity} onChangeText={setEndCity} placeholder="e.g. Los Angeles" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={setEndState} />

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => setEarnings(v)}
            onDelete={() => setEarnings(0)}
          />

          <CommissionSelector
            label="COMMISSION FEE"
            options={[0, 0.10, 0.12, 0.15]}
            selected={commissionRate}
            onSelect={setCommissionRate}
          />

          {commissionAmount !== null && (
            <View style={s.calcBox}>
              <Ionicons name="calculator-outline" size={16} color={C.accent} />
              <Text style={s.calcText}>Commission: ${commissionAmount}</Text>
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
