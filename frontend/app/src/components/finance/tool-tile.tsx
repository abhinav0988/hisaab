import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../../theme/tokens";
import type { FinanceTool } from "../../config/finance-tools";
import { Icon } from "../ui/icon";
import { IconBox } from "../ui/icon-box";

export function ToolTile({
  tool,
  wide,
  onPress,
}: {
  tool: FinanceTool;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tool, wide && styles.wide]}>
      <IconBox name={tool.icon} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{tool.title}</Text>
          {tool.pro ? <Text style={styles.pro}>PRO</Text> : null}
        </View>
        <Text style={styles.small}>{tool.subtitle}</Text>
      </View>
      <Icon name="chevron-forward" size={17} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tool: {
    width: "48.8%",
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  wide: { width: "100%", minHeight: 70 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.white, fontSize: 14, fontWeight: "800" },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  pro: {
    fontSize: 10,
    color: colors.goldInk,
    fontWeight: "900",
    backgroundColor: colors.gold,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
});
