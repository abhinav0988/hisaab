import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme/tokens";
import { Icon } from "./icon";

export function BackLink({ onPress, label = "Back" }: { onPress: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.back}>
      <Icon name="arrow-back" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  label: { color: colors.green, fontWeight: "700" },
});
