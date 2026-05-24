import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { OwnerOpDashboard } from '../screens/owner-op/OwnerOpDashboard';
import { OwnerOpAddLoad } from '../screens/owner-op/OwnerOpAddLoad';
import { OwnerOpWeeklyExpenses } from '../screens/owner-op/OwnerOpWeeklyExpenses';
import { OwnerOpHistory } from '../screens/owner-op/OwnerOpHistory';
import { CompanyMileDashboard } from '../screens/company-mile/CompanyMileDashboard';
import { CompanyMileAddLoad } from '../screens/company-mile/CompanyMileAddLoad';
import { CompanyMileHistory } from '../screens/company-mile/CompanyMileHistory';
import { CompanyCommissionDashboard } from '../screens/company-commission/CompanyCommissionDashboard';
import { CompanyCommissionAddLoad } from '../screens/company-commission/CompanyCommissionAddLoad';
import { CompanyCommissionHistory } from '../screens/company-commission/CompanyCommissionHistory';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function OwnerOpTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={OwnerOpDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={OwnerOpAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="WeeklyExpenses" component={OwnerOpWeeklyExpenses} options={{ tabBarLabel: 'Expenses' }} />
      <Tab.Screen name="History" component={OwnerOpHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

function CompanyMileTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={CompanyMileDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={CompanyMileAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="History" component={CompanyMileHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

function CompanyCommissionTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={CompanyCommissionDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={CompanyCommissionAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="History" component={CompanyCommissionHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="OwnerOp" component={OwnerOpTabs} options={{ title: 'Owner Operator' }} />
        <Stack.Screen name="CompanyMile" component={CompanyMileTabs} options={{ title: 'Company Driver — Per Mile' }} />
        <Stack.Screen name="CompanyCommission" component={CompanyCommissionTabs} options={{ title: 'Company Driver — Commission' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
