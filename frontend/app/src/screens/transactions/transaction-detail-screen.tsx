import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { creditSpendDelta, majorToMinor, nextCreditBalances } from "@hisaab/validation";
import type { CreditFacility } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import {
  bankAccountLabel,
  bankAccountName,
  channelLabel,
  isPaymentMethodType,
  type PaymentMethodType,
  uniqueCatalogChannels,
} from "../../lib/accounts";
import { categoryLabel } from "../../lib/categories";
import { money, signedMoney } from "../../lib/format";
import {
  combineLocalDateTime,
  formatDisplayDate,
  localDateKey,
  localTimeKey,
} from "../../lib/datetime";
import { creditKindForAccount, facilityLabel } from "../../lib/credit";
import { transactionService } from "../../services/transaction.service";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { financeService } from "../../services/finance.service";
import { useSingleFlight } from "../../lib/single-flight";
import { TagChips, TagPicker } from "../../components/finance/tag-picker";
import { TransactionAttachments } from "../../components/finance/transaction-attachments";
import { TransactionDateTimeField } from "../../components/finance/transaction-datetime-field";
import { friendlyError } from "../../lib/api-errors";

type Props = NativeStackScreenProps<AppStackParamList, "TransactionDetail">;

export function TransactionDetailScreen({ navigation, route }: Props) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ["transaction", route.params.id],
    queryFn: () => transactionService.get(route.params.id),
  });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["transactions"] }),
      client.invalidateQueries({ queryKey: ["dashboard"] }),
      client.invalidateQueries({ queryKey: ["accounts"] }),
      client.invalidateQueries({ queryKey: ["reports"] }),
      client.invalidateQueries({ queryKey: ["budgets"] }),
      client.invalidateQueries({ queryKey: ["transaction", route.params.id] }),
      client.invalidateQueries({ queryKey: ["tags"] }),
      client.invalidateQueries({ queryKey: ["credit-facilities"] }),
    ]);
  };
  const remove = useMutation({
    mutationFn: () => transactionService.remove(route.params.id),
    onSuccess: async () => {
      await refresh();
      navigation.goBack();
    },
    onError: (e) => Alert.alert("Could not delete", friendlyError(e)),
  });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
        <BackLink onPress={() => navigation.goBack()} pinTop />
        <LoadingBlock />
      </SafeAreaView>
    );
  }
  if (!query.data) {
    return (
      <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
        <BackLink onPress={() => navigation.goBack()} pinTop />
        <ErrorBlock message="Could not load transaction." onRetry={() => void query.refetch()} />
      </SafeAreaView>
    );
  }

  const tx = query.data;
  const accountName =
    accounts.data?.find((account) => account.id === tx.accountId)?.name ??
    tx.accountName ??
    "Account";
  const facilityRow = (facilities.data ?? []).find((item) => item.id === tx.creditFacilityId);
  const facilityName = facilityRow ? facilityLabel(facilityRow) : null;
  const categoryRow = categories.data?.find((category) => category.id === tx.categoryId);
  const categoryName = categoryRow
    ? categoryLabel(categoryRow, categories.data ?? [])
    : (tx.categoryName ?? "Category");
  const destinationName = tx.destinationAccountId
    ? (accounts.data?.find((account) => account.id === tx.destinationAccountId)?.name ??
      tx.destinationAccountName ??
      "Destination")
    : null;
  const confirmDelete = () =>
    Alert.alert(
      "Delete transaction?",
      "This removes the transaction and updates balances. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (!remove.isPending) remove.mutate();
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <BackLink
        onPress={() => {
          Keyboard.dismiss();
          if (editing) setEditing(false);
          else if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate("Tabs");
        }}
        label={editing ? "Cancel edit" : "Back"}
        pinTop
      />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {editing ? (
            <EditForm
              transaction={tx}
              onSaved={async () => {
                await refresh();
                setEditing(false);
              }}
              onCancel={() => {
                Keyboard.dismiss();
                setEditing(false);
              }}
            />
          ) : (
            <>
              <Text style={styles.title}>{tx.merchant || categoryName || "Transaction"}</Text>
              <Card style={styles.hero}>
                <Text style={styles.label}>{tx.type}</Text>
                <Text
                  style={[
                    styles.amount,
                    {
                      color:
                        tx.type === "INCOME"
                          ? colors.green
                          : tx.type === "EXPENSE"
                            ? colors.red
                            : colors.gold,
                    },
                  ]}
                >
                  {signedMoney(tx.amountMinor, tx.currency, tx.type)}
                </Text>
                <Text style={styles.muted}>{new Date(tx.transactionAt).toLocaleString()}</Text>
              </Card>
              <Detail label="Account" value={accountName} />
              <Detail label="Category" value={categoryName} />
              {facilityName ? <Detail label="Credit facility" value={facilityName} /> : null}
              {destinationName ? <Detail label="Destination" value={destinationName} /> : null}
              {tx.merchant ? <Detail label="Merchant" value={tx.merchant} /> : null}
              {tx.notes ? <Detail label="Notes" value={tx.notes} /> : null}
              <Card style={styles.detail}>
                <Text style={styles.label}>TAGS</Text>
                {tx.tags?.length ? <TagChips tags={tx.tags} /> : <Text style={styles.muted}>No tags.</Text>}
              </Card>
              <TransactionAttachments transactionId={tx.id} />
              <AppButton label="Edit transaction" icon="create-outline" onPress={() => setEditing(true)} />
              <AppButton
                label={remove.isPending ? "Deleting…" : "Delete transaction"}
                icon="trash-outline"
                outline
                onPress={confirmDelete}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EditForm({
  transaction,
  onSaved,
  onCancel,
}: {
  transaction: Awaited<ReturnType<typeof transactionService.get>>;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const flight = useSingleFlight();
  const [amount, setAmount] = useState(String(transaction.amountMinor / 100));
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [tags, setTags] = useState<string[]>(transaction.tags ?? []);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [type, setType] = useState(transaction.type);
  const [channelAccountId, setChannelAccountId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [destinationId, setDestinationId] = useState<string | null>(
    transaction.destinationAccountId ?? null,
  );
  const [creditFacilityId, setCreditFacilityId] = useState<string | null>(
    transaction.creditFacilityId ?? null,
  );
  const [dateKey, setDateKey] = useState(localDateKey(transaction.transactionAt));
  const [timeKey, setTimeKey] = useState(localTimeKey(transaction.transactionAt));
  const [hydrated, setHydrated] = useState(false);

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const banks = useQuery({ queryKey: ["account-banks"], queryFn: () => accountService.listBanks() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
  });

  const channelOptions = useMemo(
    () => uniqueCatalogChannels(accounts.data ?? []),
    [accounts.data],
  );
  const bankAccounts = useMemo(
    () => (banks.data ?? []).filter((item) => item.isActive),
    [banks.data],
  );
  const transferAccounts = useMemo(() => {
    const channels = channelOptions.filter((item) => item.type !== "BANK");
    const merged = [...channels, ...bankAccounts];
    const catalogBank = channelOptions.find((item) => item.type === "BANK");
    if (catalogBank && !merged.some((item) => item.id === catalogBank.id)) merged.push(catalogBank);
    return merged;
  }, [channelOptions, bankAccounts]);

  useEffect(() => {
    if (hydrated || !accounts.data) return;
    const bankMatch = bankAccounts.find((item) => item.id === transaction.accountId);
    const accountMatch = (accounts.data ?? []).find((item) => item.id === transaction.accountId);
    if (bankMatch || accountMatch?.type === "BANK") {
      const catalogBank = channelOptions.find((item) => item.type === "BANK");
      setChannelAccountId(catalogBank?.id ?? null);
      setBankAccountId(transaction.accountId);
    } else {
      const byId = channelOptions.find((item) => item.id === transaction.accountId);
      const byType = accountMatch
        ? channelOptions.find((item) => item.type === accountMatch.type)
        : null;
      setChannelAccountId(byId?.id ?? byType?.id ?? channelOptions[0]?.id ?? null);
      setBankAccountId(null);
    }
    setHydrated(true);
  }, [
    accounts.data,
    bankAccounts,
    channelOptions,
    hydrated,
    transaction.accountId,
  ]);

  const selectedChannel =
    channelOptions.find((item) => item.id === channelAccountId) ??
    channelOptions.find((item) => item.type === "CASH") ??
    channelOptions[0] ??
    null;
  const isBankChannel = selectedChannel?.type === "BANK";
  const activeBankId = isBankChannel ? bankAccountId ?? bankAccounts[0]?.id ?? null : null;
  const selectedBank = bankAccounts.find((item) => item.id === activeBankId) ?? null;
  const selectedAccount = isBankChannel ? activeBankId : selectedChannel?.id ?? null;
  const paymentMethod: PaymentMethodType | "" =
    selectedChannel && isPaymentMethodType(selectedChannel.type) ? selectedChannel.type : "";
  const currency = transaction.currency ?? "INR";

  const creditKind = type !== "TRANSFER" ? creditKindForAccount(selectedChannel?.type) : null;
  const creditOptions = useMemo(
    () =>
      creditKind
        ? ((facilities.data ?? []) as CreditFacility[]).filter((item) => item.kind === creditKind)
        : [],
    [creditKind, facilities.data],
  );
  const selectedFacility =
    creditKind === "CARD"
      ? creditOptions.find((item) => item.id === creditFacilityId) ??
        creditOptions.find((item) => item.accountId === selectedAccount) ??
        creditOptions[0] ??
        null
      : creditKind === "UPI"
        ? creditOptions.find((item) => item.id === creditFacilityId) ?? null
        : null;

  const matchingCategories = (categories.data ?? []).filter((c) => c.type === type);
  const selectedCategory =
    matchingCategories.find((c) => c.id === categoryId)?.id ?? matchingCategories[0]?.id ?? null;
  const selectedDestination =
    destinationId ?? transferAccounts.find((item) => item.id !== selectedAccount)?.id ?? null;

  const amountMinorSafe = (() => {
    try {
      return majorToMinor(String(amount || "0").replace(/,/g, ""));
    } catch {
      return 0;
    }
  })();

  const destinationAccount =
    type === "TRANSFER"
      ? transferAccounts.find((item) => item.id === selectedDestination) ??
        bankAccounts.find((item) => item.id === selectedDestination) ??
        null
      : null;

  const bankPreview = useMemo(() => {
    if (!selectedBank) return null;
    const deltaMinor = type === "EXPENSE" || type === "TRANSFER" ? -amountMinorSafe : amountMinorSafe;
    return {
      deltaMinor,
      nextBalanceMinor: selectedBank.currentBalanceMinor + deltaMinor,
    };
  }, [amountMinorSafe, selectedBank, type]);

  const destPreview = useMemo(() => {
    if (type !== "TRANSFER" || !destinationAccount) return null;
    return {
      deltaMinor: amountMinorSafe,
      nextBalanceMinor: destinationAccount.currentBalanceMinor + amountMinorSafe,
    };
  }, [amountMinorSafe, destinationAccount, type]);

  const creditPreview = useMemo(() => {
    if (!selectedFacility) return null;
    const deltaMinor = creditSpendDelta(type, amountMinorSafe);
    const next = nextCreditBalances({
      usedMinor: selectedFacility.usedMinor,
      holdMinor: selectedFacility.holdMinor,
      limitMinor: selectedFacility.limitMinor,
      todaySpendMinor: selectedFacility.todaySpendMinor,
      overdueMinor: selectedFacility.overdueMinor,
      minDueMinor: selectedFacility.minDueMinor,
      deltaMinor,
    });
    return { ...next, deltaMinor, name: selectedFacility.name, dueOn: selectedFacility.dueOn };
  }, [amountMinorSafe, selectedFacility, type]);

  const selectPaymentMethod = (method: PaymentMethodType | "") => {
    setCreditFacilityId(null);
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
      const amountMinor = majorToMinor(amount.replace(/,/g, ""));
      if (!amountMinor || amountMinor <= 0) throw new Error("Enter a valid amount.");
      if (!selectedAccount) throw new Error("Choose an account.");
      if (isBankChannel && !selectedBank) {
        throw new Error("Select a saved bank account.");
      }
      if (type !== "TRANSFER" && !selectedCategory) {
        throw new Error("Choose a matching category.");
      }
      if (type === "TRANSFER" && (!selectedDestination || selectedDestination === selectedAccount)) {
        throw new Error("Choose a different destination account for this transfer.");
      }
      if (creditKind === "CARD" && !selectedFacility) {
        throw new Error("Choose a saved credit card for this payment.");
      }
      const transferCategory =
        (categories.data ?? []).find((c) => c.type === "TRANSFER")?.id ??
        (categories.data ?? []).find((c) => c.name === "Transfer")?.id ??
        selectedCategory;
      return transactionService.update(transaction.id, {
        amountMinor,
        merchant: merchant.trim() || null,
        notes: notes.trim() || null,
        type,
        accountId: selectedAccount,
        categoryId: type === "TRANSFER" ? transferCategory : selectedCategory,
        transactionAt: combineLocalDateTime(dateKey, timeKey),
        ...(type === "TRANSFER" ? { destinationAccountId: selectedDestination } : {}),
        ...(type !== "TRANSFER" && selectedFacility
          ? { creditFacilityId: selectedFacility.id }
          : type !== "TRANSFER"
            ? { creditFacilityId: null }
            : {}),
        ...(tagsTouched ? { tags } : {}),
      });
    },
    onSuccess: onSaved,
    onError: (e) => Alert.alert("Could not save", friendlyError(e)),
    onSettled: () => flight.end(),
  });

  if (accounts.isLoading || categories.isLoading || banks.isLoading) {
    return <LoadingBlock label="Loading edit options…" />;
  }

  return (
    <>
      <Text style={styles.title}>Edit transaction</Text>
      <Card style={styles.form}>
        <Field
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <Text style={styles.label}>TYPE</Text>
        <View style={styles.chips}>
          {(["INCOME", "EXPENSE", "TRANSFER"] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setType(value);
                setCategoryId((categories.data ?? []).find((c) => c.type === value)?.id ?? "");
                setCreditFacilityId(null);
              }}
              style={[styles.chip, type === value && styles.chipActive]}
            >
              <Text style={styles.chipText}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{type === "TRANSFER" ? "FROM ACCOUNT" : "ACCOUNT"}</Text>
        <Text style={styles.hint}>Choose the payment account this money moved through.</Text>
        <View style={styles.chips}>
          {channelOptions.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setChannelAccountId(item.id);
                setCreditFacilityId(null);
                if (item.type === "BANK" && bankAccounts[0]) setBankAccountId(bankAccounts[0].id);
                else setBankAccountId(null);
              }}
              style={[styles.chip, selectedChannel?.id === item.id && styles.chipActive]}
            >
              <Text style={styles.chipText}>{channelLabel(item)}</Text>
            </Pressable>
          ))}
        </View>

        {type !== "TRANSFER" ? (
          <>
            <Text style={styles.label}>PAYMENT METHOD</Text>
            <Text style={styles.hint}>
              Bank, UPI and credit card let you pick a saved account or card.
            </Text>
            <View style={styles.chips}>
              {(
                [
                  { value: "" as const, label: "Normal payment (cash, debit)" },
                  { value: "BANK" as const, label: "Bank" },
                  { value: "UPI" as const, label: "UPI" },
                  { value: "CREDIT_CARD" as const, label: "Credit card" },
                ] as const
              )
                .filter(
                  (item) =>
                    item.value === "" ||
                    channelOptions.some((channel) => channel.type === item.value),
                )
                .map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => selectPaymentMethod(item.value)}
                    style={[styles.chip, paymentMethod === item.value && styles.chipActive]}
                  >
                    <Text style={styles.chipText}>{item.label}</Text>
                  </Pressable>
                ))}
            </View>
          </>
        ) : null}

        {isBankChannel ? (
          <>
            <Text style={styles.label}>BANK ACCOUNT</Text>
            <Text style={styles.hint}>
              Pick the saved bank account. Expense deducts balance; income increases it.
            </Text>
            {bankAccounts.length ? (
              <View style={styles.chips}>
                {bankAccounts.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setBankAccountId(item.id)}
                    style={[styles.chip, activeBankId === item.id && styles.chipActive]}
                  >
                    <Text style={styles.chipText} numberOfLines={2}>
                      {bankAccountLabel(item)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.hint}>Add a bank account first.</Text>
            )}
            {selectedBank && bankPreview ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>{bankAccountName(selectedBank)}</Text>
                <Text style={styles.previewBody}>
                  {type === "EXPENSE" && bankPreview.deltaMinor < 0
                    ? `${money(Math.abs(bankPreview.deltaMinor), currency)} will be deducted from this account. `
                    : type === "TRANSFER" && bankPreview.deltaMinor < 0
                      ? `${money(Math.abs(bankPreview.deltaMinor), currency)} will leave this account. `
                      : type === "INCOME" && bankPreview.deltaMinor > 0
                        ? `${money(bankPreview.deltaMinor, currency)} will be added to this account. `
                        : ""}
                  Available balance will be {money(bankPreview.nextBalanceMinor, currency)}.
                  {destPreview
                    ? ` Destination balance will be ${money(destPreview.nextBalanceMinor, currency)}.`
                    : ""}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {type === "TRANSFER" ? (
          <>
            <Text style={styles.label}>TO ACCOUNT</Text>
            <View style={styles.chips}>
              {transferAccounts
                .filter((item) => item.id !== selectedAccount)
                .map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setDestinationId(item.id)}
                    style={[styles.chip, selectedDestination === item.id && styles.chipActive]}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {item.type === "BANK" && item.institutionName
                        ? bankAccountName(item)
                        : channelLabel(item)}
                    </Text>
                  </Pressable>
                ))}
            </View>
            {destinationAccount && destPreview && !isBankChannel ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  {destinationAccount.type === "BANK"
                    ? bankAccountName(destinationAccount)
                    : channelLabel(destinationAccount)}
                </Text>
                <Text style={styles.previewBody}>
                  {money(destPreview.deltaMinor, currency)} will be added to this account. Available
                  balance will be {money(destPreview.nextBalanceMinor, currency)}.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chips}>
              {matchingCategories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.chip, selectedCategory === c.id && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{categoryLabel(c, categories.data ?? [])}</Text>
                </Pressable>
              ))}
            </View>
            {creditKind === "CARD" ? (
              <>
                <Text style={styles.label}>CREDIT CARD</Text>
                <Text style={styles.hint}>
                  {type === "INCOME"
                    ? "Pick the saved card. This income / repayment reduces used credit."
                    : "Pick the saved card. This amount comes off that card’s available limit."}
                </Text>
                {creditOptions.length ? (
                  <View style={styles.chips}>
                    {creditOptions.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => setCreditFacilityId(item.id)}
                        style={[
                          styles.chip,
                          (selectedFacility?.id ?? null) === item.id && styles.chipActive,
                        ]}
                      >
                        <Text style={styles.chipText} numberOfLines={2}>
                          {facilityLabel(item, { withAvailable: true })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hint}>No saved cards yet.</Text>
                )}
                {selectedFacility && creditPreview ? (
                  <View style={styles.preview}>
                    <Text style={styles.previewTitle}>{facilityLabel(selectedFacility)}</Text>
                    <Text style={styles.previewBody}>
                      {type === "EXPENSE" && creditPreview.deltaMinor > 0
                        ? `${money(creditPreview.deltaMinor, currency)} will be deducted from this card. `
                        : type === "INCOME" && creditPreview.deltaMinor < 0
                          ? `${money(Math.abs(creditPreview.deltaMinor), currency)} will reduce used credit on this card. `
                          : ""}
                      Available will be {money(creditPreview.availableMinor, currency)}. Pending{" "}
                      {money(creditPreview.pendingMinor, currency)}
                      {creditPreview.dueOn ? ` · due ${formatDisplayDate(creditPreview.dueOn)}` : ""}
                      .
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
            {creditKind === "UPI" ? (
              <>
                <Text style={styles.label}>UPI CREDIT LINE</Text>
                <Text style={styles.hint}>
                  Only UPI Credit is deducted. Regular UPI stays a normal payment.
                </Text>
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => setCreditFacilityId(null)}
                    style={[styles.chip, !selectedFacility && styles.chipActive]}
                  >
                    <Text style={styles.chipText}>Regular UPI — do not use credit</Text>
                  </Pressable>
                  {creditOptions.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setCreditFacilityId(item.id)}
                      style={[
                        styles.chip,
                        (selectedFacility?.id ?? null) === item.id && styles.chipActive,
                      ]}
                    >
                      <Text style={styles.chipText} numberOfLines={2}>
                        {facilityLabel(item, { withAvailable: true })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {selectedFacility && creditPreview ? (
                  type === "EXPENSE" && creditPreview.deltaMinor > 0 ? (
                    <View style={styles.preview}>
                      <Text style={styles.previewTitle}>{facilityLabel(selectedFacility)}</Text>
                      <Text style={styles.previewBody}>
                        {money(creditPreview.deltaMinor, currency)} will be deducted from this UPI
                        credit line. Available will be{" "}
                        {money(creditPreview.availableMinor, currency)}.
                      </Text>
                    </View>
                  ) : type === "INCOME" && creditPreview.deltaMinor < 0 ? (
                    <View style={styles.preview}>
                      <Text style={styles.previewTitle}>{facilityLabel(selectedFacility)}</Text>
                      <Text style={styles.previewBody}>
                        {money(Math.abs(creditPreview.deltaMinor), currency)} will reduce used credit
                        on this UPI credit line. Available will be{" "}
                        {money(creditPreview.availableMinor, currency)}.
                      </Text>
                    </View>
                  ) : null
                ) : null}
              </>
            ) : null}
          </>
        )}

        <TransactionDateTimeField
          dateKey={dateKey}
          timeKey={timeKey}
          onChange={({ dateKey: nextDate, timeKey: nextTime }) => {
            setDateKey(nextDate);
            setTimeKey(nextTime);
          }}
        />
        <Field
          label="Merchant"
          placeholder="Merchant or description"
          value={merchant}
          onChangeText={setMerchant}
        />
        <Field label="Notes" placeholder="Optional notes" value={notes} onChangeText={setNotes} />
        <TagPicker
          value={tags}
          onChange={(next) => {
            setTags(next);
            setTagsTouched(true);
          }}
        />
        <AppButton
          label={save.isPending ? "Saving…" : "Save changes"}
          disabled={save.isPending}
          onPress={() => {
            Keyboard.dismiss();
            flight.run(save.isPending, () => save.mutate());
          }}
        />
        <AppButton label="Cancel" outline onPress={onCancel} />
      </Card>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.detail}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 18, gap: 13 },
  title: { color: colors.white, fontSize: 28, fontWeight: "900" },
  hero: { gap: 8, backgroundColor: colors.panel2 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  amount: { fontWeight: "900", fontSize: 32 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  detail: { gap: 6, padding: 14 },
  value: { color: colors.white, fontWeight: "700" },
  form: { gap: 14 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontSize: 11, fontWeight: "800", flexShrink: 1 },
  preview: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: colors.panel2,
  },
  previewTitle: { color: colors.white, fontWeight: "800", fontSize: 13 },
  previewBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
