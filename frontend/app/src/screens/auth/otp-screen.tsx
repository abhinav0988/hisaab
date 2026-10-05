import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, radius } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { authService, DEFAULT_DEV_OTP } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { AuthTopBar } from "../../components/ui/auth-top-bar";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "Otp">;

export function OtpScreen({ navigation, route }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(45);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownOtp, setShownOtp] = useState(route.params.otp ?? DEFAULT_DEV_OTP);
  const signup = route.params.purpose === "signup";
  const email = route.params.email;

  useEffect(() => {
    const next = route.params.otp ?? DEFAULT_DEV_OTP;
    setShownOtp(next);
    setCode(next);
  }, [route.params.otp]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      if (signup) {
        const result = await authService.sendVerificationCode(email);
        setShownOtp(result.otp);
        setCode(result.otp);
      } else {
        await authService.requestReset(email);
        setShownOtp(DEFAULT_DEV_OTP);
        setCode(DEFAULT_DEV_OTP);
      }
      setSeconds(45);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not resend. Use the code already shown above.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const nextCode = (code || shownOtp).replace(/\D/g, "").slice(0, 6);
    if (nextCode.length < 6) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }
    setCode(nextCode);
    setBusy(true);
    setError(null);
    try {
      if (signup) {
        await authService.verifyEmailCode(email, nextCode);
        navigation.navigate("Register", {
          verifiedEmail: email,
          name: route.params.name,
        });
        return;
      }
      await authService.verifyOtp(nextCode);
      navigation.navigate("ResetPassword", { email });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The verification code is incorrect or expired.";
      setError(message);
      // Keep the known code filled so the user can retry after rate-limit cool-down.
      if (!/too many requests/i.test(message)) {
        setCode("");
        inputRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

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
            Enter the 6-digit code for{"\n"}
            <Text style={styles.email}>{email}</Text>
          </Text>
        </View>

        <View style={styles.devCard}>
          <Icon name="key-outline" size={20} />
          <View style={{ flex: 1 }}>
            <Text style={styles.devTitle}>Use this code</Text>
            <Text style={styles.devCopy}>
              Email delivery may be limited. Your code is{" "}
              <Text style={styles.devCode}>{shownOtp}</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setCode(shownOtp);
              inputRef.current?.focus();
            }}
            style={styles.fillBtn}
          >
            <Text style={styles.fillText}>Fill</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpWrap}>
          <View style={styles.otpRow} pointerEvents="none">
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={[styles.otp, code[index] ? styles.otpFilled : null]}>
                <Text style={styles.otpText}>{code[index] ?? ""}</Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(value) => {
              setError(null);
              setCode(value.replace(/\D/g, "").slice(0, 6));
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            importantForAutofill="yes"
            maxLength={6}
            caretHidden
            showSoftInputOnFocus
            autoFocus
            style={styles.otpInput}
          />
        </Pressable>

        <Text style={styles.hintPad}>Tap the boxes — emulator number pad opens for entry.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.resend}>
          Didn't receive a code?{" "}
          {seconds > 0 ? (
            <Text style={styles.link}>Resend in 00:{String(seconds).padStart(2, "0")}</Text>
          ) : (
            <Text style={styles.link} onPress={() => void resend()}>
              {busy ? "Sending…" : "Resend"}
            </Text>
          )}
        </Text>

        <View style={styles.inbox}>
          <Icon name="paper-plane-outline" size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.inboxTitle}>Check inbox or use the code above</Text>
            <Text style={styles.inboxCopy}>OTP expires in 10 minutes for your security.</Text>
          </View>
        </View>

        <AppButton
          label={busy ? "Verifying…" : "Verify OTP"}
          onPress={() => {
            if (busy) return;
            void verify();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, gap: 16 },
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
  devCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 16,
    padding: 14,
  },
  devTitle: { color: colors.white, fontWeight: "800" },
  devCopy: { color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 },
  devCode: { color: colors.gold, fontWeight: "900", letterSpacing: 1 },
  fillBtn: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fillText: { color: colors.green, fontWeight: "800", fontSize: 13 },
  otpWrap: { position: "relative", minHeight: 58 },
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
  otpInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    backgroundColor: "transparent",
    fontSize: 1,
    letterSpacing: 40,
    opacity: 0.02,
    zIndex: 2,
  },
  hintPad: { color: colors.muted, fontSize: 12, textAlign: "center" },
  error: { color: colors.red, textAlign: "center", fontWeight: "700" },
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
