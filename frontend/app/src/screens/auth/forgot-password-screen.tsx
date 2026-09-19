import { useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { authService } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { AuthTopBar } from "../../components/ui/auth-top-bar";
import { Field } from "../../components/ui/field";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <AuthTopBar onBack={() => navigation.navigate("Login")} />
        <View style={styles.hero}>
          <View style={styles.lockWrap}>
            <Icon name="lock-closed" size={52} />
            <View style={styles.plane}>
              <Icon name="paper-plane-outline" size={22} />
            </View>
          </View>
          <Text style={styles.h1}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            No worries! Enter your email address and we'll send you a reset code.
          </Text>
        </View>
        <View style={styles.card}>
          <Field
            label="Email address"
            placeholder="name@example.com"
            leftIcon="mail-outline"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.note}>
            <Icon name="shield-checkmark-outline" size={18} />
            <Text style={styles.noteText}>We will send you a 6-digit code to reset your password.</Text>
          </View>
          <AppButton
            label="Send Reset Code"
            onPress={async () => {
              await authService.requestReset(email);
              navigation.navigate("Otp", {
                email: email || "name@example.com",
                purpose: "reset",
              });
            }}
          />
        </View>
        <Text style={styles.footer}>
          Remember your password?{" "}
          <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
            Back to sign in
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 22 },
  hero: { alignItems: "center", gap: 12, paddingTop: 12 },
  lockWrap: {
    width: 110,
    height: 110,
    borderRadius: 36,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  plane: { position: "absolute", right: -6, top: 8 },
  h1: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
    textAlign: "center",
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: 12 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 16,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel2,
    borderRadius: 16,
    padding: 14,
  },
  noteText: { color: colors.muted, flex: 1, fontSize: 13, lineHeight: 18 },
  footer: { color: colors.muted, textAlign: "center" },
  link: { color: colors.green, fontWeight: "700" },
});
