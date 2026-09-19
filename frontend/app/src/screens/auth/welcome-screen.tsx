import { useEffect, useRef, useState } from "react";
import { Image, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

const LOAD_MS = 2800;

export function WelcomeScreen({ navigation }: Props) {
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const start = Date.now();
    let frame = 0;

    const tick = () => {
      const next = Math.min(100, Math.round(((Date.now() - start) / LOAD_MS) * 100));
      setProgress(next);
      if (next < 100) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (done.current) return;
      done.current = true;
      navigation.replace("Login");
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Image
        source={require("../../../assets/splash-screen.png")}
        style={styles.art}
        resizeMode="cover"
      />
      <SafeAreaView style={styles.overlay} edges={["bottom"]}>
        <View style={styles.loader}>
          <View style={styles.row}>
            <Text style={styles.label}>Loading</Text>
            <Text style={styles.percent}>{progress}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  art: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  overlay: { flex: 1, justifyContent: "flex-end" },
  loader: { paddingHorizontal: 28, paddingBottom: 28, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { color: colors.muted, fontWeight: "700", letterSpacing: 1.2, fontSize: 12 },
  percent: { color: colors.green, fontWeight: "900", fontSize: 18 },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.green,
  },
});
