import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType, saveScheduleLocal } from '../storage/storage';
import { PayScheduleForm } from './PayScheduleScreen';
import { defaultSchedule } from '../utils/payPeriods';
import type { PaySchedule } from '../types';
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
  const [schedule, setSchedule] = useState<PaySchedule>(() => defaultSchedule());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);

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
      options: {
        data: {
          driver_type: driverType,
          name: name.trim(),
          schedule_start_date: schedule.startDate,
          schedule_frequency: schedule.frequency,
          schedule_pay_day: schedule.payDay,
        },
      },
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
      schedule_start_date: schedule.startDate,
      schedule_frequency: schedule.frequency,
      schedule_pay_day: schedule.payDay,
    });
    if (profErr) {
      setSubmitting(false);
      setError('Account created but profile setup failed. Please sign in.');
      return;
    }

    await saveDriverType(driverType);
    await saveScheduleLocal(schedule);
    setSubmitting(false);
  }

  async function handleVerifyCode() {
    setError(null);
    const token = code.trim();
    if (token.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    setVerifying(true);
    const { error: otpErr } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'signup',
    });
    setVerifying(false);
    if (otpErr) {
      setError(
        otpErr.message?.toLowerCase().includes('expired')
          ? 'That code expired. Tap "Resend code" and use the new one.'
          : 'That code didn\'t match. Check the email and try again.'
      );
      return;
    }
    // Success: Supabase returns a session; App's SIGNED_IN listener takes over
    // (creates the profile from metadata and loads the app).
  }

  async function handleResendCode() {
    setError(null);
    setResent(false);
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    if (resendErr) { setError(resendErr.message); return; }
    setResent(true);
  }

  if (pendingConfirm) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.confirmWrap}>
            <Ionicons name="mail-unread-outline" size={64} color={C.accent} />
            <Text style={s.appName}>Check your email</Text>
            <Text style={s.confirmBody}>
              We sent a 6-digit code to {email.trim().toLowerCase()}. Enter it below to confirm
              your account. Didn't get it? Check your spam folder.
            </Text>
            <TextInput
              style={s.codeInput}
              value={code}
              onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '')); setError(null); }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={C.muted}
              autoFocus
            />
            {error ? <Text style={s.error}>{error}</Text> : null}
            {resent ? <Text style={s.resentNote}>New code sent — check your inbox.</Text> : null}
            <TouchableOpacity
              style={[s.primaryBtn, { alignSelf: 'stretch' }, (verifying || code.length !== 6) && { opacity: 0.6 }]}
              onPress={handleVerifyCode}
              disabled={verifying || code.length !== 6}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{verifying ? 'Verifying…' : 'Confirm'}</Text>
              <Ionicons name="checkmark" size={20} color={C.accentText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResendCode} style={s.linkBtn}>
              <Text style={s.linkText}>
                Didn't get a code?  <Text style={s.linkAccent}>Resend code</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

            <Text style={[s.label, { marginTop: 16 }]}>PAY SCHEDULE</Text>
            <Text style={s.scheduleHint}>
              Your first working day, how often you get paid, and your pay day. You can change this anytime.
            </Text>
            <PayScheduleForm value={schedule} onChange={setSchedule} />

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
  codeInput: {
    alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 16,
    paddingVertical: 16, fontSize: 28, fontWeight: '800', color: C.text,
    textAlign: 'center', letterSpacing: 12, marginTop: 8,
  },
  resentNote: { color: C.success, fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.sub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700' },
  scheduleHint: { fontSize: 13, color: C.sub, lineHeight: 19, marginTop: 2 },
});
