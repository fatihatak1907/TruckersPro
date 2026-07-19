import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeek } from '../context/WeekContext';
import { formatPeriodDisplay, formatPayDate } from '../utils/payPeriods';
import { C } from '../theme';

export function PeriodBar({
  onOpenSchedule, paid, onTogglePaid,
}: {
  onOpenSchedule: () => void;
  paid: boolean;
  onTogglePaid: () => void;
}) {
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
        <TouchableOpacity
          onPress={onTogglePaid}
          style={[s.paidChip, paid && s.paidChipOn]}
          activeOpacity={0.8}
          hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
        >
          <Ionicons
            name={paid ? 'checkmark-circle' : 'ellipse-outline'}
            size={13}
            color={paid ? C.accentText : C.sub}
          />
          <Text style={[s.paidChipText, paid && s.paidChipTextOn]}>
            {paid ? 'Paid' : 'Mark as paid'}
          </Text>
        </TouchableOpacity>
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
  paidChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.cardElevated, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 6,
  },
  paidChipOn: { backgroundColor: C.success },
  paidChipText: { fontSize: 11, fontWeight: '700', color: C.sub },
  paidChipTextOn: { color: C.accentText, fontWeight: '800' },
});
