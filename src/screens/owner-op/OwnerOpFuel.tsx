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
import { saveFuelEntry, getFuelEntriesForWeek, deleteFuelEntry } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { fmt } from '../../components/SummaryCard';
import { C } from '../../theme';
import type { FuelEntry } from '../../types';

export function OwnerOpFuel() {
  const { weekKey, goToPrev, goToNext } = useWeek();
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [fuelType, setFuelType] = useState<'diesel' | 'def'>('diesel');
  const [cost, setCost] = useState('');

  useFocusEffect(
    useCallback(() => {
      getFuelEntriesForWeek(weekKey).then(setEntries);
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
    await saveFuelEntry(entry);
    setCost('');
    const updated = await getFuelEntriesForWeek(weekKey);
    setEntries(updated);
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete', 'Remove this fuel entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteFuelEntry(weekKey, id);
          setEntries((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerInner}>
            <Text style={s.headerTitle}>Fuel Log</Text>
          </View>
          <View style={s.weekNav}>
            <TouchableOpacity onPress={goToPrev}><Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.8)" /></TouchableOpacity>
            <Text style={s.weekLabel}>{formatWeekDisplay(weekKey)}</Text>
            <TouchableOpacity onPress={goToNext}><Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" /></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={s.totalsRow}>
            <View style={s.totalCard}>
              <Ionicons name="water" size={20} color={C.gradEnd} />
              <Text style={s.totalValue}>{fmt(totalDiesel)}</Text>
              <Text style={s.totalLabel}>Total Diesel</Text>
            </View>
            <View style={s.totalCard}>
              <Ionicons name="water-outline" size={20} color={C.gradEnd} />
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
                <LinearGradient colors={[C.accent, '#059669']} style={s.addBtn}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={s.addBtnText}>Add</Text>
                </LinearGradient>
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
                      <Ionicons name={type === 'diesel' ? 'water' : 'water-outline'} size={16} color={C.gradEnd} />
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
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerInner: { paddingTop: 12, marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  body: { padding: 16, paddingBottom: 60 },
  totalsRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: -8 },
  totalCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center',
    shadowColor: '#1E3A8A', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  totalValue: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 6 },
  totalLabel: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  addCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: '#1E3A8A', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  addCardTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typePill: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, alignItems: 'center',
  },
  typePillActive: { backgroundColor: C.gradEnd, borderColor: C.gradEnd },
  typePillText: { fontSize: 14, color: C.sub, fontWeight: '600' },
  typePillTextActive: { color: '#fff', fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    backgroundColor: C.inputBg, paddingHorizontal: 14,
  },
  prefix: { fontSize: 16, color: C.sub, marginRight: 6 },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 12, color: C.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.sub, marginTop: 12 },
  group: { marginBottom: 16 },
  groupTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 8 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, padding: 12, marginBottom: 6,
    shadowColor: '#1E3A8A', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  entryIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  entryCost: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  entryDate: { fontSize: 13, color: C.muted, marginRight: 10 },
  deleteBtn: { padding: 4 },
});
