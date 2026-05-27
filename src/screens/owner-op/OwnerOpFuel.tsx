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
import { saveFuelEntry, getFuelEntriesForWeek, deleteFuelEntry } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { fmt } from '../../components/SummaryCard';
import { C } from '../../theme';
import type { FuelEntry } from '../../types';

export function OwnerOpFuel({ route }: { route: any }) {
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const { weekKey } = useWeek();
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [fuelType, setFuelType] = useState<'diesel' | 'def'>('diesel');
  const [cost, setCost] = useState('');

  useFocusEffect(
    useCallback(() => {
      getFuelEntriesForWeek(driverType, weekKey).then(setEntries);
    }, [weekKey])
  );

  const totalDiesel = entries.filter((e) => e.type === 'diesel').reduce((s, e) => s + e.cost, 0);
  const totalDef = entries.filter((e) => e.type === 'def').reduce((s, e) => s + e.cost, 0);

  async function handleAdd() {
    const c = parseFloat(cost);
    if (!cost || isNaN(c) || c <= 0) {
      Alert.alert('Invalid', 'Enter a valid cost.');
      return;
    }
    const entry: FuelEntry = {
      id: uuidv4(),
      weekKey,
      type: fuelType,
      cost: c,
      createdAt: new Date().toISOString(),
    };
    await saveFuelEntry(driverType, entry);
    setCost('');
    const updated = await getFuelEntriesForWeek(driverType, weekKey);
    setEntries(updated);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete', 'Remove this fuel entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteFuelEntry(driverType, weekKey, id);
          setEntries((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Fuel"
        subtitle={formatWeekDisplay(weekKey)}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={s.totalsRow}>
            <View style={s.totalCard}>
              <Ionicons name="water" size={20} color={C.accent} />
              <Text style={s.totalValue}>{fmt(totalDiesel)}</Text>
              <Text style={s.totalLabel}>Total Diesel</Text>
            </View>
            <View style={s.totalCard}>
              <Ionicons name="water-outline" size={20} color={C.accent} />
              <Text style={s.totalValue}>{fmt(totalDef)}</Text>
              <Text style={s.totalLabel}>Total DEF</Text>
            </View>
          </View>

          <View style={s.addCard}>
            <Text style={s.addCardTitle}>ADD FUEL ENTRY</Text>
            <View style={s.typeRow}>
              {(['diesel', 'def'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.typePill, fuelType === t && s.typePillActive]}
                  onPress={() => setFuelType(t)}
                >
                  <Text style={[s.typePillText, fuelType === t && s.typePillTextActive]}>
                    {t === 'diesel' ? 'Diesel' : 'DEF'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.inputRow}>
              <View style={s.amountInput}>
                <Text style={s.prefix}>$</Text>
                <TextInput
                  style={s.inputFlex}
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={C.muted}
                />
              </View>
              <TouchableOpacity onPress={handleAdd} activeOpacity={0.85}>
                <View style={s.addBtn}>
                  <Ionicons name="add" size={20} color={C.accentText} />
                  <Text style={s.addBtnText}>Add</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {entries.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="water-outline" size={48} color={C.muted} />
              <Text style={s.emptyText}>No fuel entries this week</Text>
            </View>
          )}

          {(['diesel', 'def'] as const).map((type) => {
            const group = entries.filter((e) => e.type === type);
            if (group.length === 0) return null;
            return (
              <View key={type} style={s.group}>
                <Text style={s.groupTitle}>{type === 'diesel' ? 'DIESEL' : 'DEF'}</Text>
                {group.map((entry) => (
                  <View key={entry.id} style={s.entryRow}>
                    <View style={s.entryIconBox}>
                      <Ionicons name={type === 'diesel' ? 'water' : 'water-outline'} size={16} color={C.accent} />
                    </View>
                    <Text style={s.entryCost}>{fmt(entry.cost)}</Text>
                    <Text style={s.entryDate}>
                      {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => handleDelete(entry.id)} style={s.deleteBtn}>
                      <Ionicons name="trash-outline" size={16} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { padding: 16, paddingBottom: 140 },
  totalsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  totalCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center',
  },
  totalValue: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 6 },
  totalLabel: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  addCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 20,
  },
  addCardTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typePill: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center',
  },
  typePillActive: { backgroundColor: C.accent },
  typePillText: { fontSize: 14, color: C.text, fontWeight: '600' },
  typePillTextActive: { color: C.accentText, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardElevated, borderRadius: 16, paddingHorizontal: 16,
  },
  prefix: { fontSize: 16, color: C.sub },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14,
  },
  addBtnText: { color: C.accentText, fontWeight: '800', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
  group: { marginBottom: 16 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 8 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 16, padding: 14, marginBottom: 6,
  },
  entryIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  entryCost: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  entryDate: { fontSize: 13, color: C.muted, marginRight: 10 },
  deleteBtn: { padding: 4 },
});
