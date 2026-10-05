import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { toolById } from "../../config/finance-tools";
import { Metric } from "../../components/finance/metric";
import { TransactionList } from "../../components/finance/transaction-list";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money } from "../../lib/format";
import { ApiError } from "../../services/api-client";
import { accountService } from "../../services/account.service";
import { budgetService } from "../../services/budget.service";
import { dashboardService } from "../../services/dashboard.service";
import { financeService } from "../../services/finance.service";
import { goalService } from "../../services/goal.service";
import { profileService } from "../../services/profile.service";
import { recurringService } from "../../services/recurring.service";
import { FeatureCreateForm } from "./feature-create";

type Props = NativeStackScreenProps<AppStackParamList, "Feature">;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function FeatureScreen({ navigation, route }: Props) {
  const tool = toolById(route.params.toolId);
  const toolId = route.params.toolId;
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.summary() });
  const banks = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => accountService.listBanks(),
    enabled: toolId === "accounts" || toolId === "bank",
  });
  const budgets = useQuery({
    queryKey: ["budgets", currentMonth()],
    queryFn: () => budgetService.list(currentMonth()),
    enabled: toolId === "budgets",
  });
  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => goalService.list(),
    enabled: toolId === "goals",
  });
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: () => financeService.listInvestments(),
    enabled: toolId === "investments",
  });
  const ipos = useQuery({
    queryKey: ["ipos"],
    queryFn: () => financeService.listIpos(),
    enabled: toolId === "ipo",
  });
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => financeService.listLoans(),
    enabled: toolId === "loans",
  });
  const cards = useQuery({
    queryKey: ["credit-cards"],
    queryFn: () => financeService.listCreditFacilities("CARD"),
    enabled: toolId === "cards",
  });
  const upi = useQuery({
    queryKey: ["upi-credit"],
    queryFn: () => financeService.listCreditFacilities("UPI"),
    enabled: toolId === "upi",
  });
  const lend = useQuery({
    queryKey: ["lend"],
    queryFn: () => financeService.listLendRecords(),
    enabled: toolId === "lend",
  });
  const bills = useQuery({
    queryKey: ["recurring"],
    queryFn: () =>
      recurringService.list<{
        id: string;
        merchant?: string | null;
        notes?: string | null;
        amountMinor: number;
        frequency?: string;
        nextRunAt?: string;
      }>(),
    enabled: toolId === "bills",
  });

  const deleteIpo = useMutation({
    mutationFn: (id: string) => financeService.deleteIpo(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ipos"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => {
      Alert.alert(
        "Could not delete",
        error instanceof ApiError || error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  function confirmDeleteIpo(id: string, name: string) {
    Alert.alert("Delete IPO", `Remove “${name}” from your IPO tracker?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteIpo.mutate(id),
      },
    ]);
  }

  const currency = profile.data?.defaultCurrency ?? "INR";
  const loading =
    profile.isLoading ||
    dashboard.isLoading ||
    banks.isLoading ||
    budgets.isLoading ||
    goals.isLoading ||
    investments.isLoading ||
    ipos.isLoading ||
    loans.isLoading ||
    cards.isLoading ||
    upi.isLoading ||
    lend.isLoading ||
    bills.isLoading;

  const metrics = (() => {
    switch (toolId) {
      case "accounts":
      case "bank":
        return [
          {
            label: "Banks",
            value: String(banks.data?.length ?? 0),
            color: colors.green,
          },
          {
            label: "Balance",
            value: money(
              (banks.data ?? []).reduce((sum, item) => sum + item.currentBalanceMinor, 0),
              currency,
            ),
            color: colors.gold,
          },
          {
            label: "Income",
            value: money(dashboard.data?.incomeThisMonth ?? 0, currency),
            color: colors.green,
          },
        ];
      case "budgets":
        return [
          {
            label: "Budgets",
            value: String(budgets.data?.length ?? 0),
            color: colors.gold,
          },
          {
            label: "Spent",
            value: money(dashboard.data?.spentThisMonth ?? 0, currency),
            color: colors.red,
          },
          {
            label: "Left",
            value: money(dashboard.data?.budgetRemaining ?? 0, currency),
            color: colors.green,
          },
        ];
      case "goals":
        return [
          { label: "Goals", value: String(goals.data?.length ?? 0), color: colors.green },
          {
            label: "Saved",
            value: money(
              (goals.data ?? []).reduce((sum, item) => sum + item.savedAmountMinor, 0),
              currency,
            ),
            color: colors.gold,
          },
          {
            label: "Target",
            value: money(
              (goals.data ?? []).reduce((sum, item) => sum + item.targetAmountMinor, 0),
              currency,
            ),
            color: colors.muted,
          },
        ];
      case "investments":
        return [
          {
            label: "Holdings",
            value: String(investments.data?.length ?? 0),
            color: colors.green,
          },
          {
            label: "Value",
            value: money(
              (investments.data ?? []).reduce((sum, item) => sum + item.currentMinor, 0),
              currency,
            ),
            color: colors.gold,
          },
          {
            label: "Invested",
            value: money(
              (investments.data ?? []).reduce((sum, item) => sum + item.investedMinor, 0),
              currency,
            ),
            color: colors.muted,
          },
        ];
      case "ipo":
        return [
          { label: "Applied", value: String(ipos.data?.length ?? 0), color: colors.green },
          {
            label: "Amount",
            value: money(
              (ipos.data ?? []).reduce((sum, item) => sum + (item.amountMinor ?? 0), 0),
              currency,
            ),
            color: colors.gold,
          },
          { label: "Status", value: "Live", color: colors.muted },
        ];
      case "loans":
        return [
          { label: "Loans", value: String(loans.data?.length ?? 0), color: colors.orange },
          {
            label: "EMI",
            value: money(
              (loans.data ?? []).reduce((sum, item) => sum + (item.emiMinor ?? 0), 0),
              currency,
            ),
            color: colors.red,
          },
          {
            label: "Outstanding",
            value: money(
              (loans.data ?? []).reduce((sum, item) => sum + (item.outstandingMinor ?? 0), 0),
              currency,
            ),
            color: colors.gold,
          },
        ];
      case "cards":
        return [
          { label: "Cards", value: String(cards.data?.length ?? 0), color: colors.purple },
          {
            label: "Used",
            value: money(
              (cards.data ?? []).reduce((sum, item) => sum + (item.usedMinor ?? 0), 0),
              currency,
            ),
            color: colors.red,
          },
          {
            label: "Limit",
            value: money(
              (cards.data ?? []).reduce((sum, item) => sum + (item.limitMinor ?? 0), 0),
              currency,
            ),
            color: colors.gold,
          },
        ];
      case "upi":
        return [
          { label: "Lines", value: String(upi.data?.length ?? 0), color: colors.teal },
          {
            label: "Used",
            value: money(
              (upi.data ?? []).reduce((sum, item) => sum + (item.usedMinor ?? 0), 0),
              currency,
            ),
            color: colors.red,
          },
          {
            label: "Limit",
            value: money(
              (upi.data ?? []).reduce((sum, item) => sum + (item.limitMinor ?? 0), 0),
              currency,
            ),
            color: colors.green,
          },
        ];
      case "lend":
        return [
          { label: "Records", value: String(lend.data?.length ?? 0), color: colors.gold },
          {
            label: "Open",
            value: money(
              (lend.data ?? [])
                .filter((item) => item.status !== "settled")
                .reduce((sum, item) => sum + item.amountMinor, 0),
              currency,
            ),
            color: colors.orange,
          },
          {
            label: "Total",
            value: money(
              (lend.data ?? []).reduce((sum, item) => sum + item.amountMinor, 0),
              currency,
            ),
            color: colors.muted,
          },
        ];
      case "bills":
        return [
          { label: "Reminders", value: String(bills.data?.length ?? 0), color: colors.purple },
          {
            label: "Next out",
            value: money(
              (bills.data ?? []).slice(0, 1).reduce((sum, item) => sum + item.amountMinor, 0),
              currency,
            ),
            color: colors.orange,
          },
          {
            label: "Spent",
            value: money(dashboard.data?.spentThisMonth ?? 0, currency),
            color: colors.red,
          },
        ];
      default:
        return [
          {
            label: "Income",
            value: money(dashboard.data?.incomeThisMonth ?? 0, currency),
            color: colors.green,
          },
          {
            label: "Spent",
            value: money(dashboard.data?.spentThisMonth ?? 0, currency),
            color: colors.red,
          },
          {
            label: "Saved",
            value: money(dashboard.data?.netSavings ?? 0, currency),
            color: colors.gold,
          },
        ];
    }
  })();

  const listRows = (() => {
    if (toolId === "accounts" || toolId === "bank") {
      return (banks.data ?? []).map((item) => ({
        id: item.id,
        title: item.institutionName || item.name,
        subtitle: item.name,
        value: money(item.currentBalanceMinor, currency),
      }));
    }
    if (toolId === "budgets") {
      return (budgets.data ?? []).map((item) => ({
        id: item.id,
        title: item.categoryName ?? "Overall budget",
        subtitle: item.month,
        value: money(item.remainingMinor, currency),
      }));
    }
    if (toolId === "goals") {
      return (goals.data ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${money(item.savedAmountMinor, currency)} of ${money(item.targetAmountMinor, currency)}`,
        value: `${Math.min(100, Math.round((item.savedAmountMinor / Math.max(item.targetAmountMinor, 1)) * 100))}%`,
      }));
    }
    if (toolId === "investments") {
      return (investments.data ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.type,
        value: money(item.currentMinor, currency),
      }));
    }
    if (toolId === "ipo") {
      return (ipos.data ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.status,
        value: money(item.amountMinor, currency),
      }));
    }
    if (toolId === "loans") {
      return (loans.data ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `EMI ${money(item.emiMinor, currency)}`,
        value: money(item.outstandingMinor, currency),
      }));
    }
    if (toolId === "cards" || toolId === "upi") {
      const rows = toolId === "cards" ? cards.data : upi.data;
      return (rows ?? []).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `Used ${money(item.usedMinor, currency)}`,
        value: money(item.limitMinor, currency),
      }));
    }
    if (toolId === "lend") {
      return (lend.data ?? []).map((item) => ({
        id: item.id,
        title: item.person,
        subtitle: item.status,
        value: money(item.amountMinor, currency),
      }));
    }
    if (toolId === "bills") {
      return (bills.data ?? []).map((item) => ({
        id: item.id,
        title: item.merchant ?? item.notes ?? "Reminder",
        subtitle: item.frequency ?? "Recurring",
        value: money(item.amountMinor, currency),
      }));
    }
    return [];
  })();

  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Icon name={tool?.icon ?? "wallet-outline"} size={44} />
        </View>
        <Text style={styles.h1}>{tool?.title ?? "Finance tool"}</Text>
        <Text style={styles.subtitle}>{tool?.subtitle ?? "Live data from your Hisaab account"}</Text>
      </View>
      {loading ? <LoadingBlock /> : null}
      {!loading && dashboard.isError ? (
        <ErrorBlock message="Could not load this tool." onRetry={() => void dashboard.refetch()} />
      ) : null}
      {!loading ? (
        <>
          <View style={styles.grid3}>
            {metrics.map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} color={item.color} />
            ))}
          </View>
          <FeatureCreateForm toolId={toolId} currency={currency} />
          {listRows.length ? (
            <Card style={{ gap: 0, padding: 0, overflow: "hidden" }}>
              {listRows.map((row, index) => (
                <View
                  key={row.id}
                  style={[styles.row, index < listRows.length - 1 && styles.rowBorder]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{row.title}</Text>
                    <Text style={styles.rowSub}>{row.subtitle}</Text>
                  </View>
                  <Text style={styles.rowValue}>{row.value}</Text>
                  {toolId === "ipo" ? (
                    <Pressable
                      onPress={() => confirmDeleteIpo(row.id, row.title)}
                      style={styles.deleteBtn}
                      hitSlop={8}
                      disabled={deleteIpo.isPending}
                    >
                      <Icon name="trash-outline" size={18} color={colors.red} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={styles.empty}>No records yet — use the form above to add the first one.</Text>
            </Card>
          )}
          <SectionTitle title="Recent activity" />
          <TransactionList
            items={dashboard.data?.recentTransactions ?? []}
            limit={4}
            currency={currency}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 10, paddingVertical: 20 },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  grid3: { flexDirection: "row", gap: 8 },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { color: colors.white, fontWeight: "800" },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowValue: { color: colors.green, fontWeight: "800" },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,103,95,0.12)",
  },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
