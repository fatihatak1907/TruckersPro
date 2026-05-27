import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  AddLoad:   'add-circle-outline',
  Fuel:      'water-outline',
  Expenses:  'wallet-outline',
  History:   'time-outline',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <View style={s.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          const icon = ICONS[route.name] ?? 'ellipse-outline';
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={s.cell}
            >
              <View style={[s.iconWrap, isFocused && s.iconWrapActive]}>
                <Ionicons
                  name={icon}
                  size={isFocused ? 22 : 20}
                  color={isFocused ? C.accentText : C.sub}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: C.cardElevated,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  iconWrap: {
    width: 44, height: 44,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: C.accent },
});
