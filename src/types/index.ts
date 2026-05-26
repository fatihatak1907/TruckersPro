export type DriverType = 'owner-op' | 'company-mile' | 'company-commission';

export type LoadEntry = {
  id: string;
  weekKey: string;
  driverType: DriverType;
  startLocation: string;
  endLocation: string;
  createdAt: string;
  earnings?: number;
  tonu?: number;
  commissionRate?: number;
  paidMileage?: number;
  centsPerMile?: number;
};

export type FuelEntry = {
  id: string;
  weekKey: string;
  type: 'diesel' | 'def';
  cost: number;
  createdAt: string;
};

export type WeeklyExpenses = {
  weekKey: string;
  truckPayment: number;
  truckPaymentFrequency: 'weekly' | 'monthly';
  truckInsurance: number;
  trailerInsurance: number;
  trailerLease: number;
  iftaCost: number;
  adminFee: number;
  other: number;
  startOdometer: number;
  endOdometer: number;
};

export type OwnerOpWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  totalExpenses: number;
  totalDiesel: number;
  totalDef: number;
  milesDriven: number;
  mileageDeduction: number;
  netProfit: number;
};

export type CompanyMileWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  netProfit: number;
};

export type CompanyCommissionWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  netProfit: number;
};
