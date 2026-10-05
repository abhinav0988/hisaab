export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register:
    | {
        verifiedEmail?: string;
        name?: string;
      }
    | undefined;
  ForgotPassword: undefined;
  Otp: {
    email: string;
    purpose?: "reset" | "signup";
    name?: string;
    /** Shown when email delivery is unavailable / API returns a code. */
    otp?: string;
  };
  ResetPassword: { email?: string; token?: string };
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
