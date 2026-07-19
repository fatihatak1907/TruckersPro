import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { isPeriodPaid, markPeriodPaid, unmarkPeriodPaid } from '../storage/storage';
import { useWeek } from '../context/WeekContext';

/** Paid/pending state of the period currently shown on the dashboard.
 *  Marking is instant; un-marking asks first (guards against accidental taps). */
export function usePeriodPaid(driverType: string) {
  const { weekKey } = useWeek();
  const [paid, setPaid] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      isPeriodPaid(driverType, weekKey).then((v) => { if (live) setPaid(v); });
      return () => { live = false; };
    }, [driverType, weekKey])
  );

  const togglePaid = useCallback(() => {
    if (!paid) {
      setPaid(true);
      markPeriodPaid(driverType, weekKey);
      return;
    }
    Alert.alert('Remove payment confirmation?', 'This period will show as not paid.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => { setPaid(false); unmarkPeriodPaid(driverType, weekKey); },
      },
    ]);
  }, [paid, driverType, weekKey]);

  return { paid, togglePaid };
}
