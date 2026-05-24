// src/types/index.ts

export type DriverType = 'owner-op' | 'company-mile' | 'company-commission';

export type LoadEntry = {
  id: string;
  weekKey: string;
  driverType: DriverType;
  startLocation: string;
  endLocation: string;
  createdAt: string;

  // owner-op + company-commission
  earnings?: number;
  commissionRate?: number; // e.g. 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.35

  // owner-op only
  diesel?: number;
  def?: number;

  // company-mile only
  paidMileage?: number;
  centsPerMile?: number;
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
  startOdometer: number;
  endOdometer: number;
};

export type OwnerOpWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  totalExpenses: number;
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
