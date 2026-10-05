import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { majorToMinor } from "@hisaab/validation";
import { colors } from "../../theme/tokens";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { SectionTitle } from "../../components/ui/section-title";
import { ApiError } from "../../services/api-client";
import { accountService } from "../../services/account.service";
import { budgetService } from "../../services/budget.service";
import { financeService } from "../../services/finance.service";
import { goalService } from "../../services/goal.service";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function FeatureCreateForm({
  toolId,
  currency,
}: {
  toolId: string;
  currency: string;
}) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [secondary, setSecondary] = useState("");
  const [amount, setAmount] = useState("");

  const creatable = ["accounts", "bank", "goals", "budgets", "investments", "lend"].includes(toolId);
  if (!creatable) return null;

  const labels =
    toolId === "goals"
      ? { title: "Add goal", name: "Goal name", secondary: "Saved so far", amount: "Target amount" }
      : toolId === "budgets"
        ? { title: "Add budget", name: "Label (optional)", secondary: "", amount: "Monthly limit" }
        : toolId === "investments"
          ? { title: "Add investment", name: "Holding name", secondary: "Type (MF/Stock/Gold)", amount: "Invested" }
          : toolId === "lend"
            ? { title: "Add lend record", name: "Person", secondary: "Relation", amount: "Amount" }
            : { title: "Add bank account", name: "Account nickname", secondary: "Bank / institution", amount: "Opening balance" };

  const save = useMutation({
    mutationFn: async () => {
      const amountMinor = majorToMinor(amount.replace(/,/g, "")) ?? 0;
      if (toolId === "accounts" || toolId === "bank") {
        if (!name.trim() || !secondary.trim()) throw new Error("Enter account name and bank.");
        return accountService.createBank({
          name: name.trim(),
          type: "BANK",
          institutionName: secondary.trim(),
          openingBalanceMinor: amountMinor,
          currency,
          isActive: true,
        });
      }
      if (toolId === "goals") {
        if (!name.trim() || amountMinor <= 0) throw new Error("Enter goal name and target.");
        return goalService.create({
          name: name.trim(),
          icon: "*",
          targetAmountMinor: amountMinor,
          savedAmountMinor: majorToMinor(secondary.replace(/,/g, "")) ?? 0,
          currency,
        });
      }
      if (toolId === "budgets") {
        if (amountMinor <= 0) throw new Error("Enter a monthly limit.");
        return budgetService.create({
          categoryId: null,
          month: currentMonth(),
          amountMinor,
          alertPercentage: 80,
        });
      }
      if (toolId === "investments") {
        if (!name.trim() || amountMinor <= 0) throw new Error("Enter holding and amount.");
        return financeService.createInvestment({
          name: name.trim(),
          type: secondary.trim() || "Other",
          investedMinor: amountMinor,
          currentMinor: amountMinor,
          currency,
        });
      }
      if (toolId === "lend") {
        if (!name.trim() || amountMinor <= 0) throw new Error("Enter person and amount.");
        return financeService.createLendRecord({
          person: name.trim(),
          relation: secondary.trim() || null,
          kind: "lent",
          amountMinor,
          givenOn: todayIsoDate(),
          dueOn: todayIsoDate(),
          status: "pending",
          currency,
        });
      }
      throw new Error("Unsupported tool.");
    },
    onSuccess: async () => {
      setName("");
      setSecondary("");
      setAmount("");
      const keys = [
        "bank-accounts",
        "accounts",
        "goals",
        "budgets",
        "investments",
        "lend",
        "dashboard",
      ];
      await Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })));
      Alert.alert("Saved", "Synced to your Hisaab account.");
    },
    onError: (error) => {
      Alert.alert(
        "Could not save",
        error instanceof ApiError || error instanceof Error ? error.message : "Try again.",
      );
    },
  });

  return (
    <View>
      <SectionTitle title={labels.title} />
      <Card style={styles.card}>
        <Field
          label={labels.name}
          placeholder={labels.name}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        {labels.secondary ? (
          <Field
            label={labels.secondary}
            placeholder={labels.secondary}
            value={secondary}
            onChangeText={setSecondary}
            autoCapitalize="words"
            keyboardType={toolId === "goals" ? "decimal-pad" : "default"}
          />
        ) : null}
        <Field
          label={labels.amount}
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <AppButton
          label={save.isPending ? "Saving…" : "Save"}
          onPress={() => {
            if (save.isPending) return;
            save.mutate();
          }}
        />
        <Text style={styles.hint}>Creates live records through the Hisaab API.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 16 },
});
