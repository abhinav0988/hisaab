import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "./types";
import { WelcomeScreen } from "../screens/auth/welcome-screen";
import { LoginScreen } from "../screens/auth/login-screen";
import { RegisterScreen } from "../screens/auth/register-screen";
import { ForgotPasswordScreen } from "../screens/auth/forgot-password-screen";
import { OtpScreen } from "../screens/auth/otp-screen";
import { ResetPasswordScreen } from "../screens/auth/reset-password-screen";
import { ResetSuccessScreen } from "../screens/auth/reset-success-screen";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="ResetSuccess" component={ResetSuccessScreen} />
    </Stack.Navigator>
  );
}
