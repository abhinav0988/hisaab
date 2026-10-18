import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { creditSpendDelta, majorToMinor, nextCreditBalances } from "@hisaab/validation";
import type { CreditFacility } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { TransactionDateTimeField } from "../../components/finance/transaction-datetime-field";
import { TagPicker } from "../../components/finance/tag-picker";
import { ApiError } from "../../services/api-client";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { financeService } from "../../services/finance.service";
import { profileService } from "../../services/profile.service";
import { transactionService } from "../../services/transaction.service";
import { fileService } from "../../services/file.service";
import {
  nativePickerService,
  type PickedNativeFile,
} from "../../services/native-picker.service";
import {
  bankAccountLabel,
  channelLabel,
  isPaymentMethodType,
  type PaymentMethodType,
  uniqueCatalogChannels,
} from "../../lib/accounts";
import { categoryLabel } from "../../lib/categories";
import {
  combineLocalDateTime,
  formatDisplayDate,
  localDateKey,
  localTimeKey,
} from "../../lib/datetime";
import { creditKindForAccount, facilityLabel } from "../../lib/credit";
import { money } from "../../lib/format";
import { useSingleFlight } from "../../lib/single-flight";

type Props = NativeStackScreenProps<AppStackParamList, "AddTransaction">;
const kinds = ["Expense", "Income", "Transfer"] as const;

