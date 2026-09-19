import { useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors, radius } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import {
  demoSummary,
  demoUser,
  homeDashboard,
  sparkline,
  spendingBreakdown,
  upcomingBills,
} from "../../data/fixtures";
import { SparkLine } from "../../components/charts/spark-line";
import { ProgressRing, SegmentedRing } from "../../components/charts/ring";
import { Icon } from "../../components/ui/icon";
import type { IconName } from "../../config/finance-tools";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Home">,
  NativeStackScreenProps<AppStackParamList>
>;

const quickActions: { title: string; icon: IconName; tint: string; toolId?: string; add?: boolean }[] = [
  { title: "Add Transaction", icon: "add", tint: colors.green, add: true },
  { title: "Add Account", icon: "business-outline", tint: colors.teal, toolId: "accounts" },
  { title: "Set Budget", icon: "pie-chart-outline", tint: colors.gold, toolId: "budgets" },
  { title: "Add Reminder", icon: "calendar-outline", tint: colors.purple, toolId: "bills" },
];

function greetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}

function dateChip() {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-IN", { weekday: "short" });
  const day = now.getDate();
  const month = now.toLocaleDateString("en-IN", { month: "short" });
  const year = now.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export function HomeScreen({ navigation }: Props) {
  const [hidden, setHidden] = useState(false);
  const firstName = demoUser.name.split(" ")[0];
  const dateLabel = useMemo(() => dateChip(), []);

  function openTool(toolId: string) {
    navigation.navigate("Feature", { toolId });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandRupee}>₹</Text>
            </View>
            <View>
              <Text style={styles.brand}>Hisaab</Text>
              <Text style={styles.tagline}>Your Money, Your Story</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <Pressable style={styles.iconBtn}>
              <Icon name="search-outline" size={18} color={colors.white} />
            </Pressable>
            <Pressable style={styles.iconBtn}>
              <Icon name="notifications-outline" size={18} color={colors.white} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>2</Text>
              </View>
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{demoUser.initials}</Text>
            </View>
          </View>
        </View>

        <View style={styles.helloRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.hello}>{greetingLabel()}</Text>
            <Text style={styles.name}>
              {firstName} <Text style={styles.wave}>👋</Text>
            </Text>
            <Text style={styles.motto}>Small steps today, bigger dreams tomorrow.</Text>
          </View>
          <View style={styles.dateChip}>
            <Icon name="calendar-outline" size={16} color={colors.green} />
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.dateSub}>Have a great day!</Text>
          </View>
        </View>

        <View style={styles.worthCard}>
          <View style={styles.worthHead}>
            <Pressable onPress={() => setHidden((value) => !value)} style={styles.worthTitle}>
              <Text style={styles.worthLabel}>Total Net Worth</Text>
              <Icon name={hidden ? "eye-off-outline" : "eye-outline"} size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => openTool("accounts")} style={styles.linkRow}>
              <Text style={styles.link}>All Accounts</Text>
              <Icon name="chevron-forward" size={14} color={colors.green} />
            </Pressable>
          </View>
          <View style={styles.worthBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.worthAmount}>
                {hidden ? homeDashboard.netWorthHidden : homeDashboard.netWorth}
              </Text>
              <Text style={styles.worthChange}>
                ▲ {homeDashboard.monthChange}{" "}
                <Text style={styles.worthChangePct}>({homeDashboard.monthChangePct})</Text>{" "}
                <Text style={styles.muted}>this month</Text>
              </Text>
            </View>
            <SparkLine values={sparkline} />
          </View>
          <View style={styles.worthFoot}>
            <View style={styles.footItem}>
              <View style={[styles.dot, { backgroundColor: colors.green }]} />
              <View>
                <Text style={styles.footValue}>{homeDashboard.assets}</Text>
                <Text style={styles.footLabel}>Assets</Text>
              </View>
            </View>
            <View style={styles.footItem}>
              <View style={[styles.dot, { backgroundColor: colors.red }]} />
              <View>
                <Text style={styles.footValue}>{homeDashboard.liabilities}</Text>
                <Text style={styles.footLabel}>Liabilities</Text>
              </View>
            </View>
            <View style={styles.growChip}>
              <Icon name="stats-chart" size={14} color={colors.green} />
              <Text style={styles.growText}>You’re growing!{"\n"}Keep going</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          {quickActions.map((action) => (
            <Pressable
              key={action.title}
              style={styles.quickItem}
              onPress={() => {
                if (action.add) navigation.navigate("Add");
                else if (action.toolId) openTool(action.toolId);
              }}
            >
              <View style={[styles.quickOrb, { backgroundColor: `${action.tint}22`, borderColor: `${action.tint}55` }]}>
                <Icon name={action.icon} size={22} color={action.tint} />
              </View>
              <Text style={styles.quickText}>{action.title.replace(" ", "\n")}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>This Month</Text>
          <Pressable onPress={() => openTool("reports")} style={styles.linkRow}>
            <Text style={styles.link}>View Details</Text>
            <Icon name="chevron-forward" size={14} color={colors.green} />
          </Pressable>
        </View>
        <View style={styles.monthGrid}>
          <MonthStat
            icon="arrow-up"
            tint={colors.green}
            value={demoSummary.income}
            label="Income"
            delta="▲ 12.4%"
          />
          <MonthStat
            icon="arrow-down"
            tint={colors.red}
            value={demoSummary.expenses}
            label="Expenses"
            delta="▼ 5.7%"
          />
          <MonthStat
            icon="star"
            tint={colors.gold}
            value={demoSummary.savings}
            label="Saved"
            delta="▲ 18.2%"
          />
          <View style={[styles.monthCard, { backgroundColor: "#55E7A014", borderColor: "#55E7A044" }]}>
            <ProgressRing size={52} strokeWidth={6} progress={homeDashboard.savingsRate / 100} color={colors.green}>
              <Text style={styles.rateText}>{homeDashboard.savingsRate}%</Text>
            </ProgressRing>
            <Text style={styles.monthValue}>Savings Rate</Text>
            <Text style={[styles.monthDelta, { color: colors.green }]}>Good progress!</Text>
          </View>
        </View>

        <View style={styles.insight}>
          <View style={styles.insightBlob} />
          <View style={styles.insightIcon}>
            <Icon name="radio-button-on" size={22} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>Money Insight</Text>
            <Text style={styles.insightCopy}>{homeDashboard.insight}</Text>
          </View>
          <Pressable style={styles.insightBtn} onPress={() => openTool("coach")}>
            <Text style={styles.insightBtnText}>View Insights</Text>
            <Icon name="arrow-forward" size={14} color={colors.goldInk} />
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Spending Overview</Text>
            <Text style={styles.muted}>This Month</Text>
          </View>
          <View style={styles.spendRow}>
            <SegmentedRing
              size={128}
              strokeWidth={16}
              segments={spendingBreakdown.map((item) => ({ value: item.pct, color: item.color }))}
            >
              <Text style={styles.spendTotal}>{demoSummary.expenses}</Text>
              <Text style={styles.spendCaption}>Total Spent</Text>
            </SegmentedRing>
            <View style={styles.legend}>
              {spendingBreakdown.map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <Icon name={item.icon} size={14} color={item.color} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendPct}>{item.pct}%</Text>
                  <Text style={styles.legendAmt}>{item.amount}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <Pressable onPress={() => openTool("bills")} style={styles.linkRow}>
            <Text style={styles.link}>View All</Text>
            <Icon name="chevron-forward" size={14} color={colors.green} />
          </Pressable>
        </View>
        <View style={styles.listCard}>
          {upcomingBills.map((bill, index) => (
            <View key={bill.id} style={[styles.listRow, index < upcomingBills.length - 1 && styles.listDivider]}>
              <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{bill.day}</Text>
                <Text style={styles.dateMon}>{bill.month}</Text>
              </View>
              <View style={[styles.listIcon, { backgroundColor: `${bill.tone}22` }]}>
                <Icon name={bill.icon} size={18} color={bill.tone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{bill.title}</Text>
                <Text style={styles.listSub}>{bill.subtitle}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.listAmt}>{bill.amount}</Text>
                <Text style={styles.due}>{bill.due}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => navigation.navigate("Transactions")} style={styles.linkRow}>
            <Text style={styles.link}>See All</Text>
            <Icon name="chevron-forward" size={14} color={colors.green} />
          </Pressable>
        </View>
        <View style={styles.listCard}>
          <View style={styles.listRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>15</Text>
              <Text style={styles.dateMon}>SEP</Text>
            </View>
            <View style={[styles.amazon, { backgroundColor: "#FF9F4322" }]}>
              <Text style={styles.amazonA}>a</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>Amazon Pay</Text>
              <Text style={styles.listSub}>Shopping</Text>
            </View>
            <Text style={styles.expenseAmt}>- ₹2,499</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MonthStat({
  icon,
  tint,
  value,
  label,
  delta,
}: {
  icon: IconName;
  tint: string;
  value: string;
  label: string;
  delta: string;
}) {
  return (
    <View style={[styles.monthCard, { backgroundColor: `${tint}18`, borderColor: `${tint}40` }]}>
      <View style={[styles.monthIcon, { backgroundColor: `${tint}22` }]}>
        <Icon name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.monthValue}>{value}</Text>
      <Text style={styles.monthLabel}>{label}</Text>
      <Text style={[styles.monthDelta, { color: tint }]}>{delta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRupee: { color: colors.green, fontSize: 18, fontWeight: "800" },
  brand: { color: colors.white, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  tagline: { color: colors.muted, fontSize: 11, marginTop: 1 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: "800" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  helloRow: { flexDirection: "row", alignItems: "flex-start" },
  hello: { color: colors.muted, fontSize: 14 },
  name: { color: colors.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, marginTop: 2 },
  wave: { fontSize: 24 },
  motto: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  dateChip: {
    width: 118,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 4,
    alignItems: "flex-start",
  },
  dateText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  dateSub: { color: colors.muted, fontSize: 10 },
  worthCard: {
    backgroundColor: colors.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
    overflow: "hidden",
  },
  worthHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  worthTitle: { flexDirection: "row", alignItems: "center", gap: 6 },
  worthLabel: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  worthBody: { flexDirection: "row", alignItems: "center", gap: 8 },
  worthAmount: { color: colors.white, fontSize: 30, fontWeight: "800", letterSpacing: -1 },
  worthChange: { color: colors.green, fontWeight: "700", marginTop: 6, fontSize: 12 },
  worthChangePct: { color: colors.green },
  muted: { color: colors.muted, fontSize: 12 },
  worthFoot: { flexDirection: "row", alignItems: "center", gap: 10 },
  footItem: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footValue: { color: colors.white, fontSize: 12, fontWeight: "700" },
  footLabel: { color: colors.muted, fontSize: 10 },
  growChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0B3A2C",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  growText: { color: colors.green, fontSize: 10, fontWeight: "700", lineHeight: 13 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { color: colors.green, fontWeight: "700", fontSize: 12 },
  quickRow: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { width: "23%", alignItems: "center", gap: 8 },
  quickOrb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { color: colors.white, fontSize: 11, textAlign: "center", fontWeight: "600", lineHeight: 14, height: 28 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
  monthGrid: { flexDirection: "row", gap: 8 },
  monthCard: {
    flex: 1,
    minHeight: 118,
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    gap: 6,
  },
  monthIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  monthValue: { color: colors.white, fontSize: 13, fontWeight: "800" },
  monthLabel: { color: colors.muted, fontSize: 11 },
  monthDelta: { fontSize: 11, fontWeight: "700" },
  rateText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  insight: {
    backgroundColor: "#083126",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1F6B52",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  insightBlob: {
    position: "absolute",
    right: -30,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(85, 231, 160, 0.08)",
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { color: colors.gold, fontWeight: "800", fontSize: 13 },
  insightCopy: { color: colors.white, fontSize: 12, lineHeight: 17, marginTop: 2 },
  insightBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  insightBtnText: { color: colors.goldInk, fontSize: 10, fontWeight: "800" },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 12,
  },
  spendRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  spendTotal: { color: colors.white, fontSize: 13, fontWeight: "800" },
  spendCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLabel: { color: colors.white, fontSize: 11, flex: 1 },
  legendPct: { color: colors.muted, fontSize: 11, width: 32 },
  legendAmt: { color: colors.white, fontSize: 11, fontWeight: "700", width: 58, textAlign: "right" },
  listCard: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dateBox: {
    width: 40,
    alignItems: "center",
  },
  dateDay: { color: colors.white, fontSize: 16, fontWeight: "800" },
  dateMon: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  listTitle: { color: colors.white, fontSize: 13, fontWeight: "800" },
  listSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  listAmt: { color: colors.white, fontSize: 13, fontWeight: "800" },
  due: { color: colors.orange, fontSize: 10, marginTop: 2 },
  amazon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  amazonA: { color: colors.orange, fontSize: 18, fontWeight: "800" },
  expenseAmt: { color: colors.red, fontSize: 13, fontWeight: "800" },
});
