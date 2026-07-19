import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeek } from '../context/WeekContext';
import { getScheduleBannerDismissed, setScheduleBannerDismissed } from '../storage/storage';
import { C } from '../theme';

export function PayScheduleBanner({ onOpen }: { onOpen: () => void }) {
  const { scheduleLoaded, needsSetup } = useWeek();
  const [dismissed, setDismissed] = useState(true); // hidden until we know

  useEffect(() => {
    getScheduleBannerDismissed().then(setDismissed);
  }, []);

  if (!scheduleLoaded || !needsSetup || dismissed) return null;

  return (
    <View style={s.banner}>
      <Ionicons name="calendar-outline" size={18} color={C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Set your pay schedule</Text>
        <Text style={s.sub}>Weekly (Mon–Sun) is used until you do.</Text>
      </View>
      <TouchableOpacity style={s.setBtn} onPress={onOpen} activeOpacity={0.85}>
        <Text style={s.setBtnText}>Set up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={async () => {
          await setScheduleBannerDismissed();
          setDismissed(true);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardElevated, borderRadius: 16, padding: 12, marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: '800', color: C.text },
  sub: { fontSize: 11, color: C.sub, marginTop: 1 },
  setBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  setBtnText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
});
