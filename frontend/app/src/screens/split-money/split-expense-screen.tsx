import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SplitObligation, SplitPaymentMethod } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { DateField } from "../../components/ui/date-field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money, localDateKey } from "../../lib/format";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { splitKeys } from "../../features/split-money/api/splitMoneyQueries";
import { useSingleFlight } from "../../lib/single-flight";
import { SplitReceipts } from "../../components/finance/split-receipts";
import { friendlyError } from "../../lib/api-errors";

function obligationKey(edge: SplitObligation) {
  return `${edge.debtorPersonId}:${edge.creditorPersonId}`;
}

type Props = NativeStackScreenProps<AppStackParamList, "SplitExpense">;
export function SplitExpenseScreen({ navigation, route }: Props) {
  const client = useQueryClient();
  const { id } = route.params;
  const expense = useQuery({ queryKey: splitKeys.expense(id), queryFn: () => splitMoneyApi.getExpense(id) });
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: splitKeys.expense(id) }),
      client.invalidateQueries({ queryKey: splitKeys.dashboard }),
      client.invalidateQueries({ queryKey: splitKeys.history }),
      client.invalidateQueries({ queryKey: splitKeys.expenses }),
      client.invalidateQueries({ queryKey: splitKeys.groups }),
    ]);
  };
  const settleFlight = useSingleFlight();
  const settle = useMutation({
    mutationFn: () => splitMoneyApi.settle(id, { method: "other" }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert("Could not settle", friendlyError(e)),
    onSettled: () => settleFlight.end(),
  });
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ title: "", category: "", description: "", dueDate: "" });
  const editFlight = useSingleFlight();
  const editMutation = useMutation({
    mutationFn: () => {
      if (!edit.title.trim()) throw new Error("Title is required.");
      if (!edit.category.trim()) throw new Error("Category is required.");
      if (edit.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(edit.dueDate)) throw new Error("Due date must be YYYY-MM-DD.");
      return splitMoneyApi.updateExpense(id, {
        title: edit.title.trim(),
        category: edit.category.trim(),
        description: edit.description.trim() || null,
        dueDate: edit.dueDate || null,
      });
    },
    onSuccess: async () => {
      setEditing(false);
      await invalidate();
    },
    onError: (e) => Alert.alert("Could not save", friendlyError(e)),
    onSettled: () => editFlight.end(),
  });
  const statusMutation = useMutation({
    mutationFn: (next: "cancelled" | "pending" | "publish") =>
      splitMoneyApi.updateExpense(id, next === "publish" ? { isDraft: false } : { status: next }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert("Could not update expense", friendlyError(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => splitMoneyApi.deleteExpense(id),
    onSuccess: async () => {
      await invalidate();
      navigation.goBack();
    },
    onError: (e) => Alert.alert("Could not delete", friendlyError(e)),
  });
  const voidMutation = useMutation({
    mutationFn: (paymentId: string) => splitMoneyApi.voidPayment(id, paymentId, null),
    onSuccess: invalidate,
    onError: (e) => Alert.alert("Could not reverse repayment", friendlyError(e)),
  });
  const reminderMutation = useMutation({
    mutationFn: () =>
      splitMoneyApi.reminder(id, {
        channel: "in_app",
        scheduledAt: new Date().toISOString(),
        message: `Reminder for ${expense.data?.title ?? "expense"}`,
      }),
    onSuccess: async () => {
      await invalidate();
      Alert.alert("Reminder scheduled", "The scheduler delivers in-app reminders within about 15 minutes. It will show as delivered below.");
    },
    onError: (e) => Alert.alert("Could not schedule reminder", friendlyError(e)),
  });
  const cancelReminderMutation = useMutation({
    mutationFn: (reminderId: string) => splitMoneyApi.cancelReminder(id, reminderId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert("Could not cancel reminder", friendlyError(e)),
  });
  const simplifyMutation = useMutation({
    mutationFn: () => splitMoneyApi.simplify(id) as Promise<Array<{ from?: { fullName?: string }; to?: { fullName?: string }; amountMinor: number; currency: string }>>,
    onSuccess: (rows) => {
      const summary = rows?.length
        ? rows.map((r) => `${r.from?.fullName ?? "Debtor"} → ${r.to?.fullName ?? "Creditor"}: ${money(r.amountMinor, r.currency)}`).join("\n")
        : "No simplified transfers needed.";
      Alert.alert("Simplified transfers", summary);
    },
    onError: (e) => Alert.alert("Could not simplify", friendlyError(e)),
  });
  const convertLendMutation = useMutation({
    mutationFn: () => splitMoneyApi.convertToLend(id),
    onSuccess: (res) => {
      const suggestions = (res.suggestions ?? []) as Array<{ person: string; kind: string; amountMinor: number; currency: string }>;
      const summary = suggestions.length
        ? suggestions.map((s) => `${s.person} (${s.kind}): ${money(s.amountMinor, s.currency)}`).join("\n")
        : "No obligations involving you remain.";
      Alert.alert("Borrow / Lend preview", `${summary}\n\nPreview only — no duplicate Borrow/Lend record was created.`);
    },
    onError: (e) => Alert.alert("Could not preview Borrow/Lend", friendlyError(e)),
  });
  if (expense.isLoading) return <View style={styles.fill}><LoadingBlock /></View>;
  if (!expense.data) {
    return (
      <View style={styles.fill}>
        <ErrorBlock message="Could not load this expense." onRetry={() => void expense.refetch()} />
      </View>
    );
  }
  const item = expense.data;
  const currency = item.currency;
  const collectible = item.ledger?.collectibleMinor ?? item.collectibleMinor ?? 0;
  const collected = item.ledger?.collectedMinor ?? item.collectedMinor ?? 0;
  const remaining = item.ledger?.remainingMinor ?? item.pendingMinor ?? 0;
  const settledPct = item.ledger?.settledPercent ?? item.settledPercent ?? 0;
  const balances = item.balances ?? [];
  const recorded = item.ledger?.repaymentsRecordedMinor ?? collected;
  const outstanding = item.ledger?.outstandingDebtMinor ?? remaining;
  const correctionDue = item.ledger?.correctionDueMinor ?? 0;
  const flagged = (item.payments ?? []).filter((p) => p.status === "completed" && (p.flags?.length ?? 0) > 0);
  const selfDuplicates = new Set(item.selfDuplicatePersonIds ?? []);
  const isRefundEdge = (edge: { debtorPersonId: string }) =>
    (balances.find((row) => row.personId === edge.debtorPersonId)?.originalDebtMinor ?? 1) === 0;
  const needsReview = flagged.length > 0 || selfDuplicates.size > 0 || correctionDue > 0;
  const cancelled = item.status === "cancelled";
  const hasActiveRepayments = (item.payments ?? []).some((p) => p.status === "completed");
  const hasMoneyHistory =
    (item.payments?.length ?? 0) > 0 || (item.adjustments?.length ?? 0) > 0;
  const busy =
    settle.isPending ||
    editMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending ||
    voidMutation.isPending ||
    reminderMutation.isPending ||
    cancelReminderMutation.isPending;
  const confirm = (title: string, message: string, label: string, action: () => void, destructive = false) =>
    Alert.alert(title, message, [
      { text: "Keep", style: "cancel" },
      { text: label, style: destructive ? "destructive" : "default", onPress: action },
    ]);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Tabs");
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <BackLink onPress={goBack} pinTop />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.sub}>
        {item.category} · {item.expenseDate} · {item.status.replaceAll("_", " ")}
        {item.isDraft ? " · draft" : ""}
        {item.group ? ` · ${item.group.name}` : ""}
        {item.dueDate ? ` · due ${item.dueDate}` : ""}
      </Text>
      {item.description ? <Text style={styles.sub}>{item.description}</Text> : null}

      {editing ? (
        <Card style={styles.total}>
          <Text style={styles.label}>EDIT DETAILS</Text>
          <Text style={styles.hint}>Amount, payers and shares are financial history. Use “Adjust balance” to change a share.</Text>
          <Field label="Title" placeholder="Dinner, rent, trip…" value={edit.title} onChangeText={(v) => setEdit({ ...edit, title: v })} />
          <Field label="Category" placeholder="General" value={edit.category} onChangeText={(v) => setEdit({ ...edit, category: v })} />
          <Field label="Description" placeholder="Optional" value={edit.description} onChangeText={(v) => setEdit({ ...edit, description: v })} />
          <DateField label="Due date" value={edit.dueDate} onChange={(v) => setEdit({ ...edit, dueDate: v })} optional />
          <AppButton
            label={editMutation.isPending ? "Saving…" : "Save details"}
            icon="checkmark"
            disabled={editMutation.isPending}
            onPress={() => editFlight.run(editMutation.isPending, () => editMutation.mutate())}
          />
          <AppButton label="Discard" outline disabled={editMutation.isPending} onPress={() => setEditing(false)} />
        </Card>
      ) : null}

      <Card style={styles.total}>
        <Text style={styles.label}>TOTAL EXPENSE</Text>
        <Text style={styles.big}>{money(item.totalAmountMinor, currency)}</Text>
        <Text style={styles.sub}>
          Paid upfront {money(item.ledger?.upfrontPaidMinor ?? item.totalAmountMinor, currency)} · Collected toward bill{" "}
          {money(collected, currency)} of {money(collectible, currency)} · {settledPct}% settled
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, settledPct))}%` }]} />
        </View>
        <Text style={styles.sub}>
          Still owed on bill {money(outstanding, currency)}
          {correctionDue > 0 ? ` · Refund / correction due ${money(correctionDue, currency)}` : ""}
          {recorded !== collected ? ` · ${money(recorded, currency)} repayments recorded` : ""}
        </Text>
        <Text style={styles.sub}>
          You owe {money(item.youOweMinor ?? 0, currency)} · You are owed {money(item.youAreOwedMinor ?? 0, currency)}
        </Text>
        <Text style={styles.hint}>
          Upfront bill payments are separate from repayments. Recording a repayment does not transfer money.
        </Text>
      </Card>

      {needsReview ? (
        <Card style={styles.review}>
          <Text style={styles.reviewTitle}>This expense needs review</Text>
          {selfDuplicates.size > 0 ? (
            <Text style={styles.reviewText}>
              • {balances.filter((row) => selfDuplicates.has(row.personId)).map((row) => row.person?.fullName ?? "A contact").join(", ")} uses your
              own account email, so you appear twice on this expense.
            </Text>
          ) : null}
          {flagged.some((p) => p.flags?.includes("self_transfer")) ? (
            <Text style={styles.reviewText}>• Some repayments were recorded from a person to themselves. They move no money.</Text>
          ) : null}
          {flagged.some((p) => p.flags?.includes("possible_duplicate")) ? (
            <Text style={styles.reviewText}>• Some repayments look like double submits (same people and amount within a minute).</Text>
          ) : null}
          {correctionDue > 0 ? (
            <Text style={styles.reviewText}>
              • {money(correctionDue, currency)} was repaid beyond what was owed and shows as a refund below.
            </Text>
          ) : null}
          <Text style={styles.hint}>
            Nothing is changed automatically. Long-press a flagged repayment to void it; voided records stay in history.
          </Text>
        </Card>
      ) : null}

      {(item.obligations?.length ?? 0) > 0 ? (
        <>
          <Text style={styles.heading}>Who owes whom</Text>
          {item.obligations!.map((edge) => (
            <Card key={obligationKey(edge)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {edge.debtor?.fullName ?? "Someone"} → {edge.creditor?.fullName ?? "Someone"}
                </Text>
                {isRefundEdge(edge) ? <Text style={styles.flag}>Refund for overpayment</Text> : null}
              </View>
              <Text style={styles.amount}>{money(edge.amountMinor, currency)}</Text>
            </Card>
          ))}
        </>
      ) : null}

      <Text style={styles.heading}>Individual balances</Text>
      {balances.length
        ? balances.map((row) => (
            <Card key={row.personId} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.person?.fullName ?? "Person"}</Text>
                {selfDuplicates.has(row.personId) ? <Text style={styles.flag}>Same email as your account</Text> : null}
                <Text style={styles.sub}>
                  Share {money(row.adjustedShareMinor, currency)} · Upfront {money(row.upfrontPaidMinor, currency)} · Repaid{" "}
                  {money(row.repaymentSentMinor, currency)}
                </Text>
                <Text style={styles.sub}>
                  {row.owedMinor > 0
                    ? `Owes ${money(row.owedMinor, currency)}`
                    : row.receivableMinor > 0
                      ? `Gets back ${money(row.receivableMinor, currency)}`
                      : "Settled"}{" "}
                  · {row.status.replaceAll("_", " ")}
                  {row.lastPaymentDate ? ` · last ${row.lastPaymentDate}` : ""}
                </Text>
              </View>
            </Card>
          ))
        : item.participants?.map((p) => (
            <Card key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.person?.fullName ?? "Participant"}</Text>
                <Text style={styles.sub}>
                  {p.status.replaceAll("_", " ")} · repaid {money(p.paidAmountMinor, currency)}
                </Text>
              </View>
              <View>
                <Text style={styles.amount}>{money(p.adjustedShareAmountMinor ?? p.shareAmountMinor, currency)}</Text>
                <Text style={styles.pending}>{money(p.pendingAmountMinor, currency)} left</Text>
              </View>
            </Card>
          ))}

      <Text style={styles.heading}>Repayments</Text>
      <Text style={styles.hint}>Manual settlement records. Hisaab does not send money. Long-press a repayment to reverse it.</Text>
      {item.payments?.length ? (
        item.payments.map((payment) => (
          <Pressable
            key={payment.id}
            disabled={payment.status !== "completed" || cancelled || busy}
            onLongPress={() =>
              confirm(
                "Reverse repayment?",
                `Reverse the ${money(payment.amountMinor, currency)} repayment from ${payment.payer?.fullName ?? "payer"} to ${payment.receiver?.fullName ?? "receiver"}? The record stays in history as voided.`,
                "Reverse",
                () => voidMutation.mutate(payment.id),
                true,
              )
            }
          >
            <Card style={[styles.row, payment.status === "voided" ? { opacity: 0.55 } : null]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {payment.payer?.fullName ?? "Payer"} → {payment.receiver?.fullName ?? "Receiver"}
                </Text>
                <Text style={styles.sub}>
                  {payment.method.replaceAll("_", " ")} · {payment.paymentDate}
                  {payment.status === "voided" ? " · voided" : ""}
                  {payment.referenceId ? ` · ${payment.referenceId}` : ""}
                  {payment.note ? ` · ${payment.note}` : ""}
                </Text>
                <Text style={styles.hint}>Recorded {new Date(payment.createdAt).toLocaleString()}</Text>
                {payment.status === "completed" && payment.flags?.includes("self_transfer") ? (
                  <Text style={styles.flag}>Self-transfer · moves no money</Text>
                ) : null}
                {payment.status === "completed" && payment.flags?.includes("possible_duplicate") ? (
                  <Text style={styles.flag}>Possible duplicate · review &amp; void</Text>
                ) : null}
              </View>
              <Text style={styles.amount}>{money(payment.amountMinor, currency)}</Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <Text style={styles.sub}>No repayments recorded.</Text>
      )}

      {(item.reminders?.length ?? 0) > 0 ? (
        <>
          <Text style={styles.heading}>Reminders</Text>
          {item.reminders!.map((r) => (
            <Card key={r.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {r.channel.replace("_", "-")} ·{" "}
                  {r.status === "sent"
                    ? "delivered in-app"
                    : r.status === "failed"
                      ? "not delivered (channel not connected)"
                      : r.status}
                </Text>
                <Text style={styles.sub}>
                  Scheduled {new Date(r.scheduledAt).toLocaleString()}
                  {r.sentAt ? ` · delivered ${new Date(r.sentAt).toLocaleString()}` : ""}
                </Text>
              </View>
              {r.status === "scheduled" ? (
                <Pressable disabled={busy} onPress={() => cancelReminderMutation.mutate(r.id)}>
                  <Text style={{ color: colors.orange, fontWeight: "800" }}>Cancel</Text>
                </Pressable>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      <SplitReceipts
        expense={item}
        onChanged={invalidate}
        onUseValues={(values) => navigation.navigate("AddTransaction", values)}
      />

      <View style={styles.actions}>
        <AppButton
          label="Record repayment"
          icon="cash-outline"
          disabled={cancelled || remaining <= 0}
          onPress={() => navigation.navigate("SplitPayment", { id })}
        />
        <AppButton
          label="Adjust balance"
          icon="options-outline"
          outline
          disabled={cancelled}
          onPress={() => navigation.navigate("SplitAdjustment", { id })}
        />
        <AppButton
          label={settle.isPending ? "Settling…" : flagged.length > 0 ? "Review flagged repayments first" : "Settle all"}
          icon="checkmark-circle-outline"
          outline
          disabled={busy || cancelled || remaining <= 0 || flagged.length > 0}
          onPress={() =>
            settleFlight.run(settle.isPending, () => {
              Alert.alert(
                "Mark settled?",
                "This records a manual settlement for every remaining obligation. It does not send money.",
                [
                  { text: "Cancel", style: "cancel", onPress: () => settleFlight.end() },
                  { text: "Settle", onPress: () => settle.mutate() },
                ],
              );
            })
          }
        />
        <AppButton
          label={reminderMutation.isPending ? "Scheduling…" : "Schedule in-app reminder"}
          icon="alarm-outline"
          outline
          disabled={busy || cancelled}
          onPress={() => reminderMutation.mutate()}
        />
        <AppButton
          label={simplifyMutation.isPending ? "Simplifying…" : "Simplify transfers"}
          icon="git-compare-outline"
          outline
          disabled={busy || cancelled || remaining <= 0}
          onPress={() => simplifyMutation.mutate()}
        />
        <AppButton
          label={convertLendMutation.isPending ? "Checking…" : "Preview Borrow / Lend"}
          icon="swap-horizontal-outline"
          outline
          disabled={busy || cancelled || remaining <= 0}
          onPress={() => convertLendMutation.mutate()}
        />
        <AppButton
          label="Edit details"
          icon="create-outline"
          outline
          disabled={busy || cancelled || editing}
          onPress={() => {
            setEdit({
              title: item.title,
              category: item.category,
              description: item.description ?? "",
              dueDate: item.dueDate ?? "",
            });
            setEditing(true);
          }}
        />
        {item.isDraft ? (
          <AppButton
            label={statusMutation.isPending ? "Publishing…" : "Publish draft"}
            icon="cloud-upload-outline"
            outline
            disabled={busy}
            onPress={() =>
              confirm("Publish draft?", "It will start counting towards balances.", "Publish", () =>
                statusMutation.mutate("publish"),
              )
            }
          />
        ) : null}
        {cancelled ? (
          <AppButton
            label={statusMutation.isPending ? "Reopening…" : "Reopen expense"}
            icon="refresh-outline"
            outline
            disabled={busy}
            onPress={() =>
              confirm("Reopen expense?", "It will be included in balances again.", "Reopen", () =>
                statusMutation.mutate("pending"),
              )
            }
          />
        ) : (
          <AppButton
            label={statusMutation.isPending ? "Cancelling…" : "Cancel expense"}
            icon="close-circle-outline"
            outline
            disabled={busy}
            onPress={() =>
              confirm(
                "Cancel expense?",
                hasActiveRepayments
                  ? "Repayments were recorded. Reverse them first; the server will refuse otherwise."
                  : "It will be excluded from balances. History is kept and you can reopen it later.",
                "Cancel expense",
                () => statusMutation.mutate("cancelled"),
                true,
              )
            }
          />
        )}
        {!hasMoneyHistory ? (
          <AppButton
            label={deleteMutation.isPending ? "Deleting…" : "Delete expense"}
            icon="trash-outline"
            outline
            disabled={busy}
            onPress={() =>
              confirm(
                "Delete permanently?",
                "Only allowed before any repayment or adjustment was recorded. This cannot be undone.",
                "Delete",
                () => deleteMutation.mutate(),
                true,
              )
            }
          />
        ) : null}
      </View>

      <Text style={styles.heading}>Activity</Text>
      {item.activities?.length ? (
        item.activities.map((a) => (
          <Text key={a.id} style={styles.sub}>
            {a.createdAt.slice(0, 10)} · {a.action.replaceAll("_", " ")}
          </Text>
        ))
      ) : (
        <Text style={styles.sub}>No activity has been recorded.</Text>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SplitPaymentScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, "SplitPayment">) {
  const query = useQuery({
    queryKey: splitKeys.expense(route.params.id),
    queryFn: () => splitMoneyApi.getExpense(route.params.id),
  });
  const client = useQueryClient();
  const [amount, setAmount] = useState("");
  const [obligationId, setObligationId] = useState("");
  const [method, setMethod] = useState<SplitPaymentMethod>("upi");
  const flight = useSingleFlight();

  const obligations = query.data?.obligations ?? [];
  const selected = useMemo(
    () => obligations.find((edge) => obligationKey(edge) === obligationId) ?? obligations[0],
    [obligations, obligationId],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const e = query.data!;
      if (!selected) throw new Error("There is no outstanding obligation on this expense.");
      const amountMinor = amount.trim()
        ? Math.round(Number(amount) * 100)
        : selected.amountMinor;
      if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > selected.amountMinor) {
        throw new Error(`Enter an amount up to ${money(selected.amountMinor, e.currency)}.`);
      }
      return splitMoneyApi.payment(e.id, {
        payerPersonId: selected.debtorPersonId,
        receiverPersonId: selected.creditorPersonId,
        amountMinor,
        method,
        paymentDate: localDateKey(),
        isFinalSettlement: amountMinor === selected.amountMinor,
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: splitKeys.root });
      navigation.goBack();
    },
    onError: (e) =>
      Alert.alert("Could not record payment", e instanceof Error ? e.message : "Try again."),
    onSettled: () => flight.end(),
  });

  if (!query.data) return <View style={styles.fill}><LoadingBlock /></View>;
  const currency = query.data.currency;

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <BackLink
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate("Tabs");
        }}
        pinTop
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Record repayment</Text>
        <Text style={styles.sub}>
          Choose the exact debtor and creditor. Leave the amount blank to settle the full remaining balance on that edge.
          This is a manual settlement record — Hisaab does not send money.
        </Text>

        {!obligations.length ? (
          <Card style={styles.total}>
            <Text style={styles.label}>NOTHING OUTSTANDING</Text>
            <Text style={styles.sub}>This expense has no remaining obligations.</Text>
          </Card>
        ) : (
          <>
            <Text style={styles.heading}>Who pays whom</Text>
            {obligations.map((edge) => {
              const key = obligationKey(edge);
              const on = (obligationId || (selected ? obligationKey(selected) : "")) === key;
              return (
                <Pressable key={key} onPress={() => setObligationId(key)}>
                  <Card style={[styles.row, on ? styles.choiceOn : null]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {edge.debtor?.fullName ?? "Debtor"} → {edge.creditor?.fullName ?? "Creditor"}
                      </Text>
                      <Text style={styles.sub}>{money(edge.amountMinor, currency)} remaining</Text>
                    </View>
                    <Text style={on ? styles.amount : styles.sub}>{on ? "Selected" : "Tap"}</Text>
                  </Card>
                </Pressable>
              );
            })}

            <Card style={styles.total}>
              <Text style={styles.label}>REMAINING ON THIS EDGE</Text>
              <Text style={styles.big}>{money(selected?.amountMinor ?? 0, currency)}</Text>
              {amount.trim() ? (
                <Text style={styles.sub}>
                  After this:{" "}
                  {money(
                    Math.max(0, (selected?.amountMinor ?? 0) - Math.round(Number(amount) * 100 || 0)),
                    currency,
                  )}
                </Text>
              ) : null}
            </Card>

            <Field
              label="Payment amount"
              placeholder="Full remaining on this edge"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.heading}>Method</Text>
            {(["upi", "cash", "bank_transfer", "card", "other"] as SplitPaymentMethod[]).map((item) => (
              <Pressable key={item} onPress={() => setMethod(item)}>
                <Card style={[styles.row, method === item ? styles.choiceOn : null]}>
                  <Text style={styles.name}>{item.replaceAll("_", " ")}</Text>
                </Card>
              </Pressable>
            ))}

            <AppButton
              label={mutation.isPending ? "Recording…" : "Confirm repayment"}
              disabled={mutation.isPending || !selected}
              icon="checkmark"
              onPress={() => flight.run(mutation.isPending, () => mutation.mutate())}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  page: { padding: 18, gap: 13, paddingBottom: 28 },
  title: { color: colors.white, fontWeight: "900", fontSize: 29 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  flag: { color: colors.red, fontSize: 11, fontWeight: "800", marginTop: 4 },
  review: { gap: 6, borderColor: colors.red, borderWidth: 1 },
  reviewTitle: { color: colors.red, fontWeight: "900", fontSize: 14 },
  reviewText: { color: colors.white, fontSize: 12, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  total: { gap: 8, backgroundColor: colors.panel2 },
  big: { color: colors.white, fontWeight: "900", fontSize: 31 },
  heading: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 3 },
  row: { padding: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  name: { color: colors.white, fontWeight: "800" },
  amount: { color: colors.white, fontWeight: "900" },
  pending: { color: colors.orange, fontSize: 11, marginTop: 3 },
  actions: { gap: 10, marginTop: 5 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.green },
  choiceOn: { borderColor: colors.green, borderWidth: 1 },
});
