import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { Icon } from "./icon";

/**
 * Back control. Prefer `pinTop` above a ScrollView (inside SafeAreaView) so it
 * never scrolls away under content.
 */
export function BackLink({
  onPress,
  label = "Back",
  pinTop = false,
}: {
  onPress: () => void;
  label?: string;
  /** Keep Back fixed above scrolling content (parent should provide safe area). */
  pinTop?: boolean;
}) {
  return (
    <View style={[styles.wrap, pinTop && styles.pinned]}>
      <Pressable
        onPress={onPress}
        style={styles.back}
        hitSlop={{ top: 16, bottom: 16, left: 12, right: 24 }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name="arrow-back" size={22} color={colors.green} />
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  pinned: {
    backgroundColor: colors.bg,
    paddingHorizontal: 18,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    zIndex: 2,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 2,
    minHeight: 48,
    minWidth: 88,
  },
  label: { color: colors.green, fontWeight: "700", fontSize: 15 },
});
