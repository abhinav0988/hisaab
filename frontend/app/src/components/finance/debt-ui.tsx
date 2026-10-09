import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { Card } from "../ui/card";

/** Presentation-only primitives shared by debt and credit surfaces. */
export function DebtStatus({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("overdue") || normalized.includes("cancel") ? styles.danger : normalized.includes("partial") || normalized.includes("due") || normalized.includes("pending") ? styles.warning : styles.good;
  return <Text style={[styles.status, tone]}>{value.replaceAll("_", " ")}</Text>;
}

export function BalanceSummary({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <Card style={styles.summary}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}</Card>;
}

export function DueDateBadge({ dueOn }: { dueOn: string | null | undefined }) {
  return <View style={styles.due}><Text style={styles.detail}>Due {dueOn ?? "not set"}</Text></View>;
}

const styles = StyleSheet.create({
  status: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginTop: 4 },
  good: { color: colors.green }, warning: { color: colors.orange }, danger: { color: colors.red },
  summary: { gap: 7, backgroundColor: colors.panel2 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  value: { color: colors.white, fontSize: 30, fontWeight: "900" },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  due: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.input },
});
