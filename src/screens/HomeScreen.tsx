import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>TruckersPro</Text>
        <Text style={styles.subtitle}>Select your driver type</Text>

        {[
          { label: 'Owner Operator', route: 'OwnerOp' },
          { label: 'Company Driver — Per Mile', route: 'CompanyMile' },
          { label: 'Company Driver — Commission', route: 'CompanyCommission' },
        ].map(({ label, route }) => (
          <TouchableOpacity
            key={route}
            style={styles.card}
            onPress={() => navigation.navigate(route)}
          >
            <Text style={styles.cardText}>{label}</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#1a3c6b', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardText: { fontSize: 16, fontWeight: '600', color: '#222' },
  arrow: { fontSize: 20, color: '#1a3c6b' },
});
