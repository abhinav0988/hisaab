import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
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
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { reportService } from "../../services/report.service";
import { nativeFileService } from "../../services/native-file.service";

const filters = ["All", "Income", "Expense", "Transfer"] as const;

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Transactions">, NativeStackScreenProps<AppStackParamList>>;

export function TransactionsScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const [period, setPeriod] = useState<"all" | "today" | "month">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc">("newest");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [filter, debouncedSearch, accountId, categoryId, tag, period, sort]);
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const tags = useQuery({ queryKey: ["tags"], queryFn: transactionService.listTags });
  const transactions = useQuery({
    queryKey: ["transactions", filter, debouncedSearch, accountId, categoryId, tag, period, sort, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "20",
        sort,
        page: String(page),
      });
      if (filter === "Income") params.set("type", "INCOME");
      if (filter === "Expense") params.set("type", "EXPENSE");
      if (filter === "Transfer") params.set("type", "TRANSFER");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (accountId) params.set("account_id", accountId);
      if (categoryId) params.set("category_id", categoryId);
      if (tag) params.set("tag", tag);
      const now = new Date();
      if (period === "today") { const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const end = new Date(start); end.setDate(end.getDate() + 1); params.set("from", start.toISOString()); params.set("to", end.toISOString()); }
      if (period === "month") { const start = new Date(now.getFullYear(), now.getMonth(), 1); params.set("from", start.toISOString()); }
      const result = await transactionService.list(params.toString());
      return result;
    },
  });

  const currency = profile.data?.defaultCurrency ?? "INR";
  const pageMeta = transactions.data?.meta as { page?: number; totalPages?: number } | undefined;
  const todayKey = localDateKey();
  const { today, earlier } = useMemo(() => {
    const rows = transactions.data?.data ?? [];
    return {
      today: rows.filter((item) => localDateKey(item.transactionAt) === todayKey),
      earlier: rows.filter((item) => localDateKey(item.transactionAt) !== todayKey),
    };
  }, [transactions.data, todayKey]);
  const exportTransactions = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      const now = new Date();
      if (period === "today") { const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const end = new Date(start); end.setDate(end.getDate() + 1); params.set("from", start.toISOString()); params.set("to", end.toISOString()); }
      if (period === "month") params.set("from", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
      const csv = await reportService.exportCsv(params.toString());
      const file = nativeFileService.saveTextFile(`hisaab-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      try { await nativeFileService.shareFile(file); } finally { nativeFileService.cleanupTemporaryFile(file); }
    } catch (error) { Alert.alert("Could not export", error instanceof Error ? error.message : "Try again."); } finally { setExporting(false); }
  };

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
      <Pressable onPress={() => void exportTransactions()} style={styles.export}><Text style={styles.exportText}>{exporting ? "Preparing export…" : "Export CSV"}</Text></Pressable>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search merchant or notes"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      <Text style={styles.filterLabel}>FILTERS</Text>
      <View style={styles.chips}><Chip label={period === "all" ? "All dates" : period} active={period !== "all"} onPress={() => setPeriod(period === "all" ? "today" : period === "today" ? "month" : "all")} /><Chip label={sort.replace("_", " ")} active={sort !== "newest"} onPress={() => setSort(sort === "newest" ? "oldest" : sort === "oldest" ? "amount_desc" : sort === "amount_desc" ? "amount_asc" : "newest")} /></View>
      <View style={styles.chips}>{(accounts.data ?? []).map(item => <Chip key={item.id} label={item.name} active={accountId === item.id} onPress={() => setAccountId(accountId === item.id ? "" : item.id)} />)}</View>
      <View style={styles.chips}>{(categories.data ?? []).filter(item => !filter || filter === "All" || item.type === filter.toUpperCase()).map(item => <Chip key={item.id} label={item.name} active={categoryId === item.id} onPress={() => setCategoryId(categoryId === item.id ? "" : item.id)} />)}</View>
      {tags.data?.length ? <View style={styles.chips}>{tags.data.map(item => <Chip key={item.id} label={`#${item.name}`} active={tag === item.name} onPress={() => setTag(tag === item.name ? "" : item.name)} />)}</View> : null}
      {transactions.isLoading ? <LoadingBlock /> : null}
      {transactions.isError && !transactions.data ? (
        <ErrorBlock
          message="Could not load transactions."
          onRetry={() => void transactions.refetch()}
        />
      ) : null}
      {!transactions.isLoading && (transactions.data || !transactions.isError) ? (
        <View
          // RefreshControl needs ScrollView; Screen already scrolls — refetch via pull on parent is enough via header tap
        >
          <Pressable onPress={() => void transactions.refetch()} style={styles.refresh}>
            <Text style={styles.refreshText}>{transactions.isFetching ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
          {transactions.isRefetchError ? <Text style={styles.refreshText}>Could not refresh. Showing the last loaded transactions.</Text> : null}
          <SectionTitle title="Today" />
          <TransactionList items={today} currency={currency} onPress={(item) => navigation.navigate("TransactionDetail", { id: item.id })} />
          <SectionTitle title="Earlier" />
          <TransactionList items={earlier} currency={currency} onPress={(item) => navigation.navigate("TransactionDetail", { id: item.id })} />
          <View style={styles.pagination}><Pressable disabled={page === 1} onPress={() => setPage(p => Math.max(1, p - 1))}><Text style={[styles.pageButton, page === 1 && styles.disabled]}>Previous</Text></Pressable><Text style={styles.pageText}>Page {pageMeta?.page ?? page} of {pageMeta?.totalPages ?? 1}</Text><Pressable disabled={(pageMeta?.page ?? page) >= (pageMeta?.totalPages ?? 1)} onPress={() => setPage(p => p + 1)}><Text style={[styles.pageButton, (pageMeta?.page ?? page) >= (pageMeta?.totalPages ?? 1) && styles.disabled]}>Next</Text></Pressable></View>
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
  search: { height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, color: colors.white, backgroundColor: colors.input },
  filterLabel: { color: colors.muted, fontWeight: "800", fontSize: 10, letterSpacing: .6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.ink },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  pageButton: { color: colors.green, fontWeight: "800" }, pageText: { color: colors.muted, fontSize: 12 }, disabled: { opacity: .35 },
  export: { alignSelf: "flex-end", paddingVertical: 3 }, exportText: { color: colors.green, fontWeight: "800", fontSize: 12 },
});

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>; }
