import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType } from '../storage/storage';
import { C } from '../theme';

type Props = { navigation: any };

export function SignupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) { setError('Enter your name or company name.'); return; }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Enter a valid email address.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords don\'t match.'); return; }
    if (!driverType) { setError('Please pick a driver type.'); return; }

    setSubmitting(true);
    const { data, error: signErr } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { data: { driver_type: driverType, name: name.trim() } },
    });
    if (signErr || !data.user) {
      setSubmitting(false);
      setError(
        signErr?.message?.includes('already')
          ? 'An account with this email already exists. Try signing in.'
          : signErr?.message ?? 'Sign up failed.'
      );
      return;
    }

    if (data.user.identities?.length === 0) {
      setSubmitting(false);
      setError('An account with this email already exists. Try signing in.');
      return;
    }

    if (!data.session) {
      // Email confirmation is on — no session yet. The profiles row is created
      // by App bootstrap from user_metadata after the first confirmed login.
      setSubmitting(false);
      setPendingConfirm(true);
      return;
    }

    // Confirmation disabled — session exists, keep the immediate flow.
    const { error: profErr } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      driver_type: driverType,
      name: name.trim(),
    });
    if (profErr) {
      setSubmitting(false);
      setError('Account created but profile setup failed. Please sign in.');
      return;
    }

    await saveDriverType(driverType);
    setSubmitting(false);
  }

  if (pendingConfirm) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={s.confirmWrap}>
          <Ionicons name="mail-unread-outline" size={64} color={C.accent} />
          <Text style={s.appName}>Check your email</Text>
          <Text style={s.confirmBody}>
            We sent a confirmation link to {email.trim().toLowerCase()}. Tap the link, then come
            back and log in. Didn't get it? Check your spam folder.
          </Text>
          <TouchableOpacity style={[s.primaryBtn, { alignSelf: 'stretch' }]} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Go to Log In</Text>
            <Ionicons name="arrow-forward" size={20} color={C.accentText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>

          <View style={s.hero}>
            <Image source={require('../../logo.png')} style={s.logo} resizeMode="contain" />
            <Text style={s.appName}>Create account</Text>
            <Text style={s.tagline}>Pick your driver type below</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>YOUR NAME / COMPANY</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={C.sub} />
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="e.g. Fatih Atak" placeholderTextColor={C.muted}
                autoCapitalize="words" autoComplete="name" autoCorrect={false} />
            </View>

            <Text style={s.label}>EMAIL</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.sub} />
              <TextInput style={s.input} value={email} onChangeText={setEmail}
                placeholder="you@example.com" placeholderTextColor={C.muted}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} />
            </View>

            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput style={s.input} value={password} onChangeText={setPassword}
                placeholder="At least 8 characters" placeholderTextColor={C.muted}
                secureTextEntry={!showPwd} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput style={s.input} value={confirm} onChangeText={setConfirm}
                placeholder="Re-enter password" placeholderTextColor={C.muted}
                secureTextEntry={!showPwd} autoCapitalize="none" />
            </View>

            <Text style={[s.label, { marginTop: 16 }]}>I AM A...</Text>
            <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{submitting ? 'Creating…' : 'Create Account'}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.accentText} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.linkBtn}>
              <Text style={s.linkText}>
                Already have an account?  <Text style={s.linkAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 20 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  logo: { width: 100, height: 100, borderRadius: 24 },
  appName: { fontSize: 26, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: C.sub },
  form: { gap: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  confirmBody: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.sub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700' },
});
