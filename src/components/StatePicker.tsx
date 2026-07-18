import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { US_STATES } from '../utils/usStates';
import { C } from '../theme';

type Props = {
  label: string;                      // placeholder when nothing selected, e.g. "Select state"
  value: string | null;               // 2-letter code or null
  onSelect: (code: string) => void;
};

export function StatePicker({ label, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const selected = US_STATES.find((st) => st.code === value);

  return (
    <>
      <TouchableOpacity style={s.btn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.btnText, !selected && s.btnPlaceholder]} numberOfLines={1}>
          {selected ? `${selected.name} (${selected.code})` : label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.sub} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select state</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={C.sub} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.row, item.code === value && s.rowActive]}
                  onPress={() => { onSelect(item.code); setOpen(false); }}
                >
                  <Text style={[s.rowText, item.code === value && s.rowTextActive]}>
                    {item.name} ({item.code})
                  </Text>
                  {item.code === value && <Ionicons name="checkmark" size={18} color={C.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
  },
  btnText: { fontSize: 16, color: C.text, flex: 1 },
  btnPlaceholder: { color: C.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
  },
  rowActive: { backgroundColor: C.card },
  rowText: { fontSize: 15, color: C.text },
  rowTextActive: { fontWeight: '800', color: C.accent },
});
