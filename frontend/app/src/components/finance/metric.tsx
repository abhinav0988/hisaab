import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../theme/tokens";

export function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={{ color, fontWeight: "700" }}>▲ 12.4%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    minHeight: 90,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  value: { fontSize: 16, color: colors.white, fontWeight: "800", marginVertical: 7 },
});
