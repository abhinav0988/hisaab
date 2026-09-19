import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { authService } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { AuthTopBar } from "../../components/ui/auth-top-bar";
import { Field } from "../../components/ui/field";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);

  const checks = useMemo(
    () => [
      { label: "At least 8 characters", ok: password.length >= 8 },
      { label: "Contains uppercase & lowercase letters", ok: /[A-Z]/.test(password) && /[a-z]/.test(password) },
      { label: "Contains number", ok: /\d/.test(password) },
      { label: "Contains special character", ok: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );
  const score = checks.filter((check) => check.ok).length;
  const match = password.length > 0 && password === confirm;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <AuthTopBar
          onBack={() =>
            navigation.navigate("Otp", { email: route.params.email ?? "name@example.com", purpose: "reset" })
          }
        />
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Icon name="lock-closed" size={28} />
          </View>
          <Text style={styles.h1}>Create New Password</Text>
          <Text style={styles.subtitle}>
            Your new password must be different from previous used passwords.
          </Text>
        </View>
        <Field
          label="New password"
          placeholder="Enter new password"
          leftIcon="lock-closed-outline"
          secure={hidePassword}
          value={password}
          onChangeText={setPassword}
          right={
            <Pressable onPress={() => setHidePassword((value) => !value)} hitSlop={8}>
              <Icon name={hidePassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
            </Pressable>
          }
        />
        <View style={styles.strength}>
          <View style={styles.strengthRow}>
            <Text style={styles.strengthLabel}>Password strength</Text>
            <Text style={styles.strengthValue}>{score >= 4 ? "Strong" : score >= 2 ? "Medium" : "Weak"}</Text>
          </View>
          <View style={styles.bars}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={[styles.bar, index < score && styles.barOn]} />
            ))}
          </View>
        </View>
        <View style={styles.checks}>
          {checks.map((check) => (
            <View key={check.label} style={styles.check}>
              <Icon name="checkmark-circle" size={18} color={check.ok ? colors.green : colors.muted} />
              <Text style={[styles.checkText, check.ok && { color: colors.white }]}>{check.label}</Text>
            </View>
          ))}
        </View>
        <Field
          label="Confirm new password"
          placeholder="Confirm new password"
          leftIcon="lock-closed-outline"
          secure={hideConfirm}
          value={confirm}
          onChangeText={setConfirm}
          right={
            <Pressable onPress={() => setHideConfirm((value) => !value)} hitSlop={8}>
              <Icon name={hideConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={colors.muted} />
            </Pressable>
          }
        />
        <AppButton
          label="Update Password"
          onPress={async () => {
            if (score < 4 || !match) {
              Alert.alert("Password", "Use a strong password and confirm it matches.");
              return;
            }
            await authService.resetPassword(password);
            navigation.navigate("ResetSuccess");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 16 },
  hero: { alignItems: "center", gap: 10, paddingTop: 4 },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { color: colors.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.6, textAlign: "center" },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  strength: { gap: 8 },
  strengthRow: { flexDirection: "row", justifyContent: "space-between" },
  strengthLabel: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  strengthValue: { color: colors.green, fontWeight: "800" },
  bars: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 99, backgroundColor: colors.panel2 },
  barOn: { backgroundColor: colors.green },
  checks: { gap: 10 },
  check: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
