import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { CommissionSelector } from '../../components/CommissionSelector';
import { saveLoad } from '../../storage/storage';
import { useWeek } from '../../context/WeekContext';
import { C } from '../../theme';
import type { LoadEntry } from '../../types';

type Props = { navigation: any; route: any };

export function CompanyCommissionAddLoad({ navigation, route }: Props) {
  const { weekKey } = useWeek();
  const editLoad: LoadEntry | undefined = route.params?.load;

  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [earnings, setEarnings] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (editLoad) {
        setStartLocation(editLoad.startLocation);
        setEndLocation(editLoad.endLocation);
        setEarnings(editLoad.earnings != null ? String(editLoad.earnings) : '');
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartLocation('');
        setEndLocation('');
        setEarnings('');
        setCommissionRate(null);
      }
    }, [editLoad?.id])
  );

  const driverCut = commissionRate != null && earnings
    ? (parseFloat(earnings) * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !earnings || commissionRate === null) {
      Alert.alert('Missing fields', 'Please fill in all fields and select a commission rate.');
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType: 'company-commission',
      startLocation,
      endLocation,
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      earnings: parseFloat(earnings),
      commissionRate,
    };
    await saveLoad(load);
    navigation.setParams({ load: undefined });
    navigation.navigate('Dashboard');
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={s.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{editLoad ? 'Edit Load' : 'Add Load'}</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.fieldLabel}>STARTING STATE / ADDRESS</Text>
          <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX or Dallas, TX" placeholderTextColor={C.muted} />

          <Text style={s.fieldLabel}>END STATE / ADDRESS</Text>
          <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. FL or Miami, FL" placeholderTextColor={C.muted} />

          <Text style={s.fieldLabel}>EARNINGS ($)</Text>
          <View style={s.inputRow}>
            <Text style={s.prefix}>$</Text>
            <TextInput style={s.inputFlex} value={earnings} onChangeText={setEarnings} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.muted} />
          </View>

          <CommissionSelector
            label="COMMISSION RATE"
            options={[0, 0.20, 0.25, 0.30, 0.35]}
            selected={commissionRate}
            onSelect={setCommissionRate}
          />

          {driverCut !== null && (
            <View style={s.calcBox}>
              <Ionicons name="calculator-outline" size={16} color={C.gradEnd} />
              <Text style={s.calcText}>Your Cut: ${driverCut}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
            <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.saveBtn}>
              <Text style={s.saveBtnText}>{editLoad ? 'Update Load' : 'Save Load'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  form: { padding: 20, paddingBottom: 60 },
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
  calcBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 20,
  },
  calcText: { color: C.gradEnd, fontWeight: '600', fontSize: 14 },
  saveBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
