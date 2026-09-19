import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import type { IconName } from "../../config/finance-tools";
import { Icon } from "./icon";
import { IconBox } from "./icon-box";
import { SectionTitle } from "./section-title";

export type MenuItem = {
  name: string;
  icon: IconName;
  value?: string;
};

export function MenuGroup({
  title,
  items,
  onPress,
}: {
  title: string;
  items: MenuItem[];
  onPress?: (name: string) => void;
}) {
  return (
    <View>
      <SectionTitle title={title} />
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable key={item.name} onPress={() => onPress?.(item.name)} style={styles.row}>
            <IconBox name={item.icon} />
            <Text style={styles.title}>{item.name}</Text>
            {item.value ? <Text style={styles.value}>{item.value}</Text> : null}
            <Icon name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { color: colors.white, fontSize: 14, fontWeight: "800", flex: 1 },
  value: { fontSize: 12, color: colors.muted },
});
