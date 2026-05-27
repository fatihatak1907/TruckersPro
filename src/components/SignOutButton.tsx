import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmAndSignOut } from '../utils/signOut';
import { C } from '../theme';

export function SignOutButton() {
  return (
    <TouchableOpacity
      onPress={confirmAndSignOut}
      style={s.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="log-out-outline" size={16} color={C.text} />
      <Text style={s.text}>Sign out</Text>
    </TouchableOpacity>
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
