import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { AppButton } from "../../components/ui/button";
import { ErrorBlock, LoadingBlock, EmptyBlock } from "../../components/ui/states";
import { TransactionList } from "../../components/finance/transaction-list";
import { TransactionDateTimeField } from "../../components/finance/transaction-datetime-field";
import {
  endOfLocalDay,
  groupLabelForDateKey,
  localDateKey,
  localTimeKey,
  startOfLocalDay,
} from "../../lib/datetime";
import { categoryLabel } from "../../lib/categories";
import { profileService } from "../../services/profile.service";
import { transactionService } from "../../services/transaction.service";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { reportService } from "../../services/report.service";
import { nativeFileService } from "../../services/native-file.service";

const filters = ["All", "Income", "Expense", "Transfer"] as const;
type Period = "all" | "today" | "week" | "month" | "last_month" | "custom";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Transactions">,
  NativeStackScreenProps<AppStackParamList>
>;

function periodBounds(period: Period, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "week") {
    const day = now.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    return { from: start.toISOString(), to: undefined };
  }
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: undefined };
  }
  if (period === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "custom") {
    return {
      from: startOfLocalDay(customFrom).toISOString(),
      to: endOfLocalDay(customTo).toISOString(),
    };
  }
  return { from: undefined, to: undefined };
}

