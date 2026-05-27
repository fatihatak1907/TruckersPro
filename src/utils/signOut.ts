import { Alert } from 'react-native';
import { supabase } from '../supabase/client';
import { syncEngine } from '../sync/syncEngine';
import { wipeAll } from '../storage/storage';

export function confirmAndSignOut(): void {
  Alert.alert('Sign out', 'Sign out of your account?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        syncEngine.stop();
        await supabase.auth.signOut();
        await wipeAll();
      },
    },
  ]);
}
