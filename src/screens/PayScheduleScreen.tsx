import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { saveSchedule } from '../storage/storage';
import {
  defaultSchedule, firstPeriod, formatPeriodDisplay, formatPayDate, todayKey,
} from '../utils/payPeriods';
import type { PaySchedule, PayFrequency } from '../types';

const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toUTC(key: string): Date {
  return new Date(key + 'T00:00:00Z');
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatFullDate(key: string): string {
  return toUTC(key).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

type CalendarModalProps = {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onSelect: (key: string) => void;
  onClose: () => void;
};

function CalendarModal({ visible, value, onSelect, onClose }: CalendarModalProps) {
  const insets = useSafeAreaInsets();
  const [monthStart, setMonthStart] = useState(value.slice(0, 8) + '01');
  // Read the clock when the sheet opens (not per render) so the floor is
  // stable while it's on screen but fresh if the app stays open past midnight.
  const [minKey, setMinKey] = useState(() => todayKey());

  useEffect(() => {
    if (visible) {
      setMinKey(todayKey());
      setMonthStart(value.slice(0, 8) + '01');
    }
  }, [visible, value]);

  const first = toUTC(monthStart);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = first.getUTCDay() === 0 ? 7 : first.getUTCDay(); // 1=Mon … 7=Sun
  const cells: (number | null)[] = [
    ...Array(firstDow - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    const d = toUTC(monthStart);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonthStart(iso(d));
  }

  const keyFor = (day: number) => iso(new Date(Date.UTC(year, month, day)));
  // ISO keys compare correctly as strings: block months before the current one.
  const canGoBack = monthStart > minKey.slice(0, 8) + '01';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Start date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.sub} />
            </TouchableOpacity>
          </View>
          <View style={s.calNav}>
            <TouchableOpacity
              onPress={() => shiftMonth(-1)}
              style={s.calNavBtn}
              disabled={!canGoBack}
            >
              <Ionicons name="chevron-back" size={18} color={canGoBack ? C.sub : C.muted} />
            </TouchableOpacity>
            <Text style={s.calMonth}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={s.calNavBtn}>
              <Ionicons name="chevron-forward" size={18} color={C.sub} />
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {WEEKDAYS.map((w) => (
              <Text key={w.day} style={s.calDow}>{w.label[0]}</Text>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={s.calCell} />;
              const k = keyFor(day);
              const past = k < minKey;
              return (
                <TouchableOpacity
                  key={i}
                  style={s.calCell}
                  onPress={() => { onSelect(k); onClose(); }}
                  activeOpacity={0.7}
                  disabled={past}
                >
                  <View style={[s.calCellInner, k === value && s.calCellActive]}>
                    <Text
                      style={[
                        s.calCellText,
                        past && s.calCellTextPast,
                        k === value && s.calCellTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PayScheduleForm({
  value, onChange,
}: {
  value: PaySchedule;
  onChange: (s: PaySchedule) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const preview = firstPeriod(value);

  function setFrequency(frequency: PayFrequency) {
    let payDay = value.payDay;
    if (frequency !== 'monthly' && payDay > 7) payDay = 5; // day-of-month → weekday reset
    onChange({ ...value, frequency, payDay });
  }

  return (
    <View>
      <Text style={s.label}>START DATE</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setCalOpen(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color={C.sub} />
        <Text style={s.dateText}>{formatFullDate(value.startDate)}</Text>
        <Ionicons name="chevron-down" size={16} color={C.sub} />
      </TouchableOpacity>

      <Text style={s.label}>PAID EVERY</Text>
      <View style={s.pillRow}>
        {FREQUENCIES.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[s.pill, value.frequency === f.value && s.pillActive]}
            onPress={() => setFrequency(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.pillText, value.frequency === f.value && s.pillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{value.frequency === 'monthly' ? 'PAY DAY OF MONTH' : 'PAY DAY'}</Text>
      {value.frequency === 'monthly' ? (
        <View style={s.dayGrid}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.dayCell, value.payDay === d && s.dayCellActive]}
              onPress={() => onChange({ ...value, payDay: d })}
              activeOpacity={0.7}
            >
              <Text style={[s.dayCellText, value.payDay === d && s.dayCellTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.lastDayBtn, value.payDay === 31 && s.dayCellActive]}
            onPress={() => onChange({ ...value, payDay: 31 })}
            activeOpacity={0.7}
          >
            <Text style={[s.dayCellText, value.payDay === 31 && s.dayCellTextActive]}>
              Last day
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.pillRow}>
          {WEEKDAYS.map((w) => (
            <TouchableOpacity
              key={w.day}
              style={[s.dowPill, value.payDay === w.day && s.pillActive]}
              onPress={() => onChange({ ...value, payDay: w.day })}
              activeOpacity={0.8}
            >
              <Text style={[s.dowPillText, value.payDay === w.day && s.pillTextActive]}>
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.previewBox}>
        <Ionicons name="information-circle-outline" size={16} color={C.accent} />
        <Text style={s.previewText}>
          Periods: {formatPeriodDisplay(preview)} · first pay day {formatPayDate(preview)}
        </Text>
      </View>

      <CalendarModal
        visible={calOpen}
        value={value.startDate}
        onSelect={(d) => onChange({ ...value, startDate: d })}
        onClose={() => setCalOpen(false)}
      />
    </View>
  );
}

export function PayScheduleModal({
  visible, initialSchedule, onClose, onSaved,
}: {
  visible: boolean;
  initialSchedule: PaySchedule | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<PaySchedule>(() => initialSchedule ?? defaultSchedule());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initialSchedule ?? defaultSchedule());
  }, [visible]);

  async function handleSave() {
    setSaving(true);
    await saveSchedule(draft);
    setSaving(false);
    await onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pay Schedule</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <PayScheduleForm value={draft} onChange={setDraft} />
          <Text style={s.note}>
            Past periods stay as recorded; new periods follow the new schedule.
          </Text>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Schedule'}</Text>
            <Ionicons name="checkmark" size={20} color={C.accentText} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  body: { padding: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
  },
  dateText: { flex: 1, fontSize: 16, color: C.text, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.card, alignItems: 'center',
  },
  pillActive: { backgroundColor: C.accent },
  pillText: { fontSize: 13, fontWeight: '700', color: C.sub },
  pillTextActive: { color: C.accentText, fontWeight: '800' },
  dowPill: {
    flexGrow: 1, flexBasis: '12%', paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.card, alignItems: 'center',
  },
  dowPillText: { fontSize: 12, fontWeight: '700', color: C.sub },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: {
    width: '12%', flexGrow: 1, aspectRatio: 1.2, borderRadius: 10,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  dayCellActive: { backgroundColor: C.accent },
  dayCellText: { fontSize: 13, fontWeight: '700', color: C.sub },
  dayCellTextActive: { color: C.accentText, fontWeight: '800' },
  lastDayBtn: {
    flexGrow: 2, flexBasis: '26%', aspectRatio: undefined, paddingVertical: 10,
    borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 14, padding: 12, marginTop: 20,
  },
  previewText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '600' },
  note: { fontSize: 12, color: C.muted, marginTop: 16, lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  saveBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  calNavBtn: { padding: 8 },
  calMonth: { fontSize: 15, fontWeight: '800', color: C.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  calDow: {
    width: `${100 / 7}%`, textAlign: 'center', fontSize: 11,
    fontWeight: '700', color: C.muted, paddingVertical: 6,
  },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1.15,
    alignItems: 'center', justifyContent: 'center',
  },
  calCellInner: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  calCellActive: { backgroundColor: C.accent },
  calCellText: { fontSize: 14, color: C.text, fontWeight: '600' },
  calCellTextPast: { color: C.muted },
  calCellTextActive: { color: C.accentText, fontWeight: '800' },
});
