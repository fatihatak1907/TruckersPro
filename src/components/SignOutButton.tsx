import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmAndSignOut } from '../utils/signOut';
import { confirmAndDeleteAccount } from '../utils/deleteAccount';
import { C } from '../theme';

function openAccountMenu(): void {
  Alert.alert('Account', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete account', style: 'destructive', onPress: confirmAndDeleteAccount },
    { text: 'Sign out', onPress: confirmAndSignOut },
  ]);
}

export function SignOutButton() {
  return (
    <TouchableOpacity
      onPress={openAccountMenu}
      style={s.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="person-circle-outline" size={16} color={C.text} />
      <Text style={s.text}>Account</Text>
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
