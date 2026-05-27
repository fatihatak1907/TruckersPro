import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { OwnerOpDashboard } from '../screens/owner-op/OwnerOpDashboard';
import { OwnerOpAddLoad } from '../screens/owner-op/OwnerOpAddLoad';
import { OwnerOpFuel } from '../screens/owner-op/OwnerOpFuel';
import { OwnerOpWeeklyExpenses } from '../screens/owner-op/OwnerOpWeeklyExpenses';
import { OwnerOpHistory } from '../screens/owner-op/OwnerOpHistory';

import { CompanyMileDashboard } from '../screens/company-mile/CompanyMileDashboard';
import { CompanyMileAddLoad } from '../screens/company-mile/CompanyMileAddLoad';
import { CompanyMileHistory } from '../screens/company-mile/CompanyMileHistory';

import { CompanyCommissionDashboard } from '../screens/company-commission/CompanyCommissionDashboard';
import { CompanyCommissionAddLoad } from '../screens/company-commission/CompanyCommissionAddLoad';
import { CompanyCommissionHistory } from '../screens/company-commission/CompanyCommissionHistory';

import { TabBar } from './TabBar';

const OwnerOpTabsNav = createBottomTabNavigator();
const CompanyMileTabsNav = createBottomTabNavigator();
const CompanyCommissionTabsNav = createBottomTabNavigator();

export function OwnerOpTabs({ driverType = 'owner-op' }: { driverType?: string } = {}) {
  return (
    <NavigationContainer>
      <OwnerOpTabsNav.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <OwnerOpTabsNav.Screen name="Dashboard"  component={OwnerOpDashboard}      initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="AddLoad"    component={OwnerOpAddLoad}        initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="Fuel"       component={OwnerOpFuel}           initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="Expenses"   component={OwnerOpWeeklyExpenses} initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="History"    component={OwnerOpHistory}        initialParams={{ driverType }} />
      </OwnerOpTabsNav.Navigator>
    </NavigationContainer>
  );
}

export function CompanyMileTabs() {
  return (
    <NavigationContainer>
      <CompanyMileTabsNav.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <CompanyMileTabsNav.Screen name="Dashboard" component={CompanyMileDashboard} initialParams={{ driverType: 'company-mile' }} />
        <CompanyMileTabsNav.Screen name="AddLoad"   component={CompanyMileAddLoad}   initialParams={{ driverType: 'company-mile' }} />
        <CompanyMileTabsNav.Screen name="History"   component={CompanyMileHistory}   initialParams={{ driverType: 'company-mile' }} />
      </CompanyMileTabsNav.Navigator>
    </NavigationContainer>
  );
}

export function CompanyCommissionTabs() {
  return (
    <NavigationContainer>
      <CompanyCommissionTabsNav.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <CompanyCommissionTabsNav.Screen name="Dashboard" component={CompanyCommissionDashboard} initialParams={{ driverType: 'company-commission' }} />
        <CompanyCommissionTabsNav.Screen name="AddLoad"   component={CompanyCommissionAddLoad}   initialParams={{ driverType: 'company-commission' }} />
        <CompanyCommissionTabsNav.Screen name="History"   component={CompanyCommissionHistory}   initialParams={{ driverType: 'company-commission' }} />
      </CompanyCommissionTabsNav.Navigator>
    </NavigationContainer>
  );
}
