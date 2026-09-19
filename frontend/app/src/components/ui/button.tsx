import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "../../theme/tokens";
import { Icon } from "./icon";
import type { IconName } from "../../config/finance-tools";

export function AppButton({
  label,
  onPress,
  outline = false,
  tone = "neon",
  icon = "arrow-forward",
  leftIcon,
}: {
  label: string;
  onPress: () => void;
  outline?: boolean;
  tone?: "neon" | "forest";
  icon?: IconName;
  leftIcon?: IconName;
}) {
  const forest = tone === "forest" && !outline;
  const iconColor = outline ? colors.green : forest ? colors.white : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, outline && styles.outline, forest && styles.forest]}
    >
      {leftIcon ? <Icon name={leftIcon} color={iconColor} /> : null}
      <Text style={[styles.text, outline && { color: colors.green }, forest && styles.forestText]}>
        {label}
      </Text>
      <Icon name={icon} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radius.md + 1,
    paddingHorizontal: 20,
    backgroundColor: colors.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  forest: {
    backgroundColor: colors.forest,
    borderRadius: 18,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.green,
  },
  text: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
  },
  forestText: {
    color: colors.white,
    fontWeight: "800",
  },
});
