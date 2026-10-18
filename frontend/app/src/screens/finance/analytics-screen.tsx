import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../../navigation/types";
import { reportService } from "../../services/report.service";
import { nativeFileService } from "../../services/native-file.service";
import { Screen } from "../../components/ui/screen";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { DateField } from "../../components/ui/date-field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money } from "../../lib/format";
import { colors } from "../../theme/tokens";
import { endOfLocalDay, localDateKey, startOfLocalDay } from "../../lib/datetime";

function monthStartKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildRange(fromKey: string, toKey: string) {
  const from = startOfLocalDay(fromKey);
  const to = endOfLocalDay(toKey);
  return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
}

export function AnalyticsScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "Analytics">) {
  const [fromKey, setFromKey] = useState(monthStartKey);
  const [toKey, setToKey] = useState(() => localDateKey());
  const query = useMemo(() => buildRange(fromKey, toKey), [fromKey, toKey]);
  const q = useQuery({ queryKey: ["reports", "daily", query], queryFn: () => reportService.daily(query) });

  if (q.isLoading) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <Text style={s.title}>Analytics</Text>
        <LoadingBlock />
      </Screen>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Screen onBack={() => navigation.goBack()}>
        <Text style={s.title}>Analytics</Text>
        <ErrorBlock message="Could not load reports." onRetry={() => void q.refetch()} />
      </Screen>
    );
  }

  const d = q.data;
  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>Analytics</Text>
      <Card style={s.rangeCard}>
        <Text style={s.label}>DATE RANGE</Text>
        <DateField label="From" value={fromKey} onChange={setFromKey} maximumDate={startOfLocalDay(toKey)} />
        <DateField label="To" value={toKey} onChange={setToKey} minimumDate={startOfLocalDay(fromKey)} />
      </Card>
      <View style={s.metrics}>
        <Metric label="Income" value={money(d.totalIncome)} good />
        <Metric label="Expenses" value={money(d.totalExpenses)} />
      </View>
      <Card>
        <Text style={s.label}>NET SAVINGS</Text>
        <Text style={s.big}>{money(d.netSavings)}</Text>
        <Text style={s.sub}>
          {d.savingsRate}% savings rate · Avg {money(d.averageDailySpending)}/day
        </Text>
      </Card>
      <Text style={s.heading}>Reports</Text>
      <Link label="Monthly trend" onPress={() => navigation.navigate("ReportDetail", { kind: "monthly" })} />
      <Link
        label="Category breakdown"
        onPress={() => navigation.navigate("ReportDetail", { kind: "categories" })}
      />
      <Link label="Account breakdown" onPress={() => navigation.navigate("ReportDetail", { kind: "accounts" })} />
      <AppButton
        label="Export CSV"
        icon="download-outline"
        outline
        onPress={async () => {
          let file: ReturnType<typeof nativeFileService.saveTextFile> | undefined;
          try {
            file = nativeFileService.saveTextFile(
              `hisaab-report-${fromKey}_${toKey}.csv`,
              await reportService.exportCsv(query),
            );
            await nativeFileService.shareFile(file);
          } catch (e) {
            Alert.alert("Export failed", e instanceof Error ? e.message : "Try again.");
          } finally {
            if (file) nativeFileService.cleanupTemporaryFile(file);
          }
        }}
      />
    </Screen>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <Card style={s.metric}>
      <Text style={s.label}>{label.toUpperCase()}</Text>
      <Text style={[s.value, good && { color: colors.green }]}>{value}</Text>
    </Card>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={s.link}>
        <Text style={s.value}>{label}</Text>
        <Text style={s.sub}>Open report</Text>
      </Card>
    </Pressable>
  );
}

const s = StyleSheet.create({
  title: { color: colors.white, fontSize: 29, fontWeight: "900" },
  rangeCard: { gap: 10 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, gap: 7 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  value: { color: colors.white, fontSize: 16, fontWeight: "900" },
  big: { color: colors.white, fontSize: 30, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  heading: { color: colors.white, fontWeight: "900", fontSize: 17 },
  link: { padding: 14, gap: 4 },
});
