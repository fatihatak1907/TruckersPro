import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { WeekProvider } from './src/context/WeekContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { supabase } from './src/supabase/client';
import { syncEngine } from './src/sync/syncEngine';
import { runMigrationAndPull } from './src/sync/migration';
import { C } from './src/theme';

type AuthState = 'loading' | 'signed-out' | 'migrating' | 'ready' | 'error';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);

  async function bootstrap(userId: string) {
    try {
      setAuthState('migrating');
      await runMigrationAndPull(userId);
      syncEngine.start();
      setAuthState('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Sync failed');
      setAuthState('error');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        bootstrap(data.session.user.id);
      } else {
        setAuthState('signed-out');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        syncEngine.stop();
        setAuthState('signed-out');
      } else if (event === 'SIGNED_IN' && session?.user) {
        bootstrap(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authState === 'loading' || authState === 'migrating') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.gradEnd} />
        <Text style={s.loadingText}>
          {authState === 'migrating' ? 'Loading your data…' : ''}
        </Text>
      </View>
    );
  }

  if (authState === 'error') {
    return (
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
  }

  if (authState === 'signed-out') {
    return <AuthScreen />;
  }

  return (
    <WeekProvider>
      <AppNavigator />
    </WeekProvider>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.sub, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.danger, marginBottom: 8 },
  errorBody: { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: C.gradEnd, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
