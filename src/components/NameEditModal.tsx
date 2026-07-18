import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { C } from '../theme';

type Props = {
  visible: boolean;
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameEditModal({ visible, initialName, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(initialName);

  useEffect(() => {
    if (visible) setDraft(initialName);
  }, [visible, initialName]);

  function handleSave() {
    onSave(draft.trim());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.backdrop}
      >
        <View style={s.card}>
          <Text style={s.title}>Driver / Company Name</Text>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Fatih Atak"
            placeholderTextColor={C.muted}
            autoFocus
            autoCapitalize="words"
          />
          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={s.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 20, padding: 20,
  },
  title: { fontSize: 12, fontWeight: '700', color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  input: {
    backgroundColor: C.cardElevated, borderRadius: 14,
    padding: 14, fontSize: 16, color: C.text, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center',
  },
  cancelText: { color: C.sub, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.accent, alignItems: 'center',
  },
  saveText: { color: C.accentText, fontSize: 15, fontWeight: '800' },
});
