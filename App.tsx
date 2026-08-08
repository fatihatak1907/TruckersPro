import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity, AppState } from 'react-native';
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
import { saveDriverType, getDriverType, wipeAll, getLastUserId, setLastUserId } from './src/storage/storage';
import { C } from './src/theme';
import { DialogHost } from './src/components/AppDialog';

type AuthState = 'loading' | 'signed-out' | 'needs-profile' | 'migrating' | 'ready' | 'error';

async function createProfileFromMetadata(uid: string): Promise<{ driver_type: string; name: string } | null> {
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata as {
    driver_type?: string;
    name?: string;
    schedule_start_date?: string;
    schedule_frequency?: string;
    schedule_pay_day?: number;
  } | undefined;
  if (!meta?.driver_type) return null;
  const { error } = await supabase.from('profiles').insert({
    user_id: uid,
    driver_type: meta.driver_type,
    name: meta.name ?? '',
    ...(meta.schedule_start_date
      ? {
          schedule_start_date: meta.schedule_start_date,
          schedule_frequency: meta.schedule_frequency ?? 'weekly',
          schedule_pay_day: meta.schedule_pay_day ?? 5,
        }
      : {}),
  });
  if (error) return null;
  return { driver_type: meta.driver_type, name: meta.name ?? '' };
}

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
      // A different account logged in on this device (e.g. sign-out wipe was
      // interrupted, or the app was killed mid-sign-out): purge every leftover
      // local key so the previous user's schedule/data can't leak into — or be
      // uploaded to — this account. The pull below restores this user's data.
      const lastUid = await getLastUserId();
      if (lastUid && lastUid !== uid) {
        await wipeAll();
      }
      let profile = await fetchProfileWithRetry(uid);
      if (!profile) {
        profile = await createProfileFromMetadata(uid);
      }
      if (!profile) {
        setAuthState('needs-profile');
        return;
      }
      setAuthState('migrating');
      await saveDriverType(profile.driver_type);
      await setLastUserId(uid);
      setDriverType(profile.driver_type);
      await runMigrationAndPull(uid);
      syncEngine.start();
      setAuthState('ready');
    } catch (e: any) {
      // Offline fallback: if this device already belongs to this user, open the
      // app on local data — the sync engine reconciles when signal returns.
      // A trucker in a dead zone must never be locked out of their own records.
      const lastUid = await getLastUserId().catch(() => null);
      const localType = await getDriverType().catch(() => null);
      if (lastUid === uid && localType) {
        setDriverType(localType);
        syncEngine.start();
        setAuthState('ready');
        return;
      }
      setError(e?.message ?? 'Sync failed');
      setAuthState('error');
    }
  }

  useEffect(() => {
    // Verify session against the server (not just local cache) so we catch
    // sessions for users that were deleted server-side.
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        // Only a definitive rejection (401/403: token revoked, user deleted)
        // means the session is bad. A network failure in a dead zone must NOT
        // sign the user out — fall back to the cached session and open offline.
        const definitive = !!error && (error.status === 401 || error.status === 403);
        if (!definitive) {
          const { data: cached } = await supabase.auth.getSession();
          if (cached.session?.user) {
            bootstrap(cached.session.user.id);
            return;
          }
        }
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
        // Wipe here too (not only in confirmAndSignOut) so session-expiry and
        // any other sign-out path also clears local data. Idempotent.
        wipeAll().catch(() => {});
        setUserId(null);
        setDriverType(null);
        setAuthState('signed-out');
      } else if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session?.user) {
        // PASSWORD_RECOVERY is what verifyOtp({type:'recovery'}) emits — it is a
        // real signed-in session, so it must open the app like SIGNED_IN does.
        bootstrap(session.user.id);
      }
    });
    // Refresh auth tokens only while the app is in the foreground
    // (Supabase's recommended React Native setup).
    supabase.auth.startAutoRefresh();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      sub.subscription.unsubscribe();
      appStateSub.remove();
    };
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

  return (
    <SafeAreaProvider>
      {content}
      {/* Mounted once, above every screen: renders app-themed dialogs in place
          of the OS default Alert. */}
      <DialogHost />
    </SafeAreaProvider>
  );
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
