import { StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../../theme/tokens";

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 12,
  },
  title: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
