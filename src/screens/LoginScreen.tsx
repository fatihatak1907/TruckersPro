import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { C } from '../theme';

type Props = { navigation: any };

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot-password flow: 'request' = enter email, 'reset' = code + new password.
  // 'confirm' = finish an interrupted signup (email never confirmed): code only.
  const [forgotStep, setForgotStep] = useState<null | 'request' | 'reset' | 'confirm'>(null);
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [resent, setResent] = useState(false);

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function handleSendResetCode() {
    setError(null);
    setResent(false);
    const trimmed = email.trim().toLowerCase();
    if (!validEmail(trimmed)) { setError('Enter a valid email address.'); return; }
    setSubmitting(true);
    const { error: err } =
      forgotStep === 'confirm'
        ? await supabase.auth.resend({ type: 'signup', email: trimmed })
        : await supabase.auth.resetPasswordForEmail(trimmed);
    setSubmitting(false);
    if (err) {
      setError(
        err.message?.toLowerCase().includes('rate limit')
          ? 'Too many requests — wait a minute and try again.'
          : err.message
      );
      return;
    }
    if (forgotStep === 'reset' || forgotStep === 'confirm') setResent(true);
    if (forgotStep !== 'confirm') setForgotStep('reset');
  }

  async function handleConfirmSignupCode() {
    setError(null);
    const token = code.trim();
    if (token.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    setSubmitting(true);
    const { error: otpErr } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'signup',
    });
    setSubmitting(false);
    if (otpErr) {
      setError(
        otpErr.message?.toLowerCase().includes('expired')
          ? 'That code expired. Tap "Resend code" and use the new one.'
          : 'That code didn\'t match. Check the email and try again.'
      );
    }
    // Success: session established, App.tsx SIGNED_IN listener takes over.
  }

  async function handleResetPassword() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    const token = code.trim();
    if (token.length !== 6) { setError('Enter the 6-digit code from your email.'); return; }
    if (newPwd.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPwd !== confirmPwd) { setError('Passwords don\'t match.'); return; }
    setSubmitting(true);
    const { error: otpErr } = await supabase.auth.verifyOtp({
      email: trimmed,
      token,
      type: 'recovery',
    });
    if (otpErr) {
      setSubmitting(false);
      setError(
        otpErr.message?.toLowerCase().includes('expired')
          ? 'That code expired. Tap "Resend code" and use the new one.'
          : 'That code didn\'t match. Check the email and try again.'
      );
      return;
    }
    // Verified: we now have a session. Set the new password — never swallow a
    // failure here, or the screen would sit there doing nothing.
    const { error: updErr } = await supabase.auth.updateUser({ password: newPwd });
    setSubmitting(false);
    if (updErr) {
      setError(
        updErr.message?.toLowerCase().includes('different from the old')
          ? 'Choose a password different from your current one.'
          : `Couldn't set the new password: ${updErr.message}`
      );
      return;
    }
    // App.tsx's PASSWORD_RECOVERY/SIGNED_IN listener now opens the dashboard.
  }

  function openForgot() {
    setError(null);
    setCode('');
    setNewPwd('');
    setConfirmPwd('');
    setResent(false);
    setForgotStep('request');
  }

  function closeForgot() {
    setError(null);
    setForgotStep(null);
  }

  async function handleSignIn() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 1) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setSubmitting(false);
    if (err) {
      if (err.message?.toLowerCase().includes('not confirmed')) {
        // Signup was never finished — send a fresh code and let them confirm here.
        setCode('');
        setForgotStep('confirm');
        setSubmitting(true);
        await supabase.auth.resend({ type: 'signup', email: trimmed }).catch(() => {});
        setSubmitting(false);
        return;
      }
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
      return;
    }
  }

  if (forgotStep !== null) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity onPress={closeForgot} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color={C.text} />
            </TouchableOpacity>

            <View style={s.hero}>
              <Ionicons name={forgotStep === 'confirm' ? 'mail-unread-outline' : 'key-outline'} size={56} color={C.accent} />
              <Text style={s.appName}>{forgotStep === 'confirm' ? 'Confirm your email' : 'Reset password'}</Text>
              <Text style={s.tagline}>
                {forgotStep === 'request'
                  ? "Enter your account email and we'll send you a 6-digit code."
                  : forgotStep === 'confirm'
                    ? `Your email was never confirmed. We just sent a new 6-digit code to ${email.trim().toLowerCase()} — enter it below.`
                    : `We sent a code to ${email.trim().toLowerCase()}. Enter it below with your new password.`}
              </Text>
            </View>

            <View style={s.form}>
              {forgotStep === 'request' ? (
                <>
                  <Text style={s.label}>EMAIL</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={C.sub} />
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
                  </View>

                  {error ? <Text style={s.error}>{error}</Text> : null}

                  <TouchableOpacity
                    style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSendResetCode}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    <Text style={s.primaryBtnText}>{submitting ? 'Sending…' : 'Send Code'}</Text>
                    <Ionicons name="paper-plane-outline" size={18} color={C.accentText} />
                  </TouchableOpacity>
                </>
              ) : forgotStep === 'confirm' ? (
                <>
                  <Text style={s.label}>6-DIGIT CODE</Text>
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
                    style={[s.primaryBtn, (submitting || code.length !== 6) && { opacity: 0.6 }]}
                    onPress={handleConfirmSignupCode}
                    disabled={submitting || code.length !== 6}
                    activeOpacity={0.85}
                  >
                    <Text style={s.primaryBtnText}>{submitting ? 'Confirming…' : 'Confirm & Sign In'}</Text>
                    <Ionicons name="checkmark" size={20} color={C.accentText} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleSendResetCode} style={s.linkBtn} disabled={submitting}>
                    <Text style={s.linkText}>
                      Didn't get a code?  <Text style={s.linkAccent}>Resend code</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.label}>6-DIGIT CODE</Text>
                  <TextInput
                    style={s.codeInput}
                    value={code}
                    onChangeText={(t) => { setCode(t.replace(/[^0-9]/g, '')); setError(null); }}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={C.muted}
                  />

                  <Text style={s.label}>NEW PASSWORD</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
                    <TextInput
                      style={s.input}
                      value={newPwd}
                      onChangeText={setNewPwd}
                      placeholder="At least 8 characters"
                      placeholderTextColor={C.muted}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
                    </TouchableOpacity>
                  </View>

                  <Text style={s.label}>CONFIRM NEW PASSWORD</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
                    <TextInput
                      style={s.input}
                      value={confirmPwd}
                      onChangeText={setConfirmPwd}
                      placeholder="Re-enter new password"
                      placeholderTextColor={C.muted}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none"
                    />
                  </View>

                  {error ? <Text style={s.error}>{error}</Text> : null}
                  {resent ? <Text style={s.resentNote}>New code sent — check your inbox.</Text> : null}

                  <TouchableOpacity
                    style={[s.primaryBtn, (submitting || code.length !== 6) && { opacity: 0.6 }]}
                    onPress={handleResetPassword}
                    disabled={submitting || code.length !== 6}
                    activeOpacity={0.85}
                  >
                    <Text style={s.primaryBtnText}>{submitting ? 'Resetting…' : 'Reset Password & Sign In'}</Text>
                    <Ionicons name="checkmark" size={20} color={C.accentText} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleSendResetCode} style={s.linkBtn} disabled={submitting}>
                    <Text style={s.linkText}>
                      Didn't get a code?  <Text style={s.linkAccent}>Resend code</Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
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
            <Text style={s.appName}>TruckersPro</Text>
            <Text style={s.tagline}>Welcome back</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>EMAIL</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.sub} />
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
            </View>

            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={openForgot} style={s.forgotBtn} hitSlop={{ top: 6, bottom: 6 }}>
              <Text style={s.linkAccent}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSignIn}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{submitting ? 'Signing in…' : 'Sign In'}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.accentText} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={s.linkBtn}>
              <Text style={s.linkText}>
                Don't have an account?  <Text style={s.linkAccent}>Sign up</Text>
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
  scroll: { padding: 24, gap: 24 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  logo: { width: 120, height: 120, borderRadius: 28 },
  appName: { fontSize: 28, fontWeight: '800', color: C.text, marginTop: 8 },
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
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 12,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.sub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700', fontSize: 14 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4 },
  codeInput: {
    backgroundColor: C.card, borderRadius: 16,
    paddingVertical: 16, fontSize: 28, fontWeight: '800', color: C.text,
    textAlign: 'center', letterSpacing: 12,
  },
  resentNote: { color: C.success, fontSize: 13, fontWeight: '600', marginTop: 4 },
});
