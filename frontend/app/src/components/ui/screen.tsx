import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/tokens";
import { BackLink } from "./back-link";

export function Screen({
  children,
  scroll = true,
  onBack,
  backLabel = "Back",
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** When set, Back stays pinned above scrolling content. */
  onBack?: () => void;
  backLabel?: string;
  padded?: boolean;
}) {
  const body = scroll ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.page, !padded && styles.noPad]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ) : (
    <View style={[styles.flex, padded && styles.pagePad]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {onBack ? <BackLink onPress={onBack} label={backLabel} pinTop /> : null}
      {body}
    </SafeAreaView>
  );
}

export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.auth}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BrandMark({ letter = "H" }: { letter?: string }) {
  return (
    <View style={styles.mark}>
      <Text style={styles.markText}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  page: { padding: 18, paddingBottom: 48, gap: 14 },
  pagePad: { padding: 18, gap: 14 },
  noPad: { padding: 0, paddingBottom: 48 },
  auth: {
    padding: 24,
    paddingTop: 48,
    gap: 16,
    minHeight: "100%",
    justifyContent: "center",
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  markText: { color: colors.green, fontSize: 30, fontWeight: "900" },
});
