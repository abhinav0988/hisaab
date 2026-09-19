import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { demoTransactions } from "../../data/fixtures";
import { IconBox } from "../ui/icon-box";

export function TransactionList({
  limit = 5,
  section,
}: {
  limit?: number;
  section?: "today" | "earlier";
}) {
  const rows = demoTransactions
    .filter((row) => (section ? row.section === section : true))
    .slice(0, limit);

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.id} style={styles.txn}>
          <IconBox name={row.icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{row.name}</Text>
            <Text style={styles.small}>{row.subtitle}</Text>
          </View>
          <Text style={{ color: row.color, fontWeight: "800" }}>{row.amount}</Text>
        </View>
      ))}
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
  txn: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  title: { color: colors.white, fontSize: 14, fontWeight: "800" },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
