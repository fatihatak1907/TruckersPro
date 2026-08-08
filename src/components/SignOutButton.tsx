import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AccountModal } from '../screens/AccountScreen';
import { C } from '../theme';

/**
 * Header button that opens the full Account screen (profile, about, sign out,
 * delete account). Named for its original role; kept so every dashboard header
 * keeps working unchanged.
 */
export function SignOutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={s.btn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Account settings"
      >
        <Ionicons name="person-circle-outline" size={16} color={C.text} />
        <Text style={s.text}>Account</Text>
      </TouchableOpacity>
      <AccountModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.card, borderRadius: 999,
  },
  text: { color: C.text, fontSize: 12, fontWeight: '700' },
});
