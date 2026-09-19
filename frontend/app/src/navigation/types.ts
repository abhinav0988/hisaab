export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Otp: { email: string; purpose?: "reset" | "signup" };
  ResetPassword: { email?: string };
  ResetSuccess: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Finance: undefined;
  Add: undefined;
  Transactions: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  Tabs: undefined;
  Feature: { toolId: string };
  Settings: undefined;
  Subscription: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};
