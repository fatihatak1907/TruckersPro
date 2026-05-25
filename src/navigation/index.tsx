import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { WeekProvider } from '../context/WeekContext';
import { HomeScreen } from '../screens/HomeScreen';
import { OwnerOpDashboard } from '../screens/owner-op/OwnerOpDashboard';
import { OwnerOpAddLoad } from '../screens/owner-op/OwnerOpAddLoad';
import { OwnerOpWeeklyExpenses } from '../screens/owner-op/OwnerOpWeeklyExpenses';
import { OwnerOpFuel } from '../screens/owner-op/OwnerOpFuel';
import { OwnerOpHistory } from '../screens/owner-op/OwnerOpHistory';
import { CompanyMileDashboard } from '../screens/company-mile/CompanyMileDashboard';
import { CompanyMileAddLoad } from '../screens/company-mile/CompanyMileAddLoad';
import { CompanyMileHistory } from '../screens/company-mile/CompanyMileHistory';
import { CompanyCommissionDashboard } from '../screens/company-commission/CompanyCommissionDashboard';
import { CompanyCommissionAddLoad } from '../screens/company-commission/CompanyCommissionAddLoad';
import { CompanyCommissionHistory } from '../screens/company-commission/CompanyCommissionHistory';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabBarScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: '#2563EB',
  tabBarInactiveTintColor: '#94A3B8',
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E2E8F0',
    height: 60,
    paddingBottom: 8,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

function OwnerOpTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={OwnerOpDashboard}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AddLoad"
        component={OwnerOpAddLoad}
        options={{
          tabBarLabel: 'Add Load',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Fuel"
        component={OwnerOpFuel}
        options={{
          tabBarLabel: 'Fuel',
          tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="WeeklyExpenses"
        component={OwnerOpWeeklyExpenses}
        options={{
          tabBarLabel: 'Expenses',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={OwnerOpHistory}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function CompanyMileTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={CompanyMileDashboard}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AddLoad"
        component={CompanyMileAddLoad}
        options={{
          tabBarLabel: 'Add Load',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={CompanyMileHistory}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function CompanyCommissionTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={CompanyCommissionDashboard}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AddLoad"
        component={CompanyCommissionAddLoad}
        options={{
          tabBarLabel: 'Add Load',
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={CompanyCommissionHistory}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <WeekProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="OwnerOp"
            component={OwnerOpTabs}
            options={{ headerShown: false, gestureEnabled: false, headerLeft: () => null }}
          />
          <Stack.Screen
            name="CompanyMile"
            component={CompanyMileTabs}
            options={{ headerShown: false, gestureEnabled: false, headerLeft: () => null }}
          />
          <Stack.Screen
            name="CompanyCommission"
            component={CompanyCommissionTabs}
            options={{ headerShown: false, gestureEnabled: false, headerLeft: () => null }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </WeekProvider>
  );
}
