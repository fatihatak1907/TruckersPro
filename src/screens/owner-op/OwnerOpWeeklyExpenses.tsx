import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConfirmedAmountField, FreqToggle } from '../../components/ConfirmedAmountField';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { useWeek } from '../../context/WeekContext';
import { formatPeriodDisplay } from '../../utils/payPeriods';
import { fmt } from '../../utils/format';
import { C } from '../../theme';
import type { WeeklyExpenses, Frequency, OtherExpense, OtherFrequency } from '../../types';

const EMPTY: WeeklyExpenses = {
  weekKey: '',
  truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, truckInsuranceFrequency: 'weekly',
  trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
  trailerLease: 0, trailerLeaseFrequency: 'weekly',
  iftaCost: 0, iftaCostFrequency: 'weekly',
  adminFee: 0, adminFeeFrequency: 'weekly',
  other: 0, otherFrequency: 'weekly',
  otherExpenses: [],
  startOdometer: 0, endOdometer: 0,
  mileageRate: 0.14,
};

type AmountKey = 'truckPayment' | 'truckInsurance' | 'trailerInsurance' | 'trailerLease' | 'iftaCost' | 'adminFee';
type FreqKey = `${AmountKey}Frequency`;

const FIXED_FIELDS: { key: AmountKey; freqKey: FreqKey; label: string }[] = [
  { key: 'truckPayment',     freqKey: 'truckPaymentFrequency',     label: 'TRUCK PAYMENT' },
  { key: 'truckInsurance',   freqKey: 'truckInsuranceFrequency',   label: 'TRUCK INSURANCE' },
  { key: 'trailerInsurance', freqKey: 'trailerInsuranceFrequency', label: 'TRAILER INSURANCE' },
  { key: 'trailerLease',     freqKey: 'trailerLeaseFrequency',     label: 'TRAILER LEASE' },
  { key: 'iftaCost',         freqKey: 'iftaCostFrequency',         label: 'IFTA STICKER COST' },
  { key: 'adminFee',         freqKey: 'adminFeeFrequency',         label: 'ADMIN FEE' },
];

type OtherEditorProps = {
  initial?: OtherExpense;
  onCommit: (entry: OtherExpense) => void;
  onCancel: () => void;
};

