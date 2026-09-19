import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  title: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  action: { color: colors.green, fontWeight: "700" },
});