function newIdempotencyKey() {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AddTransactionScreen({ navigation, route }: Props) {
  const client = useQueryClient();
  const flight = useSingleFlight();
  const idempotencyKey = useRef(newIdempotencyKey());
  const initialKind =
    route.params?.kind === "INCOME"
      ? "Income"
      : route.params?.kind === "TRANSFER"
        ? "Transfer"
        : "Expense";
  const [kind, setKind] = useState<(typeof kinds)[number]>(initialKind);
  const [amount, setAmount] = useState(route.params?.amount ?? "");
  const [merchant, setMerchant] = useState(route.params?.note ?? "");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [channelAccountId, setChannelAccountId] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [creditFacilityId, setCreditFacilityId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState(localDateKey());
  const [timeKey, setTimeKey] = useState(localTimeKey());
  const [categoryQuery, setCategoryQuery] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PickedNativeFile[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [prefillsReady, setPrefillsReady] = useState(!route.params?.accountId);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const banks = useQuery({ queryKey: ["account-banks"], queryFn: () => accountService.listBanks() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
  });

  const type = kind === "Income" ? "INCOME" : kind === "Transfer" ? "TRANSFER" : "EXPENSE";
  const currency = profile.data?.defaultCurrency ?? "INR";
  const filteredCategories = useMemo(() => {
    const rows = categories.data ?? [];
    if (type === "TRANSFER") return rows.filter((item) => item.type === "TRANSFER" || item.name === "Transfer");
    return rows.filter((item) => item.type === type);
  }, [categories.data, type]);

  const visibleCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return filteredCategories;
    return filteredCategories.filter((item) => item.name.toLowerCase().includes(q));
  }, [filteredCategories, categoryQuery]);

  const channelOptions = useMemo(
    () => uniqueCatalogChannels(accounts.data ?? []),
    [accounts.data],
  );
  const bankAccounts = useMemo(
    () => (banks.data ?? []).filter((item) => item.isActive),
    [banks.data],
  );

  useEffect(() => {
    if (prefillsReady || !accounts.data) return;
    const prefillsId = route.params?.accountId;
    if (!prefillsId) {
      setPrefillsReady(true);
      return;
    }
    const bankMatch = bankAccounts.find((item) => item.id === prefillsId);
    const accountMatch = (accounts.data ?? []).find((item) => item.id === prefillsId);
    if (bankMatch || accountMatch?.type === "BANK") {
      setChannelAccountId(channelOptions.find((item) => item.type === "BANK")?.id ?? null);
      setBankAccountId(prefillsId);
    } else {
      const byType = accountMatch
        ? channelOptions.find((item) => item.type === accountMatch.type)
        : null;
      setChannelAccountId(byType?.id ?? channelOptions[0]?.id ?? null);
      setBankAccountId(null);
    }
    setPrefillsReady(true);
  }, [
    accounts.data,
    bankAccounts,
    channelOptions,
    prefillsReady,
    route.params?.accountId,
  ]);
  const transferAccounts = useMemo(() => {
    const channels = channelOptions.filter((item) => item.type !== "BANK");
    const merged = [...channels, ...bankAccounts];
    const catalogBank = channelOptions.find((item) => item.type === "BANK");
    if (catalogBank && !merged.some((item) => item.id === catalogBank.id)) merged.push(catalogBank);
    return merged;
  }, [channelOptions, bankAccounts]);

  const selectedChannel =
    channelOptions.find((item) => item.id === channelAccountId) ??
    channelOptions.find((item) => item.type === "CASH") ??
    channelOptions[0] ??
    null;
  const isBankChannel = selectedChannel?.type === "BANK";
  const activeBankId =
    isBankChannel ? bankAccountId ?? bankAccounts[0]?.id ?? null : null;
  const selectedBank = bankAccounts.find((item) => item.id === activeBankId) ?? null;
  const selectedAccount = isBankChannel ? activeBankId : selectedChannel?.id ?? null;
  const paymentMethod: PaymentMethodType | "" =
    selectedChannel && isPaymentMethodType(selectedChannel.type) ? selectedChannel.type : "";

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
  const selectedCategory = categoryId ?? filteredCategories[0]?.id ?? null;
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

  const pickReceiptFrom = (source: "camera" | "gallery" | "document") => {
    if (attachBusy || save.isPending) return;
    setAttachBusy(true);
    void (async () => {
      try {
        const picked =
          source === "camera"
            ? await nativePickerService.takePhoto()
            : source === "gallery"
              ? await nativePickerService.pickImage()
              : await nativePickerService.pickDocument();
        if (!picked) return;
        if (picked.size != null && picked.size > 8 * 1024 * 1024) {
          throw new Error("File is larger than 8 MB.");
        }
        setPendingFiles((current) => [...current, picked]);
      } catch (error) {
        Alert.alert(
          "Could not add receipt",
          error instanceof Error ? error.message : "Try again.",
        );
      } finally {
        setAttachBusy(false);
      }
    })();
  };

  const pickReceipt = () => {
    if (attachBusy || save.isPending) return;
    Alert.alert("Add receipt", "Choose where the receipt comes from.", [
      { text: "Camera", onPress: () => pickReceiptFrom("camera") },
      { text: "Gallery", onPress: () => pickReceiptFrom("gallery") },
      { text: "Documents", onPress: () => pickReceiptFrom("document") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedAccount) throw new Error("Add an account first.");
      if (isBankChannel && !selectedBank) {
        throw new Error("Select a saved bank account. Expenses deduct and income credits that account.");
      }
      if (type !== "TRANSFER" && !selectedCategory) throw new Error("Pick a category.");
      if (type === "TRANSFER" && !selectedDestination) {
        throw new Error("Pick a destination account.");
      }
      if (type === "TRANSFER" && selectedDestination === selectedAccount) {
        throw new Error("Source and destination accounts must be different.");
      }
      if (creditKind === "CARD" && !creditOptions.length) {
        throw new Error(
          type === "INCOME"
            ? "Add a credit card under My Cards before recording a payment to it."
            : "Add a credit card under My Cards before charging this account.",
        );
      }
      if (creditKind === "CARD" && !selectedFacility) {
        throw new Error(
          type === "INCOME"
            ? "Choose a saved credit card for this income / repayment."
            : "Choose a saved credit card for this payment.",
        );
      }
      const amountMinor = majorToMinor(amount.replace(/,/g, ""));
      if (!amountMinor || amountMinor <= 0) throw new Error("Enter a valid amount.");
      const category =
        type === "TRANSFER"
          ? (filteredCategories[0]?.id ??
            (categories.data ?? []).find((item) => item.name === "Transfer")?.id ??
            (categories.data ?? []).find((item) => item.type === "EXPENSE")?.id)
          : selectedCategory;
      if (!category) throw new Error("No categories available. Create one in Categories first.");
      const transactionAt = combineLocalDateTime(dateKey, timeKey);
      const created = await transactionService.create(
        {
          accountId: selectedAccount,
          categoryId: category,
          type,
          amountMinor,
          currency,
          merchant: merchant.trim() || null,
          notes: note.trim() || null,
          tags,
          transactionAt,
          ...(type === "TRANSFER" ? { destinationAccountId: selectedDestination } : {}),
          ...(selectedFacility && type !== "TRANSFER"
            ? { creditFacilityId: selectedFacility.id }
            : {}),
        },
        idempotencyKey.current,
      );
      for (const file of pendingFiles) {
        const stored = await fileService.upload(file);
        await transactionService.attach(created.id, stored.id);
      }
      return { created, bankPreview, selectedBank, creditPreview, selectedFacility };
    },
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["transactions"] }),
        client.invalidateQueries({ queryKey: ["tags"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["accounts"] }),
        client.invalidateQueries({ queryKey: ["account-banks"] }),
        client.invalidateQueries({ queryKey: ["budgets"] }),
        client.invalidateQueries({ queryKey: ["reports"] }),
        client.invalidateQueries({ queryKey: ["credit-facilities"] }),
      ]);
      idempotencyKey.current = newIdempotencyKey();
      let detail = "Your transaction was added.";
      if (result.selectedBank && result.bankPreview && !result.selectedFacility) {
        const abs = money(Math.abs(result.bankPreview.deltaMinor), currency);
        const next = money(result.bankPreview.nextBalanceMinor, currency);
        const label = bankAccountLabel(result.selectedBank);
        if (result.bankPreview.deltaMinor < 0) {
          detail = `${abs} deducted from ${label}. Available balance ${next}.`;
        } else if (result.bankPreview.deltaMinor > 0) {
          detail = `${abs} added to ${label}. Available balance ${next}.`;
        }
      } else if (result.selectedFacility && result.creditPreview) {
        const avail = money(result.creditPreview.availableMinor, currency);
        const label = facilityLabel(result.selectedFacility);
        if (result.creditPreview.deltaMinor > 0) {
          detail = `${money(result.creditPreview.deltaMinor, currency)} deducted from ${label}. Available ${avail}.`;
        } else if (result.creditPreview.deltaMinor < 0) {
          detail = `${money(Math.abs(result.creditPreview.deltaMinor), currency)} reduced used credit on ${label}. Available ${avail}.`;
        }
      }
      Alert.alert("Saved", detail);
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert(
        "Could not save",
        error instanceof ApiError || error instanceof Error ? error.message : "Try again.",
      );
    },
    onSettled: () => flight.end(),
  });

  const goBack = () => navigation.goBack();

  if (accounts.isLoading || categories.isLoading || banks.isLoading) {
    return (
      <Screen onBack={goBack}>
        <Header title="Add Transaction" subtitle="Choose what you want to add" />
        <LoadingBlock />
      </Screen>
    );
  }

  if (!channelOptions.length && !bankAccounts.length) {
    return (
      <Screen onBack={goBack}>
        <Header title="Add Transaction" subtitle="Choose what you want to add" />
        <ErrorBlock message="No accounts yet. Open Finance tools to add an account first." />
        <AppButton label="Go to Accounts" outline onPress={() => navigation.navigate("Accounts")} />
      </Screen>
    );
  }

  return (
    <Screen onBack={goBack}>
      <Header title="Add Transaction" subtitle="Synced to your Hisaab account" />
      <View style={styles.filters}>
        {kinds.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setKind(item);
              setCategoryId(null);
              setCategoryQuery("");
              setCreditFacilityId(null);
            }}
            style={[styles.kind, kind === item && styles.kindActive]}
          >
            <Icon
              name={
                item === "Expense" ? "arrow-down" : item === "Income" ? "arrow-up" : "swap-horizontal"
              }
              color={kind === item ? colors.green : colors.muted}
            />
            <Text style={styles.itemTitle}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ gap: 18 }}>
        <Field
          label="Amount"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TransactionDateTimeField
          dateKey={dateKey}
          timeKey={timeKey}
          onChange={({ dateKey: nextDate, timeKey: nextTime }) => {
            setDateKey(nextDate);
            setTimeKey(nextTime);
          }}
        />
        <Text style={styles.pickerLabel}>{type === "TRANSFER" ? "From account" : "Account"}</Text>
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
              style={[styles.chip, selectedChannel?.id === item.id && styles.chipOn]}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {channelLabel(item)}
              </Text>
            </Pressable>
          ))}
        </View>

        {type !== "TRANSFER" ? (
          <>
            <Text style={styles.pickerLabel}>Payment method</Text>
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
                    style={[styles.chip, paymentMethod === item.value && styles.chipOn]}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </>
        ) : null}

        {isBankChannel ? (
          <>
            <Text style={styles.pickerLabel}>Bank account</Text>
            <Text style={styles.hint}>
              Pick the saved bank account. Expense deducts balance; income increases it.
            </Text>
            {bankAccounts.length ? (
              <View style={styles.chips}>
                {bankAccounts.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setBankAccountId(item.id)}
                    style={[styles.chip, activeBankId === item.id && styles.chipOn]}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {bankAccountLabel(item)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={styles.tip}>
                  Add a bank account first, then pick which one this transaction affects.
                </Text>
                <AppButton
                  label="Open Accounts"
                  outline
                  onPress={() => navigation.navigate("Accounts")}
                />
              </View>
            )}
            {selectedBank && bankPreview ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>{bankAccountLabel(selectedBank)}</Text>
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
            <Text style={styles.pickerLabel}>To account</Text>
            <View style={styles.chips}>
              {transferAccounts
                .filter((item) => item.id !== selectedAccount)
                .map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setDestinationId(item.id)}
                    style={[styles.chip, selectedDestination === item.id && styles.chipOn]}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {item.type === "BANK" && item.institutionName
                        ? bankAccountLabel(item)
                        : channelLabel(item)}
                    </Text>
                  </Pressable>
                ))}
            </View>
            {!transferAccounts.some((item) => item.id !== selectedAccount) ? (
              <Text style={styles.tip}>Add another account before creating a transfer.</Text>
            ) : null}
            {destinationAccount && destPreview && !isBankChannel ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>
                  {destinationAccount.type === "BANK" && destinationAccount.institutionName
                    ? bankAccountLabel(destinationAccount)
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
            <Text style={styles.pickerLabel}>Category</Text>
            {filteredCategories.length > 8 ? (
              <TextInput
                value={categoryQuery}
                onChangeText={setCategoryQuery}
                placeholder="Search categories"
                placeholderTextColor={colors.muted}
                style={styles.search}
              />
            ) : null}
            {!filteredCategories.length ? (
              <View style={{ gap: 10 }}>
                <Text style={styles.tip}>No {type.toLowerCase()} categories yet.</Text>
                <AppButton
                  label="Manage categories"
                  outline
                  onPress={() => navigation.navigate("Categories")}
                />
              </View>
            ) : (
              <View style={styles.chips}>
                {visibleCategories.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setCategoryId(item.id)}
                    style={[styles.chip, selectedCategory === item.id && styles.chipOn]}
                  >
                    <Text style={styles.chipText} numberOfLines={1}>
                      {categoryLabel(item, categories.data ?? [])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {creditKind === "CARD" ? (
              <>
                <Text style={styles.pickerLabel}>Credit card</Text>
                <Text style={styles.hint}>
                  {type === "INCOME"
                    ? "Pick the saved card. This income / repayment reduces used credit on that card."
                    : "Pick the saved card. This amount comes off that card’s available limit."}
                </Text>
                {facilities.isLoading ? (
                  <Text style={styles.tip}>Loading facilities…</Text>
                ) : creditOptions.length ? (
                  <View style={styles.chips}>
                    {creditOptions.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => setCreditFacilityId(item.id)}
                        style={[
                          styles.chip,
                          (selectedFacility?.id ?? null) === item.id && styles.chipOn,
                        ]}
                      >
                        <Text style={styles.chipText} numberOfLines={1}>
                          {facilityLabel(item)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.tip}>
                      No saved cards yet. Add one under My Cards to track limit usage.
                    </Text>
                    <AppButton
                      label="Open My Cards"
                      outline
                      onPress={() => navigation.navigate("CreditCards")}
                    />
                  </View>
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
                <Text style={styles.pickerLabel}>UPI credit line</Text>
                <Text style={styles.hint}>
                  {type === "INCOME"
                    ? "Only UPI Credit is adjusted. Regular UPI stays a normal payment."
                    : "Only UPI Credit is deducted. Regular UPI stays a normal payment."}
                </Text>
                <View style={styles.chips}>
                  <Pressable
                    onPress={() => setCreditFacilityId(null)}
                    style={[styles.chip, !selectedFacility && styles.chipOn]}
                  >
                    <Text style={styles.chipText}>Regular UPI — do not use credit</Text>
                  </Pressable>
                  {creditOptions.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => setCreditFacilityId(item.id)}
                      style={[
                        styles.chip,
                        (selectedFacility?.id ?? null) === item.id && styles.chipOn,
                      ]}
                    >
                      <Text style={styles.chipText} numberOfLines={1}>
                        {facilityLabel(item)}
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
        <Field
          label={type === "INCOME" ? "Source / payer" : "Merchant / payee"}
          placeholder={type === "INCOME" ? "Salary, client…" : "Store or person"}
          value={merchant}
          onChangeText={setMerchant}
        />
        <Field label="Note" placeholder="Add an optional note" value={note} onChangeText={setNote} />
        <TagPicker value={tags} onChange={setTags} />
        <Text style={styles.pickerLabel}>Receipts (optional)</Text>
        {pendingFiles.length ? (
          <View style={{ gap: 6 }}>
            {pendingFiles.map((file, index) => (
              <View key={`${file.uri}-${index}`} style={styles.fileRow}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    setPendingFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.tip}>JPEG, PNG, or PDF up to 8 MB. Attached after save.</Text>
        )}
        <AppButton
          label={attachBusy ? "Opening…" : "Add receipt"}
          icon="attach-outline"
          outline
          disabled={attachBusy || save.isPending}
          onPress={pickReceipt}
        />
        <AppButton
          label={save.isPending ? "Saving…" : "Save transaction"}
          disabled={save.isPending || attachBusy}
          onPress={() => flight.run(save.isPending, () => save.mutate())}
        />
      </Card>
      <SectionTitle title="Tip" />
      <Text style={styles.tip}>
        Amounts are saved in {currency}. Date and time use your device timezone. Rapid taps are
        ignored while saving.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  kind: {
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 96,
    alignItems: "center",
    gap: 6,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  kindActive: { backgroundColor: colors.panel2, borderColor: colors.green },
  itemTitle: { color: colors.white, fontSize: 14, fontWeight: "800" },
  pickerLabel: { color: colors.white, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: -6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel2,
    maxWidth: "100%",
  },
  chipOn: { borderColor: colors.green, backgroundColor: "#0B3A2C" },
  chipText: { color: colors.white, fontSize: 12, fontWeight: "700", flexShrink: 1 },
  search: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    backgroundColor: colors.panel2,
  },
  tip: { color: colors.muted, fontSize: 13, lineHeight: 18 },
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
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 4,
  },
  remove: { color: colors.red, fontWeight: "800", fontSize: 12 },
});
