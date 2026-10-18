import { StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import type { AppStackParamList } from "../../navigation/types";
import { reportService } from "../../services/report.service";
import { Screen } from "../../components/ui/screen";
import { Card } from "../../components/ui/card";
import { DateField } from "../../components/ui/date-field";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
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

export function ReportDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, "ReportDetail">) {
  const kind = route.params.kind;
  const [fromKey, setFromKey] = useState(monthStartKey);
  const [toKey, setToKey] = useState(() => localDateKey());
  const query = useMemo(() => buildRange(fromKey, toKey), [fromKey, toKey]);
  const q = useQuery<any[]>({
    queryKey: ["reports", kind, query],
    queryFn: () =>
      kind === "monthly"
        ? reportService.monthly(query)
        : kind === "categories"
          ? reportService.categories(query)
          : reportService.accounts(query),
  });
  const title =
    kind === "monthly" ? "Monthly report" : kind === "categories" ? "Category report" : "Account report";

  return (
    <Screen onBack={() => navigation.goBack()}>
      <Text style={s.title}>{title}</Text>
      <Card style={s.rangeCard}>
        <Text style={s.label}>DATE RANGE</Text>
        <DateField label="From" value={fromKey} onChange={setFromKey} maximumDate={startOfLocalDay(toKey)} />
        <DateField label="To" value={toKey} onChange={setToKey} minimumDate={startOfLocalDay(fromKey)} />
      </Card>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorBlock message={`Could not load ${title.toLowerCase()}.`} onRetry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyBlock title="No report data" body="Try again after recording transactions." />
      ) : (
        q.data.map((x: any) => (
          <Card key={x.id ?? x.month} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{x.name ?? x.month}</Text>
              {kind === "monthly" ? (
                <Text style={s.sub}>
                  Income {money(x.income)} · Expense {money(x.expense)}
                </Text>
              ) : (
                <Text style={s.sub}>Share of selected period</Text>
              )}
            </View>
            <Text style={s.amount}>{money(kind === "monthly" ? x.income - x.expense : x.value)}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { color: colors.white, fontSize: 29, fontWeight: "900" },
  rangeCard: { gap: 10 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  row: { padding: 14, flexDirection: "row", gap: 10 },
  name: { color: colors.white, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12 },
  amount: { color: colors.white, fontWeight: "900" },
});
