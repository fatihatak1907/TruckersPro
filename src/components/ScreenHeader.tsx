import React, { ReactNode } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  showLogo?: boolean;
  onPress?: () => void;
};

export function ScreenHeader({ title, subtitle, left, right, showLogo = true, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const middle = (
    <View style={s.middle}>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        {left ?? (showLogo ? (
          <Image source={require('../../Logo.jpeg')} style={s.logo} resizeMode="contain" />
        ) : null)}
        {onPress ? (
          <TouchableOpacity style={s.middle} onPress={onPress} activeOpacity={0.7}>
            {middle.props.children}
          </TouchableOpacity>
        ) : (
          middle
        )}
        {right ?? <View style={{ width: 28 }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: C.bg, paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  middle: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13, fontWeight: '600', color: C.sub, marginTop: 2 },
});
