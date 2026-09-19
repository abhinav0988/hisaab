import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";
import { SessionProvider } from "./session-provider";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.green,
    text: colors.white,
    border: colors.line,
  },
};

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          {children}
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
