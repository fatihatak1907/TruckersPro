import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WeekProvider } from './src/context/WeekContext';
import {
  OwnerOpTabs,
  CompanyMileTabs,
  CompanyCommissionTabs,
} from './src/navigation';
import { AuthStack } from './src/navigation/AuthStack';
import { PickDriverTypeScreen } from './src/screens/PickDriverTypeScreen';
import { supabase } from './src/supabase/client';
import { syncEngine } from './src/sync/syncEngine';
import { runMigrationAndPull } from './src/sync/migration';
import { saveDriverType } from './src/storage/storage';
import { C } from './src/theme';

type AuthState = 'loading' | 'signed-out' | 'needs-profile' | 'migrating' | 'ready' | 'error';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverType, setDriverType] = useState<string | null>(null);

  async function fetchProfileWithRetry(uid: string) {
    // SignupScreen inserts the profile row right after auth.signUp resolves,
    // but the SIGNED_IN event fires before that insert lands. Retry a few times
    // before declaring the profile missing.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('driver_type, name')
        .eq('user_id', uid)
        .maybeSingle();
      if (err) throw new Error(err.message);
      if (data) return data;
      await new Promise((r) => setTimeout(r, 300));
    }
    return null;
  }

  async function bootstrap(uid: string) {
    try {
      setUserId(uid);
      const profile = await fetchProfileWithRetry(uid);
      if (!profile) {
        setAuthState('needs-profile');
        return;
      }
      setAuthState('migrating');
      await saveDriverType(profile.driver_type);
      setDriverType(profile.driver_type);
      await runMigrationAndPull(uid);
      syncEngine.start();
      setAuthState('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Sync failed');
      setAuthState('error');
    }
  }

  useEffect(() => {
    // Verify session against the server (not just local cache) so we catch
    // sessions for users that were deleted server-side.
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        // Stale or invalid session — clear it locally before showing auth.
        await supabase.auth.signOut().catch(() => {});
        setAuthState('signed-out');
        return;
      }
      bootstrap(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        syncEngine.stop();
        setUserId(null);
        setDriverType(null);
        setAuthState('signed-out');
      } else if (event === 'SIGNED_IN' && session?.user) {
        bootstrap(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  let content: React.ReactNode;
  if (authState === 'loading' || authState === 'migrating') {
    content = (
      <View style={s.center}>
        <Image source={require('./logo.png')} style={s.splashLogo} resizeMode="contain" />
        <Text style={s.splashName}>TruckersPro</Text>
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 20 }} />
        <Text style={s.loadingText}>
          {authState === 'migrating' ? 'Loading your data…' : ''}
        </Text>
      </View>
    );
  } else if (authState === 'error') {
    content = (
      <View style={s.center}>
        <Text style={s.errorTitle}>Couldn't load your data</Text>
        <Text style={s.errorBody}>{error}</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => {
            setError(null);
            supabase.auth.getSession().then(({ data }) => {
              if (data.session?.user) bootstrap(data.session.user.id);
              else setAuthState('signed-out');
            });
          }}
        >
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (authState === 'signed-out') {
    content = <AuthStack />;
  } else if (authState === 'needs-profile' && userId) {
    content = (
      <PickDriverTypeScreen
        userId={userId}
        onDone={() => bootstrap(userId)}
      />
    );
  } else if (authState === 'ready') {
    content = (
      <WeekProvider>
        {driverType === 'company-mile' ? (
          <CompanyMileTabs />
        ) : driverType === 'company-commission' ? (
          <CompanyCommissionTabs />
        ) : (
          <OwnerOpTabs driverType={driverType ?? 'owner-op'} />
        )}
      </WeekProvider>
    );
  } else {
    content = <View style={s.center} />;
  }

  return <SafeAreaProvider>{content}</SafeAreaProvider>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  splashLogo: { width: 120, height: 120, borderRadius: 28 },
  splashName: { fontSize: 28, fontWeight: '800', color: C.text, marginTop: 16, letterSpacing: 0.5 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.sub, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.danger, marginBottom: 8 },
  errorBody: { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: C.accentText, fontSize: 14, fontWeight: '700' },
});
