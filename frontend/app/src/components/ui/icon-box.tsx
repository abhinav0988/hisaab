import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../theme/tokens";
import { Icon } from "./icon";
import type { IconName } from "../../config/finance-tools";

export function IconBox({ name, size = 21 }: { name: IconName; size?: number }) {
  return (
    <View style={styles.box}>
      <Icon name={name} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
