import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../../theme/tokens";
import { Icon } from "./icon";

export function AuthTopBar({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.circle} hitSlop={8}>
          <Icon name="chevron-back" size={20} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.circle}>
        <Icon name="moon-outline" size={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: 42, height: 42 },
});
