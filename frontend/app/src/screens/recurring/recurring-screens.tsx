import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { majorToMinor, recurringSchema } from "@hisaab/validation";
import type { TransactionType } from "@hisaab/types";
import { recurringService } from "../../services/recurring.service";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { transactionService } from "../../services/transaction.service";
import { Screen } from "../../components/ui/screen";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { DateField } from "../../components/ui/date-field";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
import {
  bankAccountLabel,
  channelLabel,
  isPaymentMethodType,
  type PaymentMethodType,
  uniqueCatalogChannels,
} from "../../lib/accounts";
import { money } from "../../lib/format";
import { combineLocalDateTime, localDateKey } from "../../lib/datetime";
import { colors } from "../../theme/tokens";

type Recurring = { id: string; accountId: string; categoryId: string; type: TransactionType; amountMinor: number; currency: string; merchant: string | null; notes: string | null; frequency: string; startAt: string; nextRunAt: string; isActive: boolean };
const refresh = (client: ReturnType<typeof useQueryClient>) => Promise.all(["recurring", "dashboard"].map((key) => client.invalidateQueries({ queryKey: [key] })));
export function RecurringListScreen({ navigation }: any) { const q = useQuery({ queryKey: ["recurring"], queryFn: () => recurringService.list<Recurring>() }); if (q.isLoading) return <Page navigation={navigation}><LoadingBlock /></Page>; if (q.isError) return <Page navigation={navigation}><ErrorBlock message="Could not load recurring bills." onRetry={() => void q.refetch()} /></Page>; return <Page navigation={navigation}><Title text="Bills & recurring" /><AppButton label="Create recurring bill" onPress={() => navigation.navigate("CreateRecurring")} />{q.data?.length ? q.data.map((item) => <Pressable key={item.id} onPress={() => navigation.navigate("RecurringDetail", { id: item.id })}><Card style={styles.row}><View style={{ flex: 1 }}><Text style={styles.name}>{item.merchant ?? "Recurring transaction"}</Text><Text style={styles.muted}>{item.frequency} · next {item.nextRunAt.slice(0, 10)}</Text><Text style={styles.muted}>{item.isActive ? "Active" : "Paused"}</Text></View><Text style={styles.amount}>{money(item.amountMinor, item.currency)}</Text></Card></Pressable>) : <EmptyBlock title="No recurring bills" body="Create a recurring transaction to automate regular spending." />}</Page>; }
export function RecurringDetailScreen({ navigation, route }: any) { const client = useQueryClient(); const q = useQuery({ queryKey: ["recurring"], queryFn: () => recurringService.list<Recurring>() }); const item = q.data?.find((row) => row.id === route.params.id); const toggle = useMutation({ mutationFn: () => item?.isActive ? recurringService.pause(item.id) : recurringService.resume(route.params.id), onSuccess: () => refresh(client), onError: failure("Could not update recurring bill") }); const remove = useMutation({ mutationFn: () => recurringService.remove(route.params.id), onSuccess: () => refresh(client).then(() => navigation.goBack()), onError: failure("Could not delete recurring bill") }); if (q.isLoading) return <Page navigation={navigation}><LoadingBlock /></Page>; if (!item) return <Page navigation={navigation}><ErrorBlock message="Recurring bill not found." onRetry={() => void q.refetch()} /></Page>; return <Page navigation={navigation}><Title text={item.merchant ?? "Recurring transaction"} /><Card style={styles.summary}><Text style={styles.big}>{money(item.amountMinor, item.currency)}</Text><Text style={styles.muted}>{item.type} · {item.frequency}</Text><Text style={styles.muted}>Next occurrence: {item.nextRunAt.slice(0, 10)}</Text><Text style={styles.muted}>{item.isActive ? "ACTIVE" : "PAUSED"}</Text></Card><AppButton label="Edit recurring bill" onPress={() => navigation.navigate("EditRecurring", { id: item.id })} /><AppButton outline label={toggle.isPending ? "Updating…" : item.isActive ? "Pause" : "Resume"} onPress={() => { if (!toggle.isPending) Alert.alert(item.isActive ? "Pause bill?" : "Resume bill?", "You can change this later.", [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => toggle.mutate() }]); }} /><AppButton outline label={remove.isPending ? "Deleting…" : "Delete recurring bill"} onPress={() => Alert.alert("Delete recurring bill?", "Future occurrences will stop.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate() }])} /><AppButton outline label="Occurrence history" onPress={() => navigation.navigate("RecurringHistory", { id: item.id })} /></Page>; }
export function CreateRecurringScreen({ navigation }: any) { return <RecurringForm navigation={navigation} />; } export function EditRecurringScreen({ navigation, route }: any) { return <RecurringForm navigation={navigation} id={route.params.id} />; }
const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
function RecurringForm({ navigation, id }: { navigation: any; id?: string }) {
  const client = useQueryClient();
  const list = useQuery({ queryKey: ["recurring"], queryFn: () => recurringService.list<Recurring>() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const banks = useQuery({ queryKey: ["account-banks"], queryFn: () => accountService.listBanks() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const old = list.data?.find((item) => item.id === id);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [channelAccountId, setChannelAccountId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>("MONTHLY");
  const [startDate, setStartDate] = useState(localDateKey());
  const [hydrated, setHydrated] = useState(!id);

  const channelOptions = useMemo(() => uniqueCatalogChannels(accounts.data ?? []), [accounts.data]);
  const bankAccounts = useMemo(() => (banks.data ?? []).filter((item) => item.isActive), [banks.data]);
  const selectedChannel =
    channelOptions.find((item) => item.id === channelAccountId) ??
    channelOptions.find((item) => item.type === "CASH") ??
    channelOptions[0] ??
    null;
  const isBankChannel = selectedChannel?.type === "BANK";
  const activeBankId = isBankChannel ? bankAccountId ?? bankAccounts[0]?.id ?? null : null;
  const selectedAccount = isBankChannel ? activeBankId : selectedChannel?.id ?? null;
  const paymentMethod: PaymentMethodType | "" =
    selectedChannel && isPaymentMethodType(selectedChannel.type) ? selectedChannel.type : "";

  useEffect(() => {
    if (!id || !old || hydrated || !accounts.data) return;
    setMerchant(old.merchant ?? "");
    setAmount(String(old.amountMinor / 100));
    setType(old.type === "INCOME" ? "INCOME" : "EXPENSE");
    setCategoryId(old.categoryId);
    setFrequency(
      (FREQUENCIES.includes(old.frequency as (typeof FREQUENCIES)[number])
        ? old.frequency
        : "MONTHLY") as (typeof FREQUENCIES)[number],
    );
    setStartDate(localDateKey(old.startAt));
    const bankMatch = bankAccounts.find((item) => item.id === old.accountId);
    const accountMatch = (accounts.data ?? []).find((item) => item.id === old.accountId);
    if (bankMatch || accountMatch?.type === "BANK") {
      setChannelAccountId(channelOptions.find((item) => item.type === "BANK")?.id ?? null);
      setBankAccountId(old.accountId);
    } else {
      const byType = accountMatch
        ? channelOptions.find((item) => item.type === accountMatch.type)
        : null;
      setChannelAccountId(byType?.id ?? channelOptions[0]?.id ?? null);
      setBankAccountId(null);
    }
    setHydrated(true);
  }, [id, old, hydrated, accounts.data, bankAccounts, channelOptions]);

  const matchingCategories = (categories.data ?? []).filter((category) => category.type === type);
  const selectPaymentMethod = (method: PaymentMethodType | "") => {
    if (!method) {
      const fallback =
        channelOptions.find((item) => item.type === "CASH") ??
        channelOptions.find((item) => item.type === "DEBIT_CARD") ??
        channelOptions.find((item) => !isPaymentMethodType(item.type)) ??
        null;
      setChannelAccountId(fallback?.id ?? null);
      setBankAccountId(null);
      return;
    }
    const match = channelOptions.find((item) => item.type === method);
    if (!match) return;
    setChannelAccountId(match.id);
    if (method === "BANK" && bankAccounts[0]) setBankAccountId(bankAccounts[0].id);
    else setBankAccountId(null);
  };

  const save = useMutation({
    mutationFn: () => {
      if (!selectedAccount) throw new Error("Choose an account.");
      if (isBankChannel && !activeBankId) throw new Error("Select a saved bank account.");
      const parsed = recurringSchema.safeParse({
        accountId: selectedAccount,
        categoryId,
        type,
        amountMinor: majorToMinor(amount),
        currency: old?.currency ?? "INR",
        merchant: merchant || null,
        notes: old?.notes ?? null,
        frequency,
        startAt: combineLocalDateTime(startDate, "09:00"),
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Check the recurring bill values.");
      }
      return id ? recurringService.update(id, parsed.data) : recurringService.create(parsed.data);
    },
    onSuccess: () => refresh(client).then(() => navigation.goBack()),
    onError: failure("Could not save recurring bill"),
  });

  return (
    <Page navigation={navigation}>
      <Title text={id ? "Edit recurring bill" : "New recurring bill"} />
      <Card style={styles.form}>
        <Field label="Merchant / title" placeholder="Internet provider" value={merchant} onChangeText={setMerchant} />
        <Field label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={styles.label}>TYPE</Text>
        <View style={styles.chips}>
          {(["EXPENSE", "INCOME"] as const).map((item) => (
            <Choice
              key={item}
              active={type === item}
              label={item}
              onPress={() => {
                setType(item);
                setCategoryId("");
              }}
            />
          ))}
        </View>
        <Text style={styles.label}>ACCOUNT</Text>
        <View style={styles.chips}>
          {channelOptions.map((account) => (
            <Choice
              key={account.id}
              active={selectedChannel?.id === account.id}
              label={channelLabel(account)}
              onPress={() => {
                setChannelAccountId(account.id);
                if (account.type === "BANK" && bankAccounts[0]) setBankAccountId(bankAccounts[0].id);
                else setBankAccountId(null);
              }}
            />
          ))}
        </View>
        <Text style={styles.label}>PAYMENT METHOD</Text>
        <View style={styles.chips}>
          {(
            [
              { value: "" as const, label: "Normal" },
              { value: "BANK" as const, label: "Bank" },
              { value: "UPI" as const, label: "UPI" },
              { value: "CREDIT_CARD" as const, label: "Credit card" },
            ] as const
          )
            .filter(
              (item) =>
                item.value === "" || channelOptions.some((channel) => channel.type === item.value),
            )
            .map((item) => (
              <Choice
                key={item.label}
                active={paymentMethod === item.value}
                label={item.label}
                onPress={() => selectPaymentMethod(item.value)}
              />
            ))}
        </View>
        {isBankChannel ? (
          <>
            <Text style={styles.label}>BANK ACCOUNT</Text>
            <View style={styles.chips}>
              {bankAccounts.map((account) => (
                <Choice
                  key={account.id}
                  active={activeBankId === account.id}
                  label={bankAccountLabel(account)}
                  onPress={() => setBankAccountId(account.id)}
                />
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.chips}>
          {matchingCategories.map((category) => (
            <Choice
              key={category.id}
              active={categoryId === category.id}
              label={category.name}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>
        <Text style={styles.label}>FREQUENCY</Text>
        <View style={styles.chips}>
          {FREQUENCIES.map((item) => (
            <Choice key={item} active={frequency === item} label={item} onPress={() => setFrequency(item)} />
          ))}
        </View>
        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        <AppButton
          label={save.isPending ? "Saving…" : "Save recurring bill"}
          onPress={() => {
            if (save.isPending || (id && !hydrated)) return;
            if (!amount.trim() || !selectedAccount || !categoryId) {
              return Alert.alert("Check the bill", "Amount, account, and category are required.");
            }
            save.mutate();
          }}
        />
      </Card>
    </Page>
  );
}
export function RecurringHistoryScreen({ navigation, route }: any) {
  const list = useQuery({ queryKey: ["recurring"], queryFn: () => recurringService.list<Recurring>() });
  const item = list.data?.find((row) => row.id === route.params.id);
  const tx = useQuery({
    queryKey: ["transactions", "recurring-history", route.params.id, item?.merchant],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", sort: "newest" });
      if (item?.merchant) params.set("search", item.merchant);
      const result = await transactionService.list(params.toString());
      return result.data;
    },
    enabled: !!item,
  });
  const rows = (tx.data ?? []).filter(
    (row) => (row as { recurringTransactionId?: string | null }).recurringTransactionId === route.params.id,
  );
  return (
    <Page navigation={navigation}>
      <Title text="Occurrence history" />
      {tx.isLoading || list.isLoading ? (
        <LoadingBlock />
      ) : rows.length ? (
        rows.map((row) => (
          <Card key={row.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{row.merchant ?? item?.merchant ?? "Occurrence"}</Text>
              <Text style={styles.muted}>{row.transactionAt.slice(0, 10)}</Text>
            </View>
            <Text style={styles.amount}>{money(row.amountMinor, row.currency)}</Text>
          </Card>
        ))
      ) : (
        <EmptyBlock
          title="No generated occurrences yet"
          body="When this bill runs, matching transactions appear here. You can also browse all activity under Transactions."
        />
      )}
    </Page>
  );
}
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={styles.chipText}>{label}</Text></Pressable>; } function Title({ text }: { text: string; navigation?: any }) { return <Text style={styles.title}>{text}</Text>; } function Page({ children, navigation }: { children: React.ReactNode; navigation?: any }) { return <Screen onBack={navigation ? () => navigation.goBack() : undefined}>{children}</Screen>; } function failure(title: string) { return (e: unknown) => Alert.alert(title, e instanceof Error ? e.message : "Try again."); }
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg }, page: { padding: 18, gap: 12 }, title: { color: colors.white, fontSize: 29, fontWeight: "900" }, row: { flexDirection: "row", gap: 10, padding: 14 }, name: { color: colors.white, fontWeight: "800" }, muted: { color: colors.muted, fontSize: 12 }, amount: { color: colors.green, fontWeight: "900" }, summary: { gap: 7, backgroundColor: colors.panel2 }, big: { color: colors.green, fontSize: 32, fontWeight: "900" }, form: { gap: 12 }, label: { color: colors.muted, fontSize: 10, fontWeight: "900" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14 }, active: { backgroundColor: colors.green }, chipText: { color: colors.white, fontWeight: "800", fontSize: 11 } });
