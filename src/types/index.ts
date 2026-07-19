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
  extraMileage?: number;
};

export type FuelEntry = {
  id: string;
  weekKey: string;
  type: 'diesel' | 'def';
  cost: number;
  createdAt: string;
};

export type Frequency = 'weekly' | 'monthly';

export type OtherFrequency = 'once' | 'daily' | 'weekly' | 'monthly';

export type OtherExpense = {
  id: string;
  label: string;
  amount: number;
  frequency: OtherFrequency;
};

export type WeeklyExpenses = {
  weekKey: string;
  truckPayment: number;
  truckPaymentFrequency: Frequency;
  truckInsurance: number;
  truckInsuranceFrequency: Frequency;
  trailerInsurance: number;
  trailerInsuranceFrequency: Frequency;
  trailerLease: number;
  trailerLeaseFrequency: Frequency;
  iftaCost: number;
  iftaCostFrequency: Frequency;
  adminFee: number;
  adminFeeFrequency: Frequency;
  other: number;
  otherFrequency: Frequency;
  otherExpenses?: OtherExpense[];
  startOdometer: number;
  endOdometer: number;
  mileageRate?: number; // $/mi deduction rate; default 0.14 (lease drivers can customize)
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

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export type PaySchedule = {
  startDate: string; // YYYY-MM-DD, any date
  frequency: PayFrequency;
  payDay: number; // weekly/biweekly: 1=Mon … 7=Sun; monthly: 1–28, or 31 = last day of month
};

export type PayPeriod = {
  key: string; // YYYY-MM-DD of the period start
  start: string;
  end: string; // inclusive
  payDate: string;
};
