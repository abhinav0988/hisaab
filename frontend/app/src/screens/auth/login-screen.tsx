import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";
import { useSession } from "../../providers/session-provider";
import { authService } from "../../services/auth.service";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Icon } from "../../components/ui/icon";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hidden, setHidden] = useState(true);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.lang}>
          <Icon name="globe-outline" size={16} color={colors.lightMuted} />
          <Text style={styles.langText}>English</Text>
          <Icon name="chevron-down" size={14} color={colors.lightMuted} />
        </View>
        <Text style={styles.h1}>Welcome Back 👋</Text>
        <Text style={styles.subtitle}>Login to continue to Hisaab</Text>
        <Image
          source={require("../../../assets/login-hero.png")}
          style={styles.hero}
          resizeMode="contain"
        />
        <Field
          variant="light"
          label="Email Address"
          placeholder="john.doe@example.com"
          leftIcon="mail-outline"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={styles.passwordHead}>
          <Text style={styles.passwordLabel}>Password</Text>
          <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.link}>Forgot Password?</Text>
          </Pressable>
        </View>
        <Field
          variant="light"
          placeholder="••••••••"
          leftIcon="lock-closed-outline"
          secure={hidden}
          value={password}
          onChangeText={setPassword}
          right={
            <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8}>
              <Icon name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={colors.lightMuted} />
            </Pressable>
          }
        />
        <AppButton
          tone="forest"
          label="Login"
          onPress={async () => {
            await authService.signIn({ email, password });
            signIn();
          }}
        />
        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.or}>or continue with</Text>
          <View style={styles.rule} />
        </View>
        <View style={styles.security}>
          <Icon name="shield-checkmark" size={28} color={colors.forest} />
          <View style={{ flex: 1 }}>
            <Text style={styles.secureTitle}>Secure & Private</Text>
            <Text style={styles.secureCopy}>Your data is 100% safe with us.</Text>
          </View>
        </View>
        <Text style={styles.footer}>
          Don't have an account?{" "}
          <Text style={styles.link} onPress={() => navigation.navigate("Register")}>
            Sign Up
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.lightBg },
  page: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28, gap: 14 },
  lang: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.lightLine,
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  langText: { color: colors.lightInk, fontWeight: "600", fontSize: 13 },
  h1: {
    color: colors.lightInk,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: { color: colors.lightMuted, fontSize: 15, marginTop: -6 },
  hero: { width: "100%", height: 180, alignSelf: "center" },
  passwordHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: -6,
  },
  passwordLabel: { color: colors.lightInk, fontWeight: "700", fontSize: 14 },
  link: { color: colors.forest, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lightLine },
  or: { color: colors.lightMuted, fontSize: 13 },
  security: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.lightSecure,
    borderRadius: 18,
    padding: 16,
  },
  secureTitle: { color: colors.lightInk, fontWeight: "800", fontSize: 15 },
  secureCopy: { color: colors.lightMuted, fontSize: 13, marginTop: 2 },
  footer: { color: colors.lightMuted, textAlign: "center", marginTop: 6 },
});
