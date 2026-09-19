import { ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { AppButton } from "../../components/ui/button";
import { AuthTopBar } from "../../components/ui/auth-top-bar";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetSuccess">;

export function ResetSuccessScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <AuthTopBar onBack={() => navigation.navigate("Login")} />
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Icon name="shield-checkmark" size={54} />
          </View>
          <Text style={styles.h1}>Password Reset Successful!</Text>
          <Text style={styles.subtitle}>
            Your password has been updated successfully. You can now sign in with your new password.
          </Text>
        </View>
        <AppButton label="Go to Sign In" onPress={() => navigation.navigate("Login")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 28,
    flexGrow: 1,
    justifyContent: "space-between",
  },
  hero: { alignItems: "center", gap: 14, paddingTop: 48 },
  badge: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
