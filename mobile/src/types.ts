import type { NavigatorScreenParams } from '@react-navigation/native';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
};

export type Session = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: User;
};

export type ServiceItem = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
};

export type Barber = {
  id: string;
  name: string;
};

export type WalletTransaction = {
  type: 'CREDIT' | 'DEBIT' | 'RESERVATION' | 'RELEASE';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

export type Wallet = {
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  transactions: WalletTransaction[];
};

export type Appointment = {
  appointmentId: string;
  status: string;
  totalPrice: number;
  cashbackUsed: number;
  amountToPay: number;
  startTimestamp: string;
  endTimestamp: string;
  barberName: string;
  services: Array<{
    name: string;
    durationMinutes: number;
    price: number;
  }>;
  paymentPayload?: {
    qrCodeBase64: string;
    copyPasteCode: string;
  };
};

export type TabParamList = {
  Home: undefined;
  Appointments: undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  Services: undefined;
  Schedule: { serviceIds: string[] };
  Checkout: {
    serviceIds: string[];
    barberId: string;
    barberName: string;
    startTimestamp: string;
  };
  Success: { appointment: Appointment };
};
