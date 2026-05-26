import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, shadow } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

const COMPANY_SUB_TYPES = [
  { label: 'Per Mile', sub: 'Mileage-based earnings', route: 'CompanyMile', icon: 'speedometer-outline' as const },
  { label: 'Commission', sub: 'Commission-based earnings', route: 'CompanyCommission', icon: 'cash-outline' as const },
];

export function HomeScreen({ navigation }: Props) {
  const [companyExpanded, setCompanyExpanded] = useState(false);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.hero}>
        <SafeAreaView>
          <View style={s.heroInner}>
            <Image
              source={require('../../Logo.jpeg')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.appName}>TruckersPro</Text>
            <Text style={s.heroSub}>Your pocket expense tracker</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={s.body}>
        <Text style={s.sectionLabel}>SELECT DRIVER TYPE</Text>

        <TouchableOpacity
          style={s.card}
          onPress={() => navigation.navigate('OwnerOp')}
          activeOpacity={0.85}
        >
          <View style={s.iconBox}>
            <Ionicons name="truck-outline" size={22} color={C.gradEnd} />
          </View>
          <View style={s.cardText}>
            <Text style={s.cardTitle}>Owner Operator</Text>
            <Text style={s.cardSub}>Full expense tracking</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </TouchableOpacity>

        <Text style={[s.sectionLabel, { marginTop: 8 }]}>OTHER</Text>

        <TouchableOpacity
          style={s.card}
          onPress={() => setCompanyExpanded(v => !v)}
          activeOpacity={0.85}
        >
          <View style={s.iconBox}>
            <Ionicons name="people-outline" size={22} color={C.gradEnd} />
          </View>
          <View style={s.cardText}>
            <Text style={s.cardTitle}>Company Driver</Text>
            <Text style={s.cardSub}>Per Mile or Commission</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={C.muted}
            style={{ transform: [{ rotate: companyExpanded ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {companyExpanded && COMPANY_SUB_TYPES.map(({ label, sub, route, icon }) => (
          <TouchableOpacity
            key={route}
            style={s.subCard}
            onPress={() => navigation.navigate(route)}
            activeOpacity={0.85}
          >
            <View style={s.subIconBox}>
              <Ionicons name={icon} size={18} color={C.gradEnd} />
            </View>
            <View style={s.cardText}>
              <Text style={s.subCardTitle}>{label}</Text>
              <Text style={s.cardSub}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hero: { paddingBottom: 32 },
  heroInner: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: 12, opacity: 0.92, marginBottom: 8 },
  appName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  body: { flex: 1, padding: 20, marginTop: -16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14,
    ...{ shadowColor: '#1E3A8A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  },
  subCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14,
    marginBottom: 8, marginLeft: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 2, borderLeftColor: C.gradEnd,
    ...{ shadowColor: '#1E3A8A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  subIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  subCardTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  cardSub: { fontSize: 13, color: C.sub, marginTop: 2 },
});
