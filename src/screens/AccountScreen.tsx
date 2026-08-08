import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  Linking, StatusBar, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showDialog } from '../components/AppDialog';
import { NameEditModal } from '../components/NameEditModal';
import { confirmAndSignOut } from '../utils/signOut';
import { confirmAndDeleteAccount } from '../utils/deleteAccount';
import { getProfileName, saveProfileName, getDriverType } from '../storage/storage';
import { supabase } from '../supabase/client';
import { C } from '../theme';
import appJson from '../../app.json';

const APP_VERSION = appJson.expo.version;

const PRIVACY_URL = 'https://fatihatak1907.github.io/TruckersPro/privacy.html';
const TERMS_URL = 'https://fatihatak1907.github.io/TruckersPro/terms.html';
const SUPPORT_EMAIL = 'fatihatak1907@gmail.com';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.fatihatak.truckerspro';

const DRIVER_LABELS: Record<string, string> = {
  'owner-op': 'Owner Operator',
  'lease': 'Lease Driver',
  'company-mile': 'Company Driver — Per Mile',
  'company-commission': 'Company Driver — Commission',
};

function Row({
  icon, label, value, onPress, danger, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const body = (
    <View style={[s.row, last && s.rowLast]}>
      <Ionicons name={icon} size={19} color={danger ? C.danger : C.accent} />
      <Text style={[s.rowLabel, danger && { color: C.danger }]}>{label}</Text>
      {value ? <Text style={s.rowValue} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={C.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{body}</TouchableOpacity>;
}

async function openUrl(url: string, failTitle: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) throw new Error('cannot open');
    await Linking.openURL(url);
  } catch {
    showDialog(failTitle, `Couldn't open the link. You can visit it directly:\n\n${url}`);
  }
}

export function AccountScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [driverType, setDriverType] = useState('');
  const [nameModalOpen, setNameModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getProfileName().then(setName).catch(() => {});
      getDriverType().then((t) => { if (t) setDriverType(t); }).catch(() => {});
      // Email lives only on the auth user; offline this stays blank rather
      // than blocking the screen.
      supabase.auth.getUser()
        .then(({ data }) => setEmail(data.user?.email ?? ''))
        .catch(() => {});
    }, [])
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Account</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.avatarBlock}>
          <View style={s.avatar}>
            <Ionicons name="person" size={34} color={C.accentText} />
          </View>
          <Text style={s.avatarName}>{name || 'Add your name'}</Text>
          {email ? <Text style={s.avatarSub}>{email}</Text> : null}
        </View>

        <Text style={s.sectionTitle}>PROFILE</Text>
        <View style={s.card}>
          <Row icon="person-outline" label="Name" value={name || 'Not set'} onPress={() => setNameModalOpen(true)} />
          <Row icon="mail-outline" label="Email" value={email || '—'} />
          <Row
            icon="bus-outline"
            label="Driver type"
            value={DRIVER_LABELS[driverType] ?? '—'}
            last
          />
        </View>
        <Text style={s.note}>
          Driver type is set when you create your account and can't be changed, because your
          saved loads and expenses are tied to it.
        </Text>

        <Text style={s.sectionTitle}>ABOUT</Text>
        <View style={s.card}>
          <Row
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => openUrl(PRIVACY_URL, 'Privacy Policy')}
          />
          <Row
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() => openUrl(TERMS_URL, 'Terms & Conditions')}
          />
          <Row
            icon="mail-open-outline"
            label="Contact Support"
            onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}?subject=TruckersPro%20Support`, 'Contact Support')}
          />
          <Row
            icon="star-outline"
            label="Rate this app"
            onPress={() => openUrl(PLAY_URL, 'Rate this app')}
          />
          <Row
            icon="share-social-outline"
            label="Share app"
            onPress={() => {
              Share.share({
                message: `TruckersPro — track your loads, fuel, expenses and real take-home pay.\n${PLAY_URL}`,
              }).catch(() => {});
            }}
          />
          <Row icon="information-circle-outline" label="App version" value={APP_VERSION} last />
        </View>

        <Text style={s.sectionTitle}>ACCOUNT ACTIONS</Text>
        <View style={s.card}>
          <Row icon="log-out-outline" label="Sign out" onPress={confirmAndSignOut} />
          <Row
            icon="trash-outline"
            label="Delete account"
            onPress={confirmAndDeleteAccount}
            danger
            last
          />
        </View>
        <Text style={s.note}>
          Deleting your account permanently removes your loads, fuel, expenses and pay history
          from our servers. This can't be undone.
        </Text>
      </ScrollView>

      <NameEditModal
        visible={nameModalOpen}
        initialName={name}
        onSave={async (n) => { await saveProfileName(n); setName(n); }}
        onClose={() => setNameModalOpen(false)}
      />
    </View>
  );
}

/** Modal wrapper so any tab can present the account screen without its own route. */
export function AccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <AccountScreen navigation={{ goBack: onClose }} />
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  body: { padding: 16, paddingBottom: 48 },
  avatarBlock: { alignItems: 'center', gap: 6, marginBottom: 24, marginTop: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 999,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarName: { fontSize: 20, fontWeight: '800', color: C.text, marginTop: 8 },
  avatarSub: { fontSize: 13, color: C.sub },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: C.sub,
    letterSpacing: 1.5, marginBottom: 8, marginTop: 8,
  },
  card: { backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: C.text, flex: 1 },
  rowValue: { fontSize: 13, color: C.sub, maxWidth: '52%' },
  note: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 8, marginBottom: 8, paddingHorizontal: 4 },
});
