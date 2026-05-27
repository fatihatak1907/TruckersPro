import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from '../sync/syncEngine';
import { SYNC_QUEUE_KEY, QueuedOp } from '../sync/types';
import { C } from '../theme';

export function SyncStatusBadge() {
  const [queueSize, setQueueSize] = useState(0);
  const [headAttempts, setHeadAttempts] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function tick() {
      const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue: QueuedOp[] = raw ? JSON.parse(raw) : [];
      if (!mounted) return;
      setQueueSize(queue.length);
      setHeadAttempts(queue[0]?.attempts ?? 0);
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (queueSize === 0) return null;

  const isError = headAttempts >= 3;

  return (
    <TouchableOpacity
      onPress={() => {
        if (isError) {
          Alert.alert(
            'Sync error',
            'We couldn\'t sync your latest changes. Tap retry to try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => syncEngine.flush() },
            ]
          );
        } else {
          syncEngine.flush();
        }
      }}
      style={[s.pill, isError && s.pillError]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'sync-outline'}
        size={12}
        color={isError ? '#fff' : C.accent}
      />
      <Text style={[s.text, isError && s.textError]}>
        {isError ? 'Sync error' : `Syncing ${queueSize}`}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255, 214, 0, 0.18)',
    borderRadius: 999,
  },
  pillError: { backgroundColor: C.danger },
  text: { color: C.accent, fontSize: 11, fontWeight: '700' },
  textError: { color: '#fff' },
});
