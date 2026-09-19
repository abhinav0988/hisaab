import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, radius } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { useSession } from "../../providers/session-provider";
import { authService } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { AuthTopBar } from "../../components/ui/auth-top-bar";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

export function OtpScreen({ navigation, route }: Props) {
  const { signIn } = useSession();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(45);
  const signup = route.params.purpose === "signup";
  const email = route.params.email;

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <AuthTopBar onBack={() => navigation.navigate(signup ? "Register" : "ForgotPassword")} />
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Icon name="shield-checkmark" size={28} />
          </View>
          <Text style={styles.h1}>Verify OTP</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to{"\n"}
            <Text style={styles.email}>{email}</Text>
          </Text>
        </View>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
          keyboardType="number-pad"
          style={styles.hidden}
        />
        <Pressable onPress={() => inputRef.current?.focus()}>
          <View style={styles.otpRow}>
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={[styles.otp, code[index] ? styles.otpFilled : null]}>
                <Text style={styles.otpText}>{code[index] ?? ""}</Text>
              </View>
            ))}
          </View>
        </Pressable>
        <Text style={styles.resend}>
          Didn't receive a code?{" "}
          {seconds > 0 ? (
            <Text style={styles.link}>Resend in 00:{String(seconds).padStart(2, "0")}</Text>
          ) : (
            <Text
              style={styles.link}
              onPress={() => {
                setSeconds(45);
                void authService.requestReset(email);
              }}
            >
              Resend
            </Text>
          )}
        </Text>
        <View style={styles.inbox}>
          <Icon name="paper-plane-outline" size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.inboxTitle}>Check your inbox and spam folder</Text>
            <Text style={styles.inboxCopy}>OTP will expire in 10 minutes for your security.</Text>
          </View>
        </View>
        <AppButton
          label="Verify OTP"
          onPress={async () => {
            await authService.verifyOtp(code);
            if (signup) {
              signIn();
              return;
            }
            navigation.navigate("ResetPassword", { email });
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 18 },
  hero: { alignItems: "center", gap: 10, paddingTop: 8 },
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
  h1: { color: colors.white, fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  email: { color: colors.green, fontWeight: "700" },
  hidden: { position: "absolute", opacity: 0, height: 1, width: 1 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  otp: {
    flex: 1,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  otpFilled: { borderColor: colors.green },
  otpText: { fontSize: 22, color: colors.white, fontWeight: "800" },
  resend: { color: colors.muted, textAlign: "center" },
  link: { color: colors.green, fontWeight: "700" },
  inbox: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 16,
  },
  inboxTitle: { color: colors.white, fontWeight: "800" },
  inboxCopy: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
