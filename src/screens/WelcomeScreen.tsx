import React from 'react';
import { View, Text, ImageBackground, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

type Props = { navigation: any };

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../../assets/welcome-bg.jpg')}
        style={s.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(15,20,25,0)', 'rgba(15,20,25,0.4)', 'rgba(15,20,25,0.95)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[s.content, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={s.title}>Drive smart.{'\n'}Track every mile.</Text>

          <View style={s.dots}>
            <View style={[s.dot, s.dotActive]} />
            <View style={s.dot} />
            <View style={s.dot} />
          </View>

          <View style={s.buttonRow}>
            <TouchableOpacity
              style={s.button}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={s.buttonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.button}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.85}
            >
              <Text style={s.buttonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bg: { flex: 1, justifyContent: 'flex-end' },
  content: { padding: 24, gap: 28 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', lineHeight: 42 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 32 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
