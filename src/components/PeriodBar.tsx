import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeek } from '../context/WeekContext';
import { formatPeriodDisplay, formatPayDate } from '../utils/payPeriods';
import { C } from '../theme';

export function PeriodBar({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { period, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
  return (
    <View style={s.card}>
      <TouchableOpacity
        onPress={goToPrev}
        disabled={!canGoPrev}
        style={[s.navBtn, !canGoPrev && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-back" size={20} color={C.sub} />
      </TouchableOpacity>
      <View style={s.center}>
        <Text style={s.range}>{formatPeriodDisplay(period)}</Text>
        <Text style={s.payText}>Pay day {formatPayDate(period)}</Text>
      </View>
      <TouchableOpacity onPress={onOpenSchedule} style={s.calBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="calendar-outline" size={16} color={C.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={goToNext}
        disabled={!canGoNext}
        style={[s.navBtn, !canGoNext && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-forward" size={20} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 12, gap: 4,
  },
  navBtn: { padding: 4 },
  navBtnDisabled: { opacity: 0.3 },
  center: { flex: 1, alignItems: 'center' },
  range: { fontSize: 14, fontWeight: '700', color: C.text },
  payText: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 2 },
  calBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
});