export function TransactionsScreen({ navigation }: Props) {
  const searchRef = useRef<TextInput>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tag, setTag] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState(localDateKey());
  const [customTo, setCustomTo] = useState(localDateKey());
  const [sort, setSort] = useState<"newest" | "oldest" | "amount_desc" | "amount_asc">("newest");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, accountId, categoryId, tag, period, sort, customFrom, customTo]);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const tags = useQuery({ queryKey: ["tags"], queryFn: transactionService.listTags });

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: "20", sort, page: String(page) });
    if (filter === "Income") params.set("type", "INCOME");
    if (filter === "Expense") params.set("type", "EXPENSE");
    if (filter === "Transfer") params.set("type", "TRANSFER");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (accountId) params.set("account_id", accountId);
    if (categoryId) params.set("category_id", categoryId);
    if (tag) params.set("tag", tag);
    const bounds = periodBounds(period, customFrom, customTo);
    if (bounds.from) params.set("from", bounds.from);
    if (bounds.to) params.set("to", bounds.to);
    return params.toString();
  }, [
    filter,
    debouncedSearch,
    accountId,
    categoryId,
    tag,
    period,
    sort,
    page,
    customFrom,
    customTo,
  ]);

  const transactions = useQuery({
    queryKey: ["transactions", listQuery],
    queryFn: () => transactionService.list(listQuery),
  });

  const currency = profile.data?.defaultCurrency ?? "INR";
  const pageMeta = transactions.data?.meta as { page?: number; totalPages?: number } | undefined;
  const todayKey = localDateKey();

  const grouped = useMemo(() => {
    const rows = transactions.data?.data ?? [];
    const map = new Map<string, Transaction[]>();
    for (const row of rows) {
      const key = localDateKey(row.transactionAt);
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return [...map.entries()].map(([dateKey, items]) => ({
      dateKey,
      title: groupLabelForDateKey(dateKey, todayKey),
      items,
    }));
  }, [transactions.data, todayKey]);

  const hasActiveFilters =
    filter !== "All" ||
    Boolean(debouncedSearch) ||
    Boolean(accountId) ||
    Boolean(categoryId) ||
    Boolean(tag) ||
    period !== "all";

  const clearFilters = () => {
    setFilter("All");
    setSearch("");
    setAccountId("");
    setCategoryId("");
    setTag("");
    setPeriod("all");
    setSort("newest");
  };

  const exportTransactions = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filter === "Income") params.set("type", "INCOME");
      if (filter === "Expense") params.set("type", "EXPENSE");
      if (filter === "Transfer") params.set("type", "TRANSFER");
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (accountId) params.set("account_id", accountId);
      if (categoryId) params.set("category_id", categoryId);
      if (tag) params.set("tag", tag);
      const bounds = periodBounds(period, customFrom, customTo);
      if (bounds.from) params.set("from", bounds.from);
      if (bounds.to) params.set("to", bounds.to);
      const csv = await reportService.exportCsv(params.toString());
      const file = nativeFileService.saveTextFile(
        `hisaab-transactions-${localDateKey()}.csv`,
        csv,
      );
      try {
        await nativeFileService.shareFile(file);
      } finally {
        nativeFileService.cleanupTemporaryFile(file);
      }
    } catch (error) {
      Alert.alert("Could not export", error instanceof Error ? error.message : "Try again.");
    } finally {
      setExporting(false);
    }
  };

  const cyclePeriod = () => {
    const order: Period[] = ["all", "today", "week", "month", "last_month", "custom"];
    const index = order.indexOf(period);
    setPeriod(order[(index + 1) % order.length]!);
  };

  return (
    <Screen>
      <Header
        title="Transactions"
        subtitle="Track all your activities"
        action={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => searchRef.current?.focus()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Focus search"
            >
              <Icon name="search-outline" size={26} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("AddTransaction")}
              hitSlop={10}
              style={styles.addFab}
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
            >
              <Icon name="add" size={22} color={colors.ink} />
            </Pressable>
          </View>
        }
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
      <View style={styles.toolbar}>
        <Pressable onPress={() => void exportTransactions()} style={styles.export}>
          <Text style={styles.exportText}>{exporting ? "Preparing export…" : "Export CSV"}</Text>
        </Pressable>
        <Pressable onPress={() => setShowFilters((v) => !v)}>
          <Text style={styles.exportText}>{showFilters ? "Hide filters" : "More filters"}</Text>
        </Pressable>
      </View>
      <TextInput
        ref={searchRef}
        value={search}
        onChangeText={setSearch}
        placeholder="Search merchant or notes"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      {showFilters ? (
        <>
          <Text style={styles.filterLabel}>FILTERS</Text>
          <View style={styles.chips}>
            <Chip
              label={
                period === "all"
                  ? "All dates"
                  : period === "last_month"
                    ? "Last month"
                    : period === "custom"
                      ? "Custom range"
                      : period
              }
              active={period !== "all"}
              onPress={cyclePeriod}
            />
            <Chip
              label={sort.replace("_", " ")}
              active={sort !== "newest"}
              onPress={() =>
                setSort(
                  sort === "newest"
                    ? "oldest"
                    : sort === "oldest"
                      ? "amount_desc"
                      : sort === "amount_desc"
                        ? "amount_asc"
                        : "newest",
                )
              }
            />
            {hasActiveFilters ? <Chip label="Clear" active onPress={clearFilters} /> : null}
          </View>
          {period === "custom" ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.filterLabel}>FROM</Text>
              <TransactionDateTimeField
                dateKey={customFrom}
                timeKey={localTimeKey()}
                onChange={({ dateKey }) => setCustomFrom(dateKey)}
                label="From date"
              />
              <Text style={styles.filterLabel}>TO</Text>
              <TransactionDateTimeField
                dateKey={customTo}
                timeKey={localTimeKey()}
                onChange={({ dateKey }) => setCustomTo(dateKey)}
                label="To date"
              />
            </View>
          ) : null}
          <View style={styles.chips}>
            {(accounts.data ?? [])
              .filter((item) => item.isActive)
              .map((item) => (
                <Chip
                  key={item.id}
                  label={item.name}
                  active={accountId === item.id}
                  onPress={() => setAccountId(accountId === item.id ? "" : item.id)}
                />
              ))}
          </View>
          <View style={styles.chips}>
            {(categories.data ?? [])
              .filter(
                (item) =>
                  !filter || filter === "All" || item.type === filter.toUpperCase(),
              )
              .map((item) => (
                <Chip
                  key={item.id}
                  label={categoryLabel(item, categories.data ?? [])}
                  active={categoryId === item.id}
                  onPress={() => setCategoryId(categoryId === item.id ? "" : item.id)}
                />
              ))}
          </View>
          {tags.data?.length ? (
            <View style={styles.chips}>
              {tags.data.map((item) => (
                <Chip
                  key={item.id}
                  label={`#${item.name}`}
                  active={tag === item.name}
                  onPress={() => setTag(tag === item.name ? "" : item.name)}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
      {transactions.isLoading ? <LoadingBlock /> : null}
      {transactions.isError && !transactions.data ? (
        <ErrorBlock
          message="Could not load transactions."
          onRetry={() => void transactions.refetch()}
        />
      ) : null}
      {!transactions.isLoading && (transactions.data || !transactions.isError) ? (
        <View>
          <Pressable onPress={() => void transactions.refetch()} style={styles.refresh}>
            <Text style={styles.refreshText}>
              {transactions.isFetching ? "Refreshing…" : "Refresh"}
            </Text>
          </Pressable>
          {transactions.isRefetchError ? (
            <Text style={styles.refreshText}>
              Could not refresh. Showing the last loaded transactions.
            </Text>
          ) : null}
          {!grouped.length ? (
            <EmptyBlock
              title={hasActiveFilters ? "No matching transactions" : "No transactions yet"}
              body={
                hasActiveFilters
                  ? "Try clearing filters or widening the date range."
                  : "Add income or expenses to see them here."
              }
            />
          ) : (
            grouped.map((group) => (
              <View key={group.dateKey} style={{ gap: 8 }}>
                <SectionTitle title={group.title} />
                <TransactionList
                  items={group.items}
                  currency={currency}
                  onPress={(item) =>
                    navigation.navigate("TransactionDetail", { id: item.id })
                  }
                />
              </View>
            ))
          )}
          <View style={styles.pagination}>
            <Pressable disabled={page === 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              <Text style={[styles.pageButton, page === 1 && styles.disabled]}>Previous</Text>
            </Pressable>
            <Text style={styles.pageText}>
              Page {pageMeta?.page ?? page} of {pageMeta?.totalPages ?? 1}
            </Text>
            <Pressable
              disabled={(pageMeta?.page ?? page) >= (pageMeta?.totalPages ?? 1)}
              onPress={() => setPage((p) => p + 1)}
            >
              <Text
                style={[
                  styles.pageButton,
                  (pageMeta?.page ?? page) >= (pageMeta?.totalPages ?? 1) && styles.disabled,
                ]}
              >
                Next
              </Text>
            </Pressable>
          </View>
          <AppButton
            label="Add transaction"
            icon="add"
            onPress={() => navigation.navigate("AddTransaction")}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  addFab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
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
  toolbar: { flexDirection: "row", justifyContent: "space-between" },
  refresh: { alignSelf: "flex-end", paddingVertical: 4 },
  refreshText: { color: colors.green, fontWeight: "700", fontSize: 12 },
  search: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.white,
    backgroundColor: colors.input,
  },
  filterLabel: { color: colors.muted, fontWeight: "800", fontSize: 10, letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: colors.ink },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  pageButton: { color: colors.green, fontWeight: "800" },
  pageText: { color: colors.muted, fontSize: 12 },
  disabled: { opacity: 0.35 },
  export: { paddingVertical: 3 },
  exportText: { color: colors.green, fontWeight: "800", fontSize: 12 },
});

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
