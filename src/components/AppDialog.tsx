import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type DialogRequest = {
  title: string;
  message?: string;
  buttons: DialogButton[];
};

// Single subscriber: <DialogHost /> is mounted once at the app root.
let emit: ((req: DialogRequest | null) => void) | null = null;

/**
 * App-themed replacement for React Native's Alert.alert — same call shape, so
 * call sites read identically, but the dialog matches the dark/yellow theme
 * instead of falling back to the OS default.
 */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  emit?.({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
}

export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);

  useEffect(() => {
    emit = setReq;
    return () => { emit = null; };
  }, []);

  function handlePress(btn: DialogButton) {
    setReq(null);
    btn.onPress?.();
  }

  return (
    <Modal
      visible={req !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Android back button behaves like the cancel button when there is one.
        const cancel = req?.buttons.find((b) => b.style === 'cancel');
        setReq(null);
        cancel?.onPress?.();
      }}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{req?.title}</Text>
          {req?.message ? <Text style={s.message}>{req.message}</Text> : null}
          <View style={[s.actions, (req?.buttons.length ?? 0) > 2 && s.actionsStacked]}>
            {req?.buttons.map((btn, i) => (
              <TouchableOpacity
                key={`${btn.text}:${i}`}
                style={[
                  s.btn,
                  btn.style === 'cancel' && s.btnCancel,
                  btn.style === 'destructive' && s.btnDestructive,
                  (req.buttons.length ?? 0) > 2 && s.btnFull,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    s.btnText,
                    btn.style === 'cancel' && s.btnTextCancel,
                    btn.style === 'destructive' && s.btnTextDestructive,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: C.card, borderRadius: 24,
    borderWidth: 1, borderColor: C.border,
    padding: 22,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  message: { fontSize: 14, color: C.sub, lineHeight: 21, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 22, justifyContent: 'flex-end' },
  actionsStacked: { flexDirection: 'column-reverse', alignItems: 'stretch' },
  btn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.accent, alignItems: 'center', minWidth: 96,
  },
  btnFull: { minWidth: 0 },
  btnCancel: { backgroundColor: C.cardElevated },
  btnDestructive: { backgroundColor: C.danger },
  btnText: { fontSize: 14, fontWeight: '800', color: C.accentText },
  btnTextCancel: { color: C.sub },
  btnTextDestructive: { color: C.text },
});
