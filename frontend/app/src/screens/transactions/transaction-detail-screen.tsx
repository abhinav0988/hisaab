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
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { majorToMinor } from "@hisaab/validation";
import type { CreditFacility } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { categoryLabel } from "../../lib/categories";
import { signedMoney } from "../../lib/format";
import { combineLocalDateTime, localDateKey, localTimeKey } from "../../lib/datetime";
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
  const [accountId, setAccountId] = useState(transaction.accountId);
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  const [destinationAccountId, setDestinationAccountId] = useState(
    transaction.destinationAccountId ?? null,
  );
  const [creditFacilityId, setCreditFacilityId] = useState<string | null>(
    transaction.creditFacilityId ?? null,
  );
  const [dateKey, setDateKey] = useState(localDateKey(transaction.transactionAt));
  const [timeKey, setTimeKey] = useState(localTimeKey(transaction.transactionAt));
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: accountService.list });
  const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const facilities = useQuery({
    queryKey: ["credit-facilities"],
    queryFn: () => financeService.listCreditFacilities(),
  });
  const matchingCategories = (categories.data ?? []).filter((c) => c.type === type);
  const accountRow = (accounts.data ?? []).find((a) => a.id === accountId);
  const creditKind = type !== "TRANSFER" ? creditKindForAccount(accountRow?.type) : null;
  const creditOptions = useMemo(
    () =>
      creditKind
        ? ((facilities.data ?? []) as CreditFacility[]).filter((item) => item.kind === creditKind)
        : [],
    [creditKind, facilities.data],
  );
  const selectedFacility =
    creditOptions.find((item) => item.id === creditFacilityId) ??
    creditOptions.find((item) => item.accountId === accountId) ??
    creditOptions[0] ??
    null;

  const save = useMutation({
    mutationFn: () => {
      const amountMinor = majorToMinor(amount.replace(/,/g, ""));
      if (!amountMinor || amountMinor <= 0) throw new Error("Enter a valid amount.");
      if (!accountId || !categoryId) throw new Error("Choose an account and matching category.");
      if (type === "TRANSFER" && (!destinationAccountId || destinationAccountId === accountId)) {
        throw new Error("Choose a different destination account for this transfer.");
      }
      return transactionService.update(transaction.id, {
        amountMinor,
        merchant: merchant.trim() || null,
        notes: notes.trim() || null,
        type,
        accountId,
        categoryId,
        transactionAt: combineLocalDateTime(dateKey, timeKey),
        // Omit destination for non-transfers — server clears when type is not TRANSFER.
        ...(type === "TRANSFER" ? { destinationAccountId } : {}),
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

  if (accounts.isLoading || categories.isLoading) return <LoadingBlock label="Loading edit options…" />;

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
        <Text style={styles.label}>ACCOUNT</Text>
        <View style={styles.chips}>
          {(accounts.data ?? [])
            .filter((a) => a.isActive)
            .map((a) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  setAccountId(a.id);
                  setCreditFacilityId(null);
                  if (destinationAccountId === a.id) setDestinationAccountId(null);
                }}
                style={[styles.chip, accountId === a.id && styles.chipActive]}
              >
                <Text style={styles.chipText}>{a.name}</Text>
              </Pressable>
            ))}
        </View>
        {type === "TRANSFER" ? (
          <>
            <Text style={styles.label}>DESTINATION ACCOUNT</Text>
            <View style={styles.chips}>
              {(accounts.data ?? [])
                .filter((a) => a.isActive && a.id !== accountId)
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => setDestinationAccountId(a.id)}
                    style={[styles.chip, destinationAccountId === a.id && styles.chipActive]}
                  >
                    <Text style={styles.chipText}>{a.name}</Text>
                  </Pressable>
                ))}
            </View>
          </>
        ) : null}
        {type !== "TRANSFER" ? (
          <>
            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chips}>
              {matchingCategories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.chip, categoryId === c.id && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{categoryLabel(c, categories.data ?? [])}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {creditKind && creditOptions.length ? (
          <>
            <Text style={styles.label}>{creditKind === "CARD" ? "CREDIT CARD" : "UPI CREDIT"}</Text>
            <View style={styles.chips}>
              {creditOptions.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setCreditFacilityId(item.id)}
                  style={[styles.chip, selectedFacility?.id === item.id && styles.chipActive]}
                >
                  <Text style={styles.chipText}>{facilityLabel(item)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontSize: 11, fontWeight: "800" },
});
