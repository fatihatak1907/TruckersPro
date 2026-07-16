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
import { saveLoad } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { C } from '../../theme';
import type { LoadEntry, DriverType } from '../../types';

type Props = { navigation: any; route: any };

export function OwnerOpAddLoad({ navigation, route }: Props) {
  const driverType = (route.params?.driverType ?? route.params?.load?.driverType ?? 'owner-op') as DriverType;
  const { weekKey } = useWeek();
  const editLoad: LoadEntry | undefined = route.params?.load;

  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [earnings, setEarnings] = useState(0);
  const [tonu, setTonu] = useState(0);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (editLoad) {
        setStartLocation(editLoad.startLocation);
        setEndLocation(editLoad.endLocation);
        setEarnings(editLoad.earnings ?? 0);
        setTonu(editLoad.tonu ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartLocation('');
        setEndLocation('');
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
    if (!startLocation || !endLocation) {
      Alert.alert('Missing fields', 'Please enter starting and end location.');
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
      startLocation,
      endLocation,
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
        subtitle={formatWeekDisplay(weekKey)}
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
          <Text style={s.fieldLabel}>STARTING STATE / ADDRESS</Text>
          <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX or Dallas, TX" placeholderTextColor={C.muted} />

          <Text style={s.fieldLabel}>END STATE / ADDRESS</Text>
          <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. CA or Los Angeles, CA" placeholderTextColor={C.muted} />

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => setEarnings(v)}
            onDelete={() => setEarnings(0)}
          />
          <ConfirmedAmountField
            key={`tonu:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="TONU ($)"
            amount={tonu}
            onCommit={(v) => setTonu(v)}
            onDelete={() => setTonu(0)}
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
