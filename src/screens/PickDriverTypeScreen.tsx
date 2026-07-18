import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType } from '../storage/storage';
import { C } from '../theme';

type Props = { userId: string; onDone: () => void };

export function PickDriverTypeScreen({ userId, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!driverType) { setError('Pick a driver type.'); return; }
    setSubmitting(true);
    const { error: err } = await supabase.from('profiles').insert({
      user_id: userId,
      driver_type: driverType,
      name: '',
    });
    setSubmitting(false);
    if (err) {
      // Profile already exists (race with SignupScreen) — recover by reading the
      // existing row and using whatever driver_type was already set.
      if (err.code === '23505' || err.message?.includes('duplicate key')) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('driver_type')
          .eq('user_id', userId)
          .maybeSingle();
        if (existing?.driver_type) {
          await saveDriverType(existing.driver_type);
          onDone();
          return;
        }
      }
      setError(err.message);
      return;
    }
    await saveDriverType(driverType);
    onDone();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.hero}>
          <Image source={require('../../logo.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.appName}>Welcome to TruckersPro</Text>
          <Text style={s.tagline}>Pick your driver type to continue</Text>
        </View>

        <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>{submitting ? 'Saving…' : 'Continue'}</Text>
          <Ionicons name="arrow-forward" size={20} color={C.accentText} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 16 },
  logo: { width: 120, height: 120, borderRadius: 28 },
  appName: { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: C.sub },
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
});
