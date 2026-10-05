import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { majorToMinor } from "@hisaab/validation";
import { colors } from "../../theme/tokens";
import type { MainTabParamList } from "../../navigation/types";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { ApiError } from "../../services/api-client";
import { accountService } from "../../services/account.service";
import { categoryService } from "../../services/category.service";
import { profileService } from "../../services/profile.service";
import { transactionService } from "../../services/transaction.service";

type Props = BottomTabScreenProps<MainTabParamList, "Add">;
const kinds = ["Expense", "Income", "Transfer"] as const;

export function AddTransactionScreen({ navigation }: Props) {
  const client = useQueryClient();
  const [kind, setKind] = useState<(typeof kinds)[number]>("Expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => accountService.list() });
  const categories = useQuery({ queryKey: ["categories"], queryFn: () => categoryService.list() });

  const type = kind === "Income" ? "INCOME" : kind === "Transfer" ? "TRANSFER" : "EXPENSE";
  const filteredCategories = useMemo(() => {
    const rows = categories.data ?? [];
    if (type === "TRANSFER") return rows;
    return rows.filter((item) => item.type === type);
  }, [categories.data, type]);

  const activeAccounts = useMemo(
    () => (accounts.data ?? []).filter((item) => item.isActive),
    [accounts.data],
  );

  const selectedAccount = accountId ?? activeAccounts[0]?.id ?? null;
  const selectedCategory = categoryId ?? filteredCategories[0]?.id ?? null;
  const selectedDestination =
    destinationId ?? activeAccounts.find((item) => item.id !== selectedAccount)?.id ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedAccount) throw new Error("Add an account first.");
      if (!selectedCategory && type !== "TRANSFER") throw new Error("Pick a category.");
      if (type === "TRANSFER" && !selectedDestination) {
        throw new Error("Pick a destination account.");
      }
      const amountMinor = majorToMinor(amount.replace(/,/g, ""));
      if (!amountMinor || amountMinor <= 0) throw new Error("Enter a valid amount.");
      const category =
        selectedCategory ??
        filteredCategories[0]?.id ??
        (categories.data ?? []).find((item) => item.type === "EXPENSE")?.id;
      if (!category) throw new Error("No categories available.");
      return transactionService.create({
        accountId: selectedAccount,
        categoryId: category,
        type,
        amountMinor,
        currency: profile.data?.defaultCurrency ?? "INR",
        merchant: note.trim() || null,
        notes: note.trim() || null,
        transactionAt: new Date().toISOString(),
        ...(type === "TRANSFER" ? { destinationAccountId: selectedDestination } : {}),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["transactions"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["accounts"] }),
      ]);
      Alert.alert("Saved", "Your transaction was added.");
      navigation.navigate("Transactions");
    },
    onError: (error) => {
      Alert.alert(
        "Could not save",
        error instanceof ApiError || error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  if (accounts.isLoading || categories.isLoading) {
    return (
      <Screen>
        <Header title="Add Transaction" subtitle="Choose what you want to add" />
        <LoadingBlock />
      </Screen>
    );
  }

  if (!activeAccounts.length) {
    return (
      <Screen>
        <Header title="Add Transaction" subtitle="Choose what you want to add" />
        <ErrorBlock message="No accounts yet. Open Finance tools to review accounts." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Add Transaction" subtitle="Synced to your Hisaab account" />
      <View style={styles.filters}>
        {kinds.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setKind(item);
              setCategoryId(null);
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
        <Text style={styles.pickerLabel}>Account</Text>
        <View style={styles.chips}>
          {activeAccounts.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setAccountId(item.id)}
              style={[styles.chip, selectedAccount === item.id && styles.chipOn]}
            >
              <Text style={styles.chipText}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        {type === "TRANSFER" ? (
          <>
            <Text style={styles.pickerLabel}>To account</Text>
            <View style={styles.chips}>
              {activeAccounts
                .filter((item) => item.id !== selectedAccount)
                .map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => setDestinationId(item.id)}
                    style={[styles.chip, selectedDestination === item.id && styles.chipOn]}
                  >
                    <Text style={styles.chipText}>{item.name}</Text>
                  </Pressable>
                ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.pickerLabel}>Category</Text>
            <View style={styles.chips}>
              {filteredCategories.slice(0, 12).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setCategoryId(item.id)}
                  style={[styles.chip, selectedCategory === item.id && styles.chipOn]}
                >
                  <Text style={styles.chipText}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Field label="Note" placeholder="Add an optional note" value={note} onChangeText={setNote} />
        <AppButton
          label={save.isPending ? "Saving…" : "Save transaction"}
          onPress={() => save.mutate()}
        />
      </Card>
      <SectionTitle title="Tip" />
      <Text style={styles.tip}>
        Amounts are saved in {profile.data?.defaultCurrency ?? "INR"} and update balances instantly.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  kind: {
    flex: 1,
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.panel2,
  },
  chipOn: { borderColor: colors.green, backgroundColor: "#0B3A2C" },
  chipText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  tip: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