function OtherExpenseEditor({ initial, onCommit, onCancel }: OtherEditorProps) {
  const [name, setName] = useState(initial?.label ?? '');
  const [draft, setDraft] = useState(initial ? String(initial.amount) : '');
  const [freq, setFreq] = useState<OtherFrequency>(initial?.frequency ?? 'weekly');
  const [nameError, setNameError] = useState(false);
  const valid = (parseFloat(draft) || 0) > 0;

  function confirm() {
    const label = name.trim();
    if (!label) { setNameError(true); return; }
    onCommit({
      id: initial?.id ?? uuidv4(),
      label,
      amount: parseFloat(draft) || 0,
      frequency: freq,
    });
  }

  return (
    <View style={s.otherEditor}>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={(t) => { setName(t); setNameError(false); }}
        placeholder="Expense name (e.g. Truck wash)"
        placeholderTextColor={C.muted}
      />
      {nameError && <Text style={s.nameError}>Name required</Text>}
      <View style={s.inputRow}>
        <Text style={s.prefix}>$</Text>
        <TextInput
          style={s.inputFlex}
          value={draft}
          onChangeText={setDraft}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={C.muted}
        />
        <FreqToggle
          value={freq}
          onChange={setFreq}
          options={['once', 'daily', 'weekly', 'biweekly', 'monthly'] as const}
          labels={{ once: '1x', daily: 'D', weekly: 'W', biweekly: '2W', monthly: 'M' }}
        />
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Ionicons name="close" size={18} color={C.sub} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.confirmBtn, !valid && s.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!valid}
        >
          <Ionicons name="checkmark" size={20} color={valid ? C.accentText : C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function OwnerOpWeeklyExpenses({ route }: { route: any }) {
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const isOwnerOp = driverType === 'owner-op';
  const { weekKey, period } = useWeek();
  const [exp, setExp] = useState<WeeklyExpenses>({ ...EMPTY, weekKey });
  const [addingOther, setAddingOther] = useState(false);
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getWeeklyExpenses(driverType, weekKey).then((saved) => {
        setExp(saved ?? { ...EMPTY, weekKey });
        setAddingOther(false);
        setEditingOtherId(null);
      });
    }, [weekKey])
  );

  function persist(updated: WeeklyExpenses) {
    setExp(updated);
    saveWeeklyExpenses(driverType, updated);
  }

  function commitField(key: AmountKey, freqKey: FreqKey, amount: number, freq: Frequency) {
    persist({ ...exp, [key]: amount, [freqKey]: freq } as WeeklyExpenses);
  }

  function commitOdometer(key: 'startOdometer' | 'endOdometer', value: number) {
    persist({ ...exp, [key]: value });
  }

  function commitMileageRate(v: number) {
    persist({ ...exp, mileageRate: v > 0 ? v : 0.14 });
  }

  function commitOther(entry: OtherExpense) {
    const list = exp.otherExpenses ?? [];
    const updated = list.some((o) => o.id === entry.id)
      ? list.map((o) => (o.id === entry.id ? entry : o))
      : [...list, entry];
    persist({ ...exp, otherExpenses: updated, other: 0, otherFrequency: 'weekly' });
    setAddingOther(false);
    setEditingOtherId(null);
  }

  function deleteOther(id: string) {
    persist({ ...exp, otherExpenses: (exp.otherExpenses ?? []).filter((o) => o.id !== id) });
  }

  const milesDriven = exp.endOdometer > exp.startOdometer ? exp.endOdometer - exp.startOdometer : 0;
  const mileageDeduction = milesDriven * (exp.mileageRate ?? 0.14);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Expenses" subtitle={formatPeriodDisplay(period)} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.sectionTitle}>RECURRING EXPENSES</Text>
          {FIXED_FIELDS.map((f) => (
            <ConfirmedAmountField
              key={`${f.key}:${weekKey}`}
              label={f.label}
              amount={exp[f.key]}
              frequency={exp[f.freqKey]}
              onCommit={(amount, freq) => commitField(f.key, f.freqKey, amount, freq)}
              onDelete={() => commitField(f.key, f.freqKey, 0, 'weekly')}
            />
          ))}

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>OTHER EXPENSES</Text>
          {(exp.otherExpenses ?? []).map((o) =>
            editingOtherId === o.id ? (
              <OtherExpenseEditor
                key={`${o.id}:${weekKey}`}
                initial={o}
                onCommit={commitOther}
                onCancel={() => setEditingOtherId(null)}
              />
            ) : (
              <View key={o.id} style={s.lockedRow}>
                <Ionicons name="checkmark-circle" size={18} color={C.success} />
                <Text style={s.otherLabel} numberOfLines={1}>{o.label}</Text>
                <Text style={s.lockedValue}>{fmt(o.amount)}</Text>
                <View style={s.freqBadge}>
                  <Text style={s.freqBadgeText}>
                    {o.frequency === 'monthly' ? 'M' : o.frequency === 'biweekly' ? '2W' : o.frequency === 'daily' ? 'D' : o.frequency === 'once' ? '1x' : 'W'}
                  </Text>
                </View>
                <View style={s.lockedActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => { setEditingOtherId(o.id); setAddingOther(false); }}>
                    <Ionicons name="pencil-outline" size={16} color={C.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() =>
                      Alert.alert(`Remove ${o.label}?`, undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => deleteOther(o.id) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}
          {addingOther ? (
            <OtherExpenseEditor key={`add-other:${weekKey}`} onCommit={commitOther} onCancel={() => setAddingOther(false)} />
          ) : (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => { setAddingOther(true); setEditingOtherId(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={C.accent} />
              <Text style={s.addBtnText}>Add Expense</Text>
            </TouchableOpacity>
          )}

          {!isOwnerOp && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 16 }]}>MILEAGE (ODOMETER)</Text>
              <ConfirmedAmountField
                key={`startOdometer:${weekKey}`}
                label="STARTING ODOMETER"
                amount={exp.startOdometer}
                money={false}
                placeholder="e.g. 100000"
                onCommit={(v) => commitOdometer('startOdometer', v)}
                onDelete={() => commitOdometer('startOdometer', 0)}
              />
              <ConfirmedAmountField
                key={`endOdometer:${weekKey}`}
                label="ENDING ODOMETER"
                amount={exp.endOdometer}
                money={false}
                placeholder="e.g. 103500"
                onCommit={(v) => commitOdometer('endOdometer', v)}
                onDelete={() => commitOdometer('endOdometer', 0)}
              />
              <ConfirmedAmountField
                key={`mileageRate:${weekKey}`}
                label="MILEAGE RATE ($/MI)"
                amount={exp.mileageRate ?? 0.14}
                placeholder="0.14"
                onCommit={(v) => commitMileageRate(v)}
                onDelete={() => commitMileageRate(0.14)}
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  form: { padding: 20, paddingBottom: 140 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  input: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, marginBottom: 8,
    fontSize: 16, color: C.text,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16,
    paddingLeft: 16, paddingRight: 6, marginBottom: 12,
  },
  prefix: { fontSize: 16, color: C.sub },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  lockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  lockedValue: { fontSize: 16, fontWeight: '800', color: C.text },
  otherLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  lockedActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { backgroundColor: C.cardElevated },
  cancelBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  freqBadge: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  freqBadgeText: { fontSize: 10, color: C.sub, fontWeight: '800' },
  otherEditor: { marginBottom: 4 },
  nameError: { color: C.danger, fontSize: 12, marginBottom: 8, marginLeft: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardElevated, borderStyle: 'dashed',
  },
  addBtnText: { color: C.accent, fontSize: 14, fontWeight: '700' },
  calcBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 20, marginTop: 8,
  },
  calcText: { color: C.accent, fontWeight: '600', fontSize: 14, lineHeight: 22 },
});
