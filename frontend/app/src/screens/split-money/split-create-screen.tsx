import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  computeParticipantShares,
  computeSplitLedger,
  majorToMinor,
  splitExpenseSchema,
  splitWizardIssues,
  zodFieldErrors,
} from "@hisaab/validation";
import { ApiError } from "../../services/api-client";
import type { SplitMethod } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { DateField } from "../../components/ui/date-field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { localDateKey, money } from "../../lib/format";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { splitKeys } from "../../features/split-money/api/splitMoneyQueries";

function minorOrZero(value: string) {
  try {
    return majorToMinor(value.replace(/,/g, ""));
  } catch {
    return 0;
  }
}

type Props = NativeStackScreenProps<AppStackParamList, "SplitCreate">;
const STEPS = ["Details", "Who paid", "Split with", "Method", "Reminder", "Review"];

export function SplitCreateScreen({ navigation, route }: Props) {
  const people = useQuery({ queryKey: splitKeys.people, queryFn: () => splitMoneyApi.people() });
  const groups = useQuery({ queryKey: splitKeys.groups, queryFn: () => splitMoneyApi.groups() });
  const client = useQueryClient();
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  stepRef.current = step;
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [date, setDate] = useState(localDateKey());
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState<string | null>(route.params?.groupId ?? null);
  const [payerId, setPayerId] = useState<string>();
  const [payerIds, setPayerIds] = useState<string[]>([]);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [shares, setShares] = useState<Record<string, string>>({});
  const [items, setItems] = useState<
    Array<{ name: string; quantity: string; amount: string; personIds: string[] }>
  >([]);
  const [dueDate, setDueDate] = useState("");
  const [reminders, setReminders] = useState(true);

  const activePeople = useMemo(
    () => (people.data ?? []).filter((p) => !("archivedAt" in p && p.archivedAt)),
    [people.data],
  );
  const activeIds = useMemo(() => new Set(activePeople.map((p) => p.id)), [activePeople]);
  const selectedGroup = groups.data?.find((g) => g.id === groupId);

  const activeMemberIds = (group: { members?: Array<{ personId: string }> } | undefined) =>
    (group?.members ?? []).map((m) => m.personId).filter((id) => activeIds.has(id));

  useEffect(() => {
    const initialGroupId = route.params?.groupId;
    if (!initialGroupId || !groups.data || !people.data) return;
    const group = groups.data.find((g) => g.id === initialGroupId);
    const memberIds = activeMemberIds(group);
    if (memberIds.length) setSelected((prev) => [...new Set([...prev, ...memberIds])]);
  }, [route.params?.groupId, groups.data, people.data, activeIds]);

  useEffect(() => {
    const self = activePeople.find((p) => p.isSelf) ?? activePeople[0];
    if (!self) return;
    setSelected((prev) => (prev.length === 0 ? [self.id] : prev.filter((id) => activeIds.has(id))));
    setPayerIds((prev) => (prev.length === 0 ? [self.id] : prev.filter((id) => activeIds.has(id))));
  }, [activePeople, activeIds]);

  useEffect(() => {
    const onBack = () => {
      if (stepRef.current > 0) {
        setStep((s) => Math.max(0, s - 1));
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, []);

  const goBackStep = () => {
    if (stepRef.current) setStep((s) => Math.max(0, s - 1));
    else navigation.goBack();
  };

  const pickGroup = (id: string | null) => {
    setGroupId(id);
    if (!id) return;
    const group = groups.data?.find((g) => g.id === id);
    const memberIds = activeMemberIds(group);
    if (memberIds.length) setSelected((prev) => [...new Set([...prev.filter((pid) => activeIds.has(pid)), ...memberIds])]);
  };

  const total = minorOrZero(amount);
  const itemPayload = items.map((item) => ({
    name: item.name,
    quantity: Number(item.quantity || 1),
    priceMinor: minorOrZero(item.amount || "0"),
    kind: "item" as const,
    personIds: item.personIds.filter((id) => activeIds.has(id)),
  }));
  const participants = useMemo(() => {
    try {
      return total && selected.length
        ? computeParticipantShares({
            totalAmountMinor: total,
            method,
            participants: selected.map((personId) =>
              method === "exact"
                ? { personId, shareAmountMinor: minorOrZero(shares[personId] || "0") }
                : method === "percentage"
                  ? { personId, sharePercentageBps: Math.round(Number(shares[personId] || 0) * 100) }
                  : method === "shares"
                    ? { personId, shareValue: Number(shares[personId] || 1) }
                    : { personId },
            ),
            items: itemPayload,
          })
        : [];
    } catch {
      return [];
    }
  }, [total, selected, method, shares, items]);

  const payers = (payerIds.length ? payerIds : payerId ? [payerId] : [])
    .filter((id) => activeIds.has(id))
    .map((id) => ({
      personId: id,
      paidAmountMinor:
        payerIds.length === 1 && !payerAmounts[id] ? total : minorOrZero(payerAmounts[id] || "0"),
    }));
  const payerTotal = payers.reduce((sum, p) => sum + p.paidAmountMinor, 0);
  const allocated = participants.reduce((sum, p) => sum + p.shareAmountMinor, 0);
  const percentageTotal = selected.reduce((sum, id) => sum + Number(shares[id] || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      if (!payers.length) throw new Error("Choose who paid.");
      const missing = [...new Set([...selected, ...payers.map((p) => p.personId)])].filter(
        (id) => !activeIds.has(id),
      );
      if (missing.length) {
        throw new Error("A removed contact is still on this split. Go back and pick active people only.");
      }
      const currency = (selectedGroup?.currency ?? "INR") as "INR";
      const input = {
        title,
        description: description || null,
        category,
        totalAmountMinor: total,
        currency,
        expenseDate: date,
        groupId: groupId || null,
        splitMethod: method,
        dueDate: dueDate || null,
        allowPartialPayments: true,
        sendNotifications: reminders,
        payers,
        participants,
        items: method === "itemwise" ? itemPayload : undefined,
        reminder: reminders
          ? { enabled: true, channels: ["in_app" as const], stopAfterSettlement: true }
          : undefined,
      };
      const parsed = splitExpenseSchema.safeParse(input);
      if (!parsed.success) {
        throw new ApiError("Check the expense details.", "VALIDATION_ERROR", zodFieldErrors(parsed.error));
      }
      return splitMoneyApi.createExpense(parsed.data);
    },
    onSuccess: async (e) => {
      await client.invalidateQueries({ queryKey: splitKeys.root });
      navigation.replace("SplitExpense", { id: e.id });
    },
    onError: (e) => {
      const issues =
        e instanceof ApiError && e.fieldErrors ? splitWizardIssues(e.fieldErrors) : [];
      const first = issues[0];
      if (first) {
        setStep(first.step - 1);
        return Alert.alert(
          `Fix step ${first.step}: ${first.label}`,
          issues.map((i) => `• ${i.label}: ${i.message}`).join("\n"),
        );
      }
      Alert.alert("Could not create split", e instanceof Error ? e.message : "Try again.");
    },
  });

  if (people.isLoading || groups.isLoading) {
    return (
      <SafeAreaView style={styles.fill}>
        <LoadingBlock label="Preparing split…" />
      </SafeAreaView>
    );
  }
  if (people.isError) {
    return (
      <SafeAreaView style={styles.fill}>
        <ErrorBlock message="Could not load people." onRetry={() => void people.refetch()} />
      </SafeAreaView>
    );
  }

  const nameOf = (id: string) => {
    const p = activePeople.find((x) => x.id === id) ?? people.data?.find((x) => x.id === id);
    return p?.isSelf ? "You" : (p?.fullName ?? "Participant");
  };
  const preview = (() => {
    if (!total || payerTotal !== total || !participants.length) return null;
    try {
      return computeSplitLedger({
        totalAmountMinor: total,
        payers: payers.filter((p) => p.paidAmountMinor > 0),
        participants: participants.map((p) => ({
          id: p.personId,
          personId: p.personId,
          shareAmountMinor: p.shareAmountMinor,
        })),
      });
    } catch {
      return null;
    }
  })();
  const roleOf = (id: string) => {
    const debts = preview?.obligations.filter((e) => e.debtorPersonId === id) ?? [];
    if (debts.length) {
      return `owes ${debts.map((e) => `${money(e.amountMinor)} to ${nameOf(e.creditorPersonId)}`).join(", ")}`;
    }
    const b = preview?.balances.find((x) => x.personId === id);
    if ((b?.receivableMinor ?? 0) > 0) {
      return `paid ${money(b!.upfrontPaidMinor)} upfront · gets back ${money(b!.receivableMinor)}`;
    }
    return (b?.upfrontPaidMinor ?? 0) > 0 ? "paid own share" : "nothing owed";
  };

  const next = () => {
    if (step === 0 && (!title.trim() || total <= 0 || !date)) {
      return Alert.alert("Check details", "Enter a title, positive amount, and date.");
    }
    if (step === 1 && (!payers.length || payerTotal !== total)) {
      return Alert.alert(
        "Check contributions",
        `Payers must contribute exactly ${money(total)}. Current total: ${money(payerTotal)}.`,
      );
    }
    if (step === 2 && !selected.length) {
      return Alert.alert("Choose participants", "Select one or more people.");
    }
    if (step === 3 && !participants.length) {
      return Alert.alert(
        "Check split",
        "Exact amounts must equal the total; percentages must equal 100%; shares must be positive.",
      );
    }
    if (
      step === 3 &&
      method === "itemwise" &&
      (!itemPayload.length || itemPayload.some((i) => !i.name || i.priceMinor < 0 || !i.personIds.length))
    ) {
      return Alert.alert("Check items", "Each item needs a name, amount, and at least one participant.");
    }
    setStep((s) => Math.min(5, s + 1));
  };

  return (
    <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.top}>
          <BackLink onPress={goBackStep} label={step ? "Previous step" : "Back"} pinTop />
          <Text style={styles.step}>
            STEP {step + 1} OF 6 · {STEPS[step]}
          </Text>
          <View style={styles.track}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 13, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && (
            <>
              <Text style={styles.title}>Expense details</Text>
              <Field
                label="What was this for?"
                placeholder="Dinner, rent, trip…"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
              />
              <Field
                label="Total amount"
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Field label="Category" placeholder="General" value={category} onChangeText={setCategory} />
              <DateField label="Expense date" value={date} onChange={setDate} />
              <Field
                label="Description (optional)"
                placeholder="Add a note"
                value={description}
                onChangeText={setDescription}
                autoCapitalize="sentences"
              />
            </>
          )}
          {step === 1 && (
            <>
              <Text style={styles.title}>Who paid?</Text>
              <Text style={styles.sub}>
                Tap one or more contributors, then enter their original contributions. Total:{" "}
                {money(total)} · Entered: {money(payerTotal)}
              </Text>
              {activePeople.map((p) => (
                <View key={p.id} style={{ gap: 6 }}>
                  <Choice
                    label={p.isSelf ? "You" : p.fullName}
                    selected={payerIds.includes(p.id) || payerId === p.id}
                    onPress={() => {
                      setPayerId(undefined);
                      setPayerIds((ids) =>
                        ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id],
                      );
                    }}
                  />
                  {payerIds.includes(p.id) || payerId === p.id ? (
                    <Field
                      label={`${p.isSelf ? "You" : p.fullName} paid`}
                      placeholder="0.00"
                      value={payerAmounts[p.id] ?? ""}
                      onChangeText={(v) => setPayerAmounts((x) => ({ ...x, [p.id]: v }))}
                      keyboardType="decimal-pad"
                    />
                  ) : null}
                </View>
              ))}
            </>
          )}
          {step === 2 && (
            <>
              <Text style={styles.title}>Split with</Text>
              <Text style={styles.sub}>
                Optionally link a group (preselects active members), then add or remove people for this
                expense.
              </Text>
              <Choice label="No group" selected={!groupId} onPress={() => pickGroup(null)} />
              {groups.data?.map((g) => {
                const count = activeMemberIds(g).length;
                return (
                  <Choice
                    key={g.id}
                    label={`${g.name} · ${count} members`}
                    selected={groupId === g.id}
                    onPress={() => pickGroup(g.id)}
                  />
                );
              })}
              {activePeople.map((p) => (
                <Choice
                  key={p.id}
                  label={p.isSelf ? "You" : p.fullName}
                  selected={selected.includes(p.id)}
                  onPress={() =>
                    setSelected((x) =>
                      x.includes(p.id) ? x.filter((id) => id !== p.id) : [...x, p.id],
                    )
                  }
                />
              ))}
            </>
          )}
          {step === 3 && (
            <>
              <Text style={styles.title}>How should it be split?</Text>
              {(["equal", "exact", "percentage", "shares", "itemwise"] as SplitMethod[]).map((m) => (
                <Choice
                  key={m}
                  label={m === "itemwise" ? "Item-wise" : m[0]!.toUpperCase() + m.slice(1)}
                  selected={method === m}
                  onPress={() => setMethod(m)}
                />
              ))}
              {method === "itemwise" ? (
                <>
                  <AppButton
                    label="Add item"
                    icon="add"
                    outline
                    onPress={() =>
                      setItems((x) => [...x, { name: "", quantity: "1", amount: "", personIds: [...selected] }])
                    }
                  />
                  {items.map((item, index) => (
                    <Card key={index} style={styles.review}>
                      <Field
                        label="Item name"
                        placeholder="Dinner"
                        value={item.name}
                        onChangeText={(v) =>
                          setItems((x) => x.map((a, i) => (i === index ? { ...a, name: v } : a)))
                        }
                      />
                      <Field
                        label="Quantity"
                        placeholder="1"
                        value={item.quantity}
                        onChangeText={(v) =>
                          setItems((x) => x.map((a, i) => (i === index ? { ...a, quantity: v } : a)))
                        }
                        keyboardType="number-pad"
                      />
                      <Field
                        label="Item amount"
                        placeholder="0.00"
                        value={item.amount}
                        onChangeText={(v) =>
                          setItems((x) => x.map((a, i) => (i === index ? { ...a, amount: v } : a)))
                        }
                        keyboardType="decimal-pad"
                      />
                      <Text style={styles.sub}>Assigned participants</Text>
                      {selected.map((id) => (
                        <Choice
                          key={id}
                          label={nameOf(id)}
                          selected={item.personIds.includes(id)}
                          onPress={() =>
                            setItems((x) =>
                              x.map((a, i) =>
                                i === index
                                  ? {
                                      ...a,
                                      personIds: a.personIds.includes(id)
                                        ? a.personIds.filter((p) => p !== id)
                                        : [...a.personIds, id],
                                    }
                                  : a,
                              ),
                            )
                          }
                        />
                      ))}
                      <AppButton
                        label="Remove item"
                        icon="trash-outline"
                        outline
                        onPress={() => setItems((x) => x.filter((_, i) => i !== index))}
                      />
                    </Card>
                  ))}
                  <Text style={styles.sub}>
                    Item allocation preview:{" "}
                    {participants
                      .map((p) => `${nameOf(p.personId)} ${money(p.shareAmountMinor)}`)
                      .join(" · ")}
                  </Text>
                </>
              ) : method !== "equal" ? (
                <>
                  <Text style={styles.sub}>
                    {method === "exact"
                      ? "Enter amounts. They must equal the total."
                      : method === "percentage"
                        ? "Enter percentages. They must equal 100%."
                        : "Enter positive share weights."}
                  </Text>
                  {selected.map((id) => (
                    <Field
                      key={id}
                      label={nameOf(id)}
                      placeholder={method === "exact" ? "0.00" : method === "percentage" ? "0" : "1"}
                      value={shares[id] ?? ""}
                      onChangeText={(v) => setShares((x) => ({ ...x, [id]: v }))}
                      keyboardType="decimal-pad"
                    />
                  ))}
                  <Card style={styles.review}>
                    <Text style={styles.sub}>
                      Total {money(total)} · Allocated {money(allocated)}
                    </Text>
                    {method === "percentage" ? (
                      <Text style={styles.sub}>Percentage total: {percentageTotal}%</Text>
                    ) : null}
                    <Text style={[styles.sub, { color: allocated > total ? colors.red : colors.green }]}>
                      {allocated > total
                        ? `Overallocated ${money(allocated - total)}`
                        : `Remaining ${money(total - allocated)}`}
                    </Text>
                    <Text style={styles.sub}>
                      Preview:{" "}
                      {participants
                        .map((p) => `${nameOf(p.personId)} ${money(p.shareAmountMinor)}`)
                        .join(" · ")}
                    </Text>
                  </Card>
                </>
              ) : null}
            </>
          )}
          {step === 4 && (
            <>
              <Text style={styles.title}>Due date & reminder</Text>
              <DateField label="Due date" value={dueDate} onChange={setDueDate} optional />
              <Choice
                label="Send in-app reminder"
                selected={reminders}
                onPress={() => setReminders(!reminders)}
              />
              <Choice
                label="Email (unavailable)"
                selected={false}
                onPress={() =>
                  Alert.alert(
                    "In-app reminders only",
                    "Email, SMS, and WhatsApp reminder channels are disabled in this release.",
                  )
                }
              />
              <Choice
                label="WhatsApp / SMS (unavailable)"
                selected={false}
                onPress={() =>
                  Alert.alert(
                    "In-app reminders only",
                    "Email, SMS, and WhatsApp reminder channels are disabled in this release.",
                  )
                }
              />
              <Text style={styles.sub}>
                In-app reminders are processed automatically by the recurring scheduler when due. External
                notification channels are unavailable in this release.
              </Text>
            </>
          )}
          {step === 5 && (
            <>
              <Text style={styles.title}>Review split</Text>
              <Card style={styles.review}>
                <Text style={styles.reviewTitle}>{title}</Text>
                <Text style={styles.total}>{money(total)}</Text>
                <Text style={styles.sub}>
                  {category} · {date} · {method}
                  {selectedGroup ? ` · ${selectedGroup.name}` : ""}
                </Text>
                <Text style={styles.sub}>
                  {participants.length} participant(s),{" "}
                  {payers.length ? `${payers.length} payer(s)` : "no payer"}
                </Text>
                {participants.map((p) => (
                  <Text key={p.personId} style={styles.sub}>
                    {nameOf(p.personId)}: share {money(p.shareAmountMinor)} · {roleOf(p.personId)}
                  </Text>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
        <View style={styles.bottom}>
          <AppButton
            label={step === 5 ? (create.isPending ? "Creating…" : "Create split") : "Continue"}
            disabled={create.isPending}
            onPress={() => {
              if (step === 5) {
                if (!create.isPending) create.mutate();
              } else next();
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text
        style={[styles.choiceText, selected && styles.choiceTextSelected]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text style={[styles.choiceAction, selected && styles.choiceActionSelected]}>
        {selected ? "Selected" : "Select"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: 18, paddingTop: 8, gap: 13, flex: 1 },
  top: { zIndex: 2, gap: 6 },
  step: { color: colors.green, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  track: { flexDirection: "row", gap: 5 },
  dot: { height: 5, flex: 1, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.green },
  title: { color: colors.white, fontSize: 27, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  choice: {
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  choiceSelected: { backgroundColor: colors.green, borderColor: colors.green },
  choiceText: { color: colors.white, fontWeight: "800", flex: 1, flexShrink: 1 },
  choiceTextSelected: { color: colors.ink },
  choiceAction: { color: colors.green, fontWeight: "700", flexShrink: 0 },
  choiceActionSelected: { color: colors.ink },
  bottom: { marginTop: "auto", paddingTop: 4, paddingBottom: 8 },
  review: { gap: 9 },
  reviewTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  total: { color: colors.green, fontWeight: "900", fontSize: 28 },
});
