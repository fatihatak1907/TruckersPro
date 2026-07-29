import { Alert } from 'react-native';
import { supabase } from '../supabase/client';
import { syncEngine } from '../sync/syncEngine';
import { wipeAll } from '../storage/storage';

/** Permanently delete the signed-in user's account and all of their data.
 *  Two confirmations, because this cannot be undone. */
export function confirmAndDeleteAccount(): void {
  Alert.alert(
    'Delete account',
    'This permanently deletes your account and every load, fuel entry, and expense you have recorded. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: askAgain },
    ]
  );
}

function askAgain(): void {
  Alert.alert('Are you sure?', 'Your data cannot be recovered after this.', [
    { text: 'Keep my account', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: runDelete },
  ]);
}

async function runDelete(): Promise<void> {
  // Stop syncing first: a queued op must not recreate rows we are deleting.
  syncEngine.stop();
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    // Deletion didn't happen — bring background sync back so the account
    // keeps working normally.
    syncEngine.start();
    Alert.alert(
      "Couldn't delete account",
      `${error.message}\n\nPlease check your connection and try again, or email admin@aigodpro.com for help.`
    );
    return;
  }
  // The account is gone server-side; clear the device and drop to the sign-in screen.
  await wipeAll();
  await supabase.auth.signOut().catch(() => {});
}
