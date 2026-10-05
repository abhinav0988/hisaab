import type { Transaction } from "@hisaab/types";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { money, signedMoney } from "../../lib/format";
import { IconBox } from "../ui/icon-box";
import { EmptyBlock } from "../ui/states";
import type { IconName } from "../../config/finance-tools";

function iconFor(txn: Transaction): IconName {
  const key = `${txn.categoryName ?? ""} ${txn.merchant ?? ""}`.toLowerCase();
  if (txn.type === "INCOME") return "arrow-down-outline";
  if (key.includes("food") || key.includes("swiggy") || key.includes("zomato")) return "fast-food-outline";
  if (key.includes("shop") || key.includes("amazon")) return "cart-outline";
  if (key.includes("fuel") || key.includes("uber")) return "car-outline";
  if (txn.type === "TRANSFER") return "swap-horizontal-outline";
  return "receipt-outline";
}

export function TransactionList({
  items,
  limit,
  currency = "INR",
}: {
  items: Transaction[];
  limit?: number;
  currency?: string;
}) {
  const rows = typeof limit === "number" ? items.slice(0, limit) : items;
  if (!rows.length) {
    return <EmptyBlock title="No transactions yet" body="Add income or expenses to see them here." />;
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <View key={row.id} style={styles.txn}>
          <IconBox name={iconFor(row)} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{row.merchant || row.categoryName || "Transaction"}</Text>
            <Text style={styles.small}>
              {row.accountName ?? "Account"}
              {row.categoryName ? ` · ${row.categoryName}` : ""}
            </Text>
          </View>
          <Text
            style={{
              color: row.type === "INCOME" ? colors.green : row.type === "EXPENSE" ? colors.red : colors.gold,
              fontWeight: "800",
            }}
          >
            {signedMoney(row.amountMinor, currency || row.currency, row.type)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function formatTxnAmount(amountMinor: number, currency: string) {
  return money(amountMinor, currency);
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.16)",
    backgroundColor: "#07251E",
    overflow: "hidden",
  },
  txn: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(85,231,160,0.12)",
  },
  title: { color: colors.white, fontSize: 14, fontWeight: "800" },
  small: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
});
