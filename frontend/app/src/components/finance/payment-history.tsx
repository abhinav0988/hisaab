import { StyleSheet, Text, View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import { Card } from "../ui/card";
import { friendlyError } from "../../lib/api-errors";

export type HistoryRow = { id: string; paidAt: string; createdAt: string; title: string; detail: string; amount: string };

export function PaymentHistory({ query, rows, empty }: { query: UseQueryResult<unknown>; rows: HistoryRow[]; empty: string }) {
  const sorted = [...rows].sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Payment history</Text>
      {query.isLoading ? <Text style={styles.sub}>Loading history…</Text> : null}
      {query.isError ? <Text style={styles.error}>{friendlyError(query.error, "Could not load payment history.")}</Text> : null}
      {query.isSuccess && !sorted.length ? <Text style={styles.sub}>{empty}</Text> : null}
      {sorted.map((row) => (
        <Card key={row.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{row.title}</Text>
            <Text style={styles.sub}>{row.detail}</Text>
          </View>
          <Text style={styles.amount}>{row.amount}</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 6 },
  row: { flexDirection: "row", gap: 10, padding: 14, alignItems: "center" },
  name: { color: colors.white, fontWeight: "800" },
  amount: { color: colors.white, fontWeight: "900", fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.red, fontSize: 12, lineHeight: 18 },
});
