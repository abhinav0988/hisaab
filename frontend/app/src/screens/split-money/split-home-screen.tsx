import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { Header } from "../../components/ui/header";
import { Card } from "../../components/ui/card";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { Icon } from "../../components/ui/icon";
import { money } from "../../lib/format";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { splitKeys } from "../../features/split-money/api/splitMoneyQueries";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Split">, NativeStackScreenProps<AppStackParamList>>;

export function SplitMoneyHomeScreen({ navigation }: Props) {
  const dashboard = useQuery({ queryKey: splitKeys.dashboard, queryFn: splitMoneyApi.dashboard });
  const data = dashboard.data;
  if (dashboard.isLoading) return <View style={styles.fill}><LoadingBlock label="Loading shared money…" /></View>;
  if (dashboard.isError || !data) return <View style={styles.fill}><ErrorBlock message="Could not load Split Money." onRetry={() => void dashboard.refetch()} /></View>;
  const { summary } = data;
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={dashboard.isFetching} onRefresh={() => void dashboard.refetch()} tintColor={colors.green} />}>
        <Header title="Split Money" subtitle="Shared expenses, settled clearly" />
        <View style={styles.actions}>
          <Action icon="add-circle-outline" label="Split expense" onPress={() => navigation.navigate("SplitCreate")} />
          <Action icon="people-outline" label="People" onPress={() => navigation.navigate("SplitPeople")} />
          <Action icon="albums-outline" label="Groups" onPress={() => navigation.navigate("SplitGroups")} />
          <Action icon="time-outline" label="History" onPress={() => navigation.navigate("SplitHistory")} />
        </View>
        <Card style={styles.hero}>
          <Text style={styles.kicker}>TOTAL SHARED EXPENSES</Text>
          <Text style={styles.total}>{money(summary.totalSharedMinor)}</Text>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, summary.settledPercent))}%` }]} /></View>
          <Text style={styles.muted}>{summary.settledPercent}% settled · {summary.pendingSettlements} pending settlements</Text>
        </Card>
        <View style={styles.metricRow}>
          <Metric label="YOU ARE OWED" value={money(summary.moneyToReceiveMinor)} color={colors.green} />
          <Metric label="YOU OWE" value={money(summary.moneyToPayMinor)} color={colors.orange} />
        </View>
        <Text style={styles.heading}>Recent splits</Text>
        {data.recentExpenses.length === 0 ? <EmptyBlock title="No shared expenses yet" body="Create an expense to start splitting." /> : data.recentExpenses.map((expense) => (
          <Pressable key={expense.id} onPress={() => navigation.navigate("SplitExpense", { id: expense.id })}>
            <Card style={styles.expense}><View style={styles.expenseIcon}><Icon name="receipt-outline" /></View><View style={styles.flex}><Text style={styles.name}>{expense.title}</Text><Text style={styles.muted}>{expense.group?.name ?? expense.category} · {expense.status.replaceAll("_", " ")}</Text></View><Text style={styles.amount}>{money(expense.totalAmountMinor, expense.currency)}</Text></Card>
          </Pressable>
        ))}
        <Text style={styles.heading}>Upcoming settlements</Text>
        {data.upcomingSettlements.length === 0 ? <Text style={styles.muted}>Nothing is due soon.</Text> : data.upcomingSettlements.map((item) => <Card key={item.expenseId} style={styles.upcoming}><Text style={styles.name}>{item.title}</Text><Text style={styles.muted}>Due {item.dueDate ?? "—"} · {money(item.pendingMinor)} pending</Text></Card>)}
      </ScrollView>
    </View>
  );
}
function Action({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) { return <Pressable style={styles.action} onPress={onPress}><Icon name={icon} size={23} /><Text style={styles.actionText}>{label}</Text></Pressable>; }
function Metric({ label, value, color }: { label: string; value: string; color: string }) { return <Card style={styles.metric}><Text style={styles.kicker}>{label}</Text><Text style={[styles.metricValue, { color }]}>{value}</Text></Card>; }
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg }, page: { padding: 18, paddingBottom: 28, gap: 14 }, actions: { flexDirection: "row", gap: 8 }, action: { flex: 1, minHeight: 74, backgroundColor: colors.panel2, borderWidth: 1, borderColor: colors.line, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 5 }, actionText: { color: colors.white, fontSize: 10, fontWeight: "700", textAlign: "center" }, hero: { gap: 9, backgroundColor: colors.panel2 }, kicker: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: .7 }, total: { color: colors.white, fontSize: 30, fontWeight: "900" }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 }, progress: { height: 8, borderRadius: 8, backgroundColor: colors.input, overflow: "hidden" }, progressFill: { height: "100%", borderRadius: 8, backgroundColor: colors.green }, metricRow: { flexDirection: "row", gap: 10 }, metric: { flex: 1, gap: 7, padding: 14 }, metricValue: { fontSize: 17, fontWeight: "900" }, heading: { color: colors.white, fontWeight: "900", fontSize: 17, marginTop: 4 }, expense: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }, expenseIcon: { height: 38, width: 38, borderRadius: 19, backgroundColor: colors.input, alignItems: "center", justifyContent: "center" }, flex: { flex: 1 }, name: { color: colors.white, fontWeight: "800" }, amount: { color: colors.white, fontWeight: "900", fontSize: 13 }, upcoming: { padding: 14, gap: 5 } });
