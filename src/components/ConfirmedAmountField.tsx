import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt } from '../utils/format';
import { C } from '../theme';
import type { Frequency } from '../types';

export function FreqToggle<F extends string>({
  value, onChange, options, labels,
}: {
  value: F; onChange: (v: F) => void; options: readonly F[]; labels: Record<F, string>;
}) {
  return (
    <View style={s.freqRow}>
      {options.map((f) => (
        <TouchableOpacity
          key={f}
          style={[s.freqBtn, value === f && s.freqBtnActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.8}
        >
          <Text style={[s.freqText, value === f && s.freqTextActive]}>{labels[f]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export type ConfirmedAmountFieldProps = {
  label: string;
  amount: number;                 // saved value; 0 = empty
  frequency?: Frequency;          // omit for odometers
  money?: boolean;                // $ prefix + decimal pad (default true)
  placeholder?: string;
  onCommit: (amount: number, frequency: Frequency) => void;
  onDelete: () => void;
};

export function ConfirmedAmountField({
  label, amount, frequency, money = true, placeholder = '0.00', onCommit, onDelete,
}: ConfirmedAmountFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftFreq, setDraftFreq] = useState<Frequency>(frequency ?? 'weekly');
  const showFreq = frequency !== undefined;
  const locked = amount > 0 && !editing;

  function startEdit() {
    setDraft(amount > 0 ? String(amount) : '');
    setDraftFreq(frequency ?? 'weekly');
    setEditing(true);
  }

  function confirm() {
    onCommit(parseFloat(draft) || 0, draftFreq);
    setEditing(false);
    setDraft('');
  }

  function confirmDelete() {
    Alert.alert(`Remove ${label.toLowerCase()}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  }

  if (locked) {
    return (
      <View style={s.expenseBlock}>
        <Text style={s.fieldLabel}>{label}</Text>
        <View style={s.lockedRow}>
          <Ionicons name="checkmark-circle" size={18} color={C.success} />
          <Text style={s.lockedValue}>
            {money ? fmt(amount) : amount.toLocaleString()}
          </Text>
          {showFreq && (
            <View style={s.freqBadge}>
              <Text style={s.freqBadgeText}>
                {frequency === 'monthly' ? 'M' : frequency === 'biweekly' ? '2W' : 'W'}
              </Text>
            </View>
          )}
          <View style={s.lockedActions}>
            <TouchableOpacity style={s.iconBtn} onPress={startEdit}>
              <Ionicons name="pencil-outline" size={16} color={C.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={16} color={C.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.expenseBlock}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        {money && <Text style={s.prefix}>$</Text>}
        <TextInput
          style={s.inputFlex}
          value={draft}
          onChangeText={setDraft}
          onFocus={() => { if (!editing) startEdit(); }}
          keyboardType={money ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
        />
        {showFreq && (
          <FreqToggle
            value={draftFreq}
            onChange={setDraftFreq}
            options={['weekly', 'biweekly', 'monthly'] as const}
            labels={{ weekly: 'W', biweekly: '2W', monthly: 'M' }}
          />
        )}
        {editing && amount > 0 && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setDraft(''); }}>
            <Ionicons name="close" size={18} color={C.sub} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.confirmBtn, !draft && s.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!draft}
        >
          <Ionicons name="checkmark" size={20} color={draft ? C.accentText : C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  expenseBlock: { marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6, marginTop: 4 },
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
  freqBadge: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  freqBadgeText: { fontSize: 10, color: C.sub, fontWeight: '800' },
});
