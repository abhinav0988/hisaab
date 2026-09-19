import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { passwordSchema } from "@hisaab/validation";
import { colors, radius } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { authService } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [hideConfirm, setHideConfirm] = useState(true);
  const [agreed, setAgreed] = useState(true);

  const checks = useMemo(
    () => [
      { label: "8+ characters", ok: password.length >= 8 },
      { label: "At least 1 number", ok: /\d/.test(password) },
      { label: "Passwords match", ok: password.length > 0 && password === confirm },
    ],
    [password, confirm],
  );

  const strong = checks.every((check) => check.ok) && passwordSchema.safeParse(password).success;

  function goToOtp() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Missing details", "Enter your name and email first.");
      return;
    }
    if (!strong) {
      Alert.alert("Password", "Use a stronger password that matches.");
      return;
    }
    if (!agreed) {
      Alert.alert("Terms", "Please agree to the Terms & Privacy Policy.");
      return;
    }
    void authService.signUp({ name, email, password });
    navigation.navigate("Otp", { email, purpose: "signup" });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.moon}>
          <Icon name="moon-outline" size={18} />
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>
                Create your <Text style={styles.brand}>Hisaab</Text>
              </Text>
              <Text style={styles.subtitle}>
                Create your private money space. Verify your email first, then complete secure
                account setup.
              </Text>
            </View>
            <View style={styles.shield}>
              <Icon name="shield-checkmark" size={22} />
            </View>
          </View>

          <Field
            label="Full name"
            placeholder="Enter your full name"
            leftIcon="person-outline"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            hint="Required for profile setup."
          />

          <View style={styles.emailHead}>
            <Text style={styles.label}>Email address</Text>
            <Text style={styles.emailHint}>Verify this email before registration</Text>
          </View>
          <View style={styles.emailRow}>
            <View style={{ flex: 1 }}>
              <Field
                placeholder="name@example.com"
                leftIcon="mail-outline"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <Pressable style={styles.send} onPress={goToOtp}>
              <Icon name="mail-outline" size={16} />
              <Text style={styles.sendText}>Send code</Text>
            </Pressable>
          </View>

          <View style={styles.passRow}>
            <View style={styles.passCol}>
              <View style={styles.passHead}>
                <Text style={styles.label}>Create password</Text>
                <Pressable onPress={() => setHidePassword((value) => !value)}>
                  <Text style={styles.show}>{hidePassword ? "Show" : "Hide"}</Text>
                </Pressable>
              </View>
              <Field
                placeholder="Enter your password"
                leftIcon="lock-closed-outline"
                secure={hidePassword}
                value={password}
                onChangeText={setPassword}
              />
              <Text style={styles.hint}>Use 8+ characters and at least 1 number.</Text>
            </View>
            <View style={styles.passCol}>
              <View style={styles.passHead}>
                <Text style={styles.label}>Confirm password</Text>
                <Pressable onPress={() => setHideConfirm((value) => !value)}>
                  <Text style={styles.show}>{hideConfirm ? "Show" : "Hide"}</Text>
                </Pressable>
              </View>
              <Field
                placeholder="Re-enter your password"
                leftIcon="lock-closed-outline"
                secure={hideConfirm}
                value={confirm}
                onChangeText={setConfirm}
              />
              <Text style={styles.hint}>Re-enter the same secure password.</Text>
            </View>
          </View>

          <View style={styles.quality}>
            <View style={styles.qualityHead}>
              <Text style={styles.qualityTitle}>Password quality</Text>
              <View style={styles.target}>
                <Icon name="sparkles-outline" size={12} />
                <Text style={styles.targetText}>Strong target</Text>
              </View>
            </View>
            <View style={styles.chips}>
              {checks.map((check) => (
                <View key={check.label} style={[styles.chip, check.ok && styles.chipOk]}>
                  <Icon
                    name="checkmark-circle"
                    size={16}
                    color={check.ok ? colors.green : colors.muted}
                  />
                  <Text style={[styles.chipText, check.ok && { color: colors.white }]}>
                    {check.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.terms} onPress={() => setAgreed((value) => !value)}>
            <View style={[styles.box, agreed && styles.boxOn]}>
              {agreed ? <Icon name="checkmark" size={14} color={colors.ink} /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.link}>Terms & Privacy Policy</Text>
            </Text>
          </Pressable>

          <AppButton
            label="Verify email to continue"
            leftIcon="shield-checkmark-outline"
            onPress={goToOtp}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerCopy}>Already have an account?</Text>
          <Pressable style={styles.backPill} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 16 },
  moon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: colors.panel,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 14,
  },
  titleRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  h1: { color: colors.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  brand: { color: colors.green, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  shield: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.green,
    backgroundColor: colors.panel2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: colors.white, fontWeight: "700", fontSize: 14 },
  emailHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  emailHint: { color: colors.muted, fontSize: 11, flexShrink: 1, textAlign: "right" },
  emailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  send: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel2,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sendText: { color: colors.green, fontWeight: "800", fontSize: 13 },
  passRow: { flexDirection: "row", gap: 10 },
  passCol: { flex: 1, gap: 8 },
  passHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  show: { color: colors.green, fontWeight: "700", fontSize: 13 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  quality: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel2,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  qualityHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qualityTitle: { color: colors.white, fontWeight: "800" },
  target: { flexDirection: "row", alignItems: "center", gap: 4 },
  targetText: { color: colors.green, fontWeight: "700", fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.panel,
  },
  chipOk: { borderColor: colors.green },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  terms: { flexDirection: "row", alignItems: "center", gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  termsText: { color: colors.white, flex: 1, fontSize: 13, lineHeight: 18 },
  link: { color: colors.green, fontWeight: "700" },
  footer: { alignItems: "center", gap: 10, marginTop: 4 },
  footerCopy: { color: colors.muted },
  backPill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.panel,
  },
  backText: { color: colors.white, fontWeight: "700" },
});
