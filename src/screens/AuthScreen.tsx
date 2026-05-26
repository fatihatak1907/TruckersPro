import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/client';
import { C } from '../theme';

type Stage = 'email' | 'otp';

export function AuthScreen() {
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  async function handleSendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
    setSubmittedEmail(trimmed);
    setStage('otp');
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: submittedEmail,
      token: otp,
      type: 'email',
    });
    setVerifying(false);
    if (error) {
      Alert.alert('Verification failed', error.message);
      return;
    }
    // Session set; App.tsx auth listener will switch to AppNavigator.
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerInner}>
            <Ionicons name="lock-closed-outline" size={28} color="#fff" />
            <Text style={s.headerTitle}>TruckersPro</Text>
            <Text style={s.headerSub}>
              {stage === 'email' ? 'Sign in with your email' : 'Enter the code we sent'}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={s.form}>
          {stage === 'email' ? (
            <>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleSendCode}
                activeOpacity={0.85}
                disabled={sending}
              >
                <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>
                    {sending ? 'Sending…' : 'Send Code'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.label}>6-DIGIT CODE</Text>
              <Text style={s.hint}>Sent to {submittedEmail}</Text>
              <TextInput
                style={s.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                onPress={handleVerify}
                activeOpacity={0.85}
                disabled={verifying}
              >
                <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>
                    {verifying ? 'Verifying…' : 'Verify'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStage('email')} style={s.linkBtn}>
                <Text style={s.linkText}>Use a different email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 32 },
  headerInner: { paddingTop: 24, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 8 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { padding: 24, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 12 },
  hint: { fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 14, backgroundColor: C.inputBg, fontSize: 18, color: C.text,
    marginBottom: 8,
  },
  primaryBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.gradEnd, fontSize: 14, fontWeight: '600' },
});
