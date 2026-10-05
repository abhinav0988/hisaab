import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { TransactionList } from "../../components/finance/transaction-list";
import { localDateKey } from "../../lib/format";
import { profileService } from "../../services/profile.service";
import { transactionService } from "../../services/transaction.service";

const filters = ["All", "Income", "Expense", "Transfer"] as const;

export function TransactionsScreen() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const transactions = useQuery({
    queryKey: ["transactions", filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "50",
        sort: "newest",
      });
      if (filter === "Income") params.set("type", "INCOME");
      if (filter === "Expense") params.set("type", "EXPENSE");
      if (filter === "Transfer") params.set("type", "TRANSFER");
      const result = await transactionService.list(params.toString());
      return result.data;
    },
  });

  const currency = profile.data?.defaultCurrency ?? "INR";
  const todayKey = localDateKey();
  const { today, earlier } = useMemo(() => {
    const rows = transactions.data ?? [];
    return {
      today: rows.filter((item) => localDateKey(item.transactionAt) === todayKey),
      earlier: rows.filter((item) => localDateKey(item.transactionAt) !== todayKey),
    };
  }, [transactions.data, todayKey]);

  return (
    <Screen>
      <Header
        title="Transactions"
        subtitle="Track all your activities"
        action={<Icon name="search-outline" size={28} />}
      />
      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.pill, filter === item && styles.pillActive]}
          >
            <Text style={filter === item ? styles.pillTextActive : styles.pillText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {transactions.isLoading ? <LoadingBlock /> : null}
      {transactions.isError ? (
        <ErrorBlock
          message="Could not load transactions."
          onRetry={() => void transactions.refetch()}
        />
      ) : null}
      {!transactions.isLoading && !transactions.isError ? (
        <View
          // RefreshControl needs ScrollView; Screen already scrolls — refetch via pull on parent is enough via header tap
        >
          <Pressable onPress={() => void transactions.refetch()} style={styles.refresh}>
            <Text style={styles.refreshText}>{transactions.isFetching ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
          <SectionTitle title="Today" />
          <TransactionList items={today} currency={currency} />
          <SectionTitle title="Earlier" />
          <TransactionList items={earlier} currency={currency} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  pillActive: { backgroundColor: colors.green },
  pillText: { color: colors.muted },
  pillTextActive: { color: colors.ink, fontWeight: "900" },
  refresh: { alignSelf: "flex-end", paddingVertical: 4 },
  refreshText: { color: colors.green, fontWeight: "700", fontSize: 12 },
});
