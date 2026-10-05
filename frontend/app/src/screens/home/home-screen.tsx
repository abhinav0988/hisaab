import { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { SparkLine } from "../../components/charts/spark-line";
import { TransactionList } from "../../components/finance/transaction-list";
import { Icon } from "../../components/ui/icon";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import type { IconName } from "../../config/finance-tools";
import { initials, money } from "../../lib/format";
import { accountService } from "../../services/account.service";
import { dashboardService } from "../../services/dashboard.service";
import { financeService } from "../../services/finance.service";
import { profileService } from "../../services/profile.service";
import { recurringService } from "../../services/recurring.service";
import { useSession } from "../../providers/session-provider";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<AppStackParamList>
>;

type RecurringRow = {
  id: string;
  merchant?: string | null;
  amountMinor: number;
  nextRunAt?: string;
  isActive?: boolean;
};

const quickActions: { title: string; icon: IconName; toolId?: string; add?: boolean }[] = [
  { title: "Add Money", icon: "wallet-outline", add: true },
  { title: "Send Money", icon: "swap-horizontal-outline", add: true },
  { title: "Budgets", icon: "speedometer-outline", toolId: "budgets" },
  { title: "My Cards", icon: "card-outline", toolId: "cards" },
];

function greetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function BankMark() {
  return (
    <Svg width={92} height={92} viewBox="0 0 92 92">
      <Defs>
        <LinearGradient id="bankGlow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#55E7A0" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#16B96F" stopOpacity="0.05" />
        </LinearGradient>
      </Defs>
      <Circle cx="46" cy="46" r="42" fill="url(#bankGlow)" />
      <Circle cx="46" cy="46" r="34" fill="rgba(2,22,18,0.35)" stroke="#55E7A0" strokeWidth="1.2" />
      <Path
        d="M24 40 L46 26 L68 40 V44 H24 Z"
        fill="#55E7A0"
        opacity="0.95"
      />
      <Rect x="28" y="46" width="7" height="18" rx="1.5" fill="#55E7A0" opacity="0.85" />
      <Rect x="42.5" y="46" width="7" height="18" rx="1.5" fill="#55E7A0" opacity="0.85" />
      <Rect x="57" y="46" width="7" height="18" rx="1.5" fill="#55E7A0" opacity="0.85" />
      <Rect x="24" y="66" width="44" height="6" rx="2" fill="#55E7A0" />
    </Svg>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [hidden, setHidden] = useState(false);
  const nowMs = useMemo(() => Date.now(), []);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.summary() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: () => financeService.listInvestments(),
  });
  const loans = useQuery({ queryKey: ["loans"], queryFn: () => financeService.listLoans() });
  const cards = useQuery({
    queryKey: ["credit-cards"],
    queryFn: () => financeService.listCreditFacilities("CARD"),
  });
  const recurring = useQuery({
    queryKey: ["recurring"],
    queryFn: () => recurringService.list<RecurringRow>(),
  });

  const loading = profile.isLoading || dashboard.isLoading;
  const refreshing = profile.isFetching || dashboard.isFetching || accounts.isFetching;
  const currency = profile.data?.defaultCurrency ?? dashboard.data?.currency ?? "INR";
  const summary = dashboard.data;
  const displayName = profile.data?.name ?? user?.name ?? "there";
  const avatar = initials(displayName);

  const totalBalance = useMemo(
    () => (accounts.data ?? []).reduce((sum, item) => sum + (item.currentBalanceMinor ?? 0), 0),
    [accounts.data],
  );
  const investmentValue = useMemo(
    () => (investments.data ?? []).reduce((sum, item) => sum + item.currentMinor, 0),
    [investments.data],
  );
  const loanOutstanding = useMemo(
    () => (loans.data ?? []).reduce((sum, item) => sum + item.outstandingMinor, 0),
    [loans.data],
  );
  const cardUsed = useMemo(
    () => (cards.data ?? []).reduce((sum, item) => sum + item.usedMinor, 0),
    [cards.data],
  );
  const netWorth = totalBalance + investmentValue - loanOutstanding - cardUsed;

  const lastMonth = summary?.monthlyComparison.at(-2);
  const incomeDelta = pctChange(summary?.incomeThisMonth ?? 0, lastMonth?.income ?? 0);
  const spendDelta = pctChange(summary?.spentThisMonth ?? 0, lastMonth?.expense ?? 0);
  const lastNet = lastMonth ? lastMonth.income - lastMonth.expense : 0;
  const saveDelta = pctChange(summary?.netSavings ?? 0, lastNet);
  const balanceDelta = pctChange(netWorth, lastNet || totalBalance);

  const cashSpark = useMemo(() => {
    const points = summary?.sevenDaySpending ?? [];
    if (points.length < 2) return [18, 24, 20, 32, 28, 40, 36, 48, 42, 56];
    return points.map((item) => Math.max(4, (item.income || 0) - (item.amount || 0) + 20));
  }, [summary]);

  const noticeCount = useMemo(() => {
    const upcoming = (recurring.data ?? []).filter((item) => {
      if (item.isActive === false || !item.nextRunAt) return false;
      const due = new Date(item.nextRunAt).getTime() - nowMs;
      return due >= 0 && due <= 7 * 24 * 60 * 60 * 1000;
    });
    return Math.min(9, upcoming.length);
  }, [recurring.data, nowMs]);

  const recent = useMemo(() => {
    const rows = summary?.recentTransactions ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => {
      const hay = `${item.merchant ?? ""} ${item.categoryName ?? ""} ${item.accountName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [summary, search]);

  async function onRefresh() {
    await Promise.all([
      profile.refetch(),
      dashboard.refetch(),
      accounts.refetch(),
      investments.refetch(),
      loans.refetch(),
      cards.refetch(),
      recurring.refetch(),
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <LoadingBlock label="Loading your money…" />
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ErrorBlock message="Could not load overview." onRetry={() => void onRefresh()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.green}
          />
        }
      >
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <View style={styles.brandMark}>
              <Text style={styles.brandRupee}>₹</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Hisaab</Text>
              <Text style={styles.brandTag}>Premium Finance</Text>
            </View>
          </View>
          <Pressable
            style={styles.notifyBtn}
            onPress={() => navigation.navigate("Feature", { toolId: "bills" })}
            hitSlop={8}
          >
            <Icon name="notifications-outline" size={22} color={colors.white} />
            {noticeCount > 0 ? (
              <View style={styles.notifyBadge}>
                <Text style={styles.notifyBadgeText}>{noticeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.helloRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.hello}>
              {greetingLabel()}, {displayName} <Text style={styles.wave}>👋</Text>
            </Text>
          </View>
          <Pressable style={styles.avatar} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </Pressable>
        </View>

        <View style={styles.searchShell}>
          <View style={styles.searchGlow} />
          <View style={styles.search}>
            <View style={styles.searchIcon}>
              <Icon name="search" size={16} color={colors.green} />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search transactions, bills, accounts…"
              placeholderTextColor="#6F8B80"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => navigation.navigate("Transactions")}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Icon name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : (
              <Pressable style={styles.searchFilter} onPress={() => navigation.navigate("Transactions")}>
                <Icon name="options-outline" size={15} color={colors.green} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <View style={styles.balanceBody}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Pressable style={styles.balanceLabelRow} onPress={() => setHidden((v) => !v)}>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <Icon
                  name={hidden ? "eye-off-outline" : "eye-outline"}
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
              <Text style={styles.balanceValue}>
                {hidden ? "₹ ••••••••" : money(totalBalance, currency)}
              </Text>
              <View style={styles.balanceTrend}>
                <Icon
                  name={balanceDelta >= 0 ? "arrow-up" : "arrow-down"}
                  size={14}
                  color={balanceDelta >= 0 ? colors.green : colors.red}
                />
                <Text
                  style={[
                    styles.balanceTrendText,
                    { color: balanceDelta >= 0 ? colors.green : colors.red },
                  ]}
                >
                  {balanceDelta === 0
                    ? "Same vs last month"
                    : `${Math.abs(balanceDelta)}% vs last month`}
                </Text>
              </View>
              <Text style={styles.balanceMeta}>
                {(accounts.data?.length ?? 0)} accounts · Net worth {money(netWorth, currency)}
              </Text>
            </View>
            <BankMark />
          </View>
        </View>

        <View style={styles.quickRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.title}
              style={styles.quickItem}
              onPress={() => {
                if (action.add) navigation.navigate("Add");
                else if (action.toolId) navigation.navigate("Feature", { toolId: action.toolId });
              }}
            >
              <View style={styles.quickOrb}>
                <Icon name={action.icon} size={22} color={colors.green} />
              </View>
              <Text style={styles.quickText}>{action.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Quick Overview</Text>
          <Pressable onPress={() => navigation.navigate("Feature", { toolId: "reports" })}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.overviewRow}>
          <OverviewTile
            label="Income"
            value={money(summary.incomeThisMonth, currency)}
            delta={incomeDelta}
            tone="green"
          />
          <OverviewTile
            label="Expenses"
            value={money(summary.spentThisMonth, currency)}
            delta={spendDelta}
            invert
            tone="red"
          />
          <OverviewTile
            label="Net Savings"
            value={money(summary.netSavings, currency)}
            delta={saveDelta}
            tone="mint"
          />
        </View>

        <View style={styles.flowCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Cash Flow This Month</Text>
            <Text
              style={[
                styles.flowDelta,
                { color: saveDelta >= 0 ? colors.green : colors.red },
              ]}
            >
              {saveDelta === 0 ? "—" : `${saveDelta > 0 ? "▲" : "▼"} ${Math.abs(saveDelta)}%`} vs
              last month
            </Text>
          </View>
          <SparkLine values={cashSpark} width={320} height={110} color={colors.green} />
          <View style={styles.flowFoot}>
            <Text style={styles.flowFootText}>
              Spent {money(summary.spentThisMonth, currency)} · Income{" "}
              {money(summary.incomeThisMonth, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => navigation.navigate("Transactions")}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <TransactionList items={recent} limit={5} currency={currency} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewTile({
  label,
  value,
  delta,
  tone,
  invert,
}: {
  label: string;
  value: string;
  delta: number;
  tone: "green" | "red" | "mint";
  invert?: boolean;
}) {
  const good = invert ? delta <= 0 : delta >= 0;
  const accent =
    tone === "red" ? colors.red : tone === "mint" ? "#9BE7C4" : colors.green;
  return (
    <View style={[styles.overviewTile, { borderColor: `${accent}33` }]}>
      <View style={[styles.overviewDot, { backgroundColor: accent }]} />
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.overviewDelta, { color: good ? colors.green : colors.red }]}>
        {delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#010E0B" },
  page: { paddingHorizontal: 18, paddingBottom: 22, gap: 16 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  brandRupee: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  brandName: { color: colors.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  brandTag: { color: colors.green, fontSize: 11, fontWeight: "700", marginTop: 1 },
  notifyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.18)",
    backgroundColor: "rgba(7,37,30,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifyBadge: {
    position: "absolute",
    top: 7,
    right: 8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#010E0B",
  },
  notifyBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  helloRow: { flexDirection: "row", alignItems: "center" },
  hello: {
    color: colors.white,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  wave: { fontSize: 20 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(85,231,160,0.35)",
    backgroundColor: "#0A3026",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  searchShell: { position: "relative" },
  searchGlow: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 10,
    bottom: -2,
    borderRadius: 20,
    backgroundColor: "rgba(85,231,160,0.12)",
  },
  search: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.28)",
    backgroundColor: "#06231C",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(85,231,160,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: { flex: 1, color: colors.white, fontSize: 14, paddingVertical: 0 },
  searchFilter: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.22)",
    backgroundColor: "#07251E",
    overflow: "hidden",
    minHeight: 150,
  },
  balanceGlow: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(85,231,160,0.12)",
  },
  balanceBody: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 4,
  },
  balanceLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  balanceValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginTop: 8,
  },
  balanceTrend: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 8 },
  balanceTrendText: { fontSize: 13, fontWeight: "800" },
  balanceMeta: { color: colors.muted, fontSize: 11, marginTop: 6 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  quickItem: { flex: 1, alignItems: "center", gap: 8 },
  quickOrb: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(85,231,160,0.45)",
    backgroundColor: "rgba(85,231,160,0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.green,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  quickText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { color: colors.white, fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  seeAll: { color: colors.green, fontWeight: "800", fontSize: 13 },
  overviewRow: { flexDirection: "row", gap: 8 },
  overviewTile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "#07251E",
    padding: 12,
    justifyContent: "space-between",
  },
  overviewDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  overviewLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 4 },
  overviewValue: { color: colors.white, fontSize: 14, fontWeight: "800", letterSpacing: -0.3 },
  overviewDelta: { fontSize: 12, fontWeight: "800", marginTop: 8 },
  flowCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(85,231,160,0.18)",
    backgroundColor: "#07251E",
    padding: 16,
    gap: 10,
    overflow: "hidden",
  },
  flowDelta: { fontSize: 11, fontWeight: "800" },
  flowFoot: { marginTop: 2 },
  flowFootText: { color: colors.muted, fontSize: 11 },
});
