import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetSchema, majorToMinor } from "@hisaab/validation";
import type { Budget } from "@hisaab/types";
import { budgetService } from "../../services/budget.service";
import { categoryService } from "../../services/category.service";
import { BackLink } from "../../components/ui/back-link";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money } from "../../lib/format";
import { colors } from "../../theme/tokens";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const invalidate = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all(["budgets", "dashboard", "reports"].map((key) => client.invalidateQueries({ queryKey: [key] })));

export function BudgetListScreen({ navigation }: any) {
  const budgets = useQuery({ queryKey: ["budgets", currentMonth()], queryFn: () => budgetService.list(currentMonth()) });
  if (budgets.isLoading) return <Page><LoadingBlock /></Page>;
  if (budgets.isError) return <Page><ErrorBlock message="Could not load budgets." onRetry={() => void budgets.refetch()} /></Page>;
  return <Page><Title text="Budgets" navigation={navigation} /><AppButton label="Create budget" onPress={() => navigation.navigate("CreateBudget")} />
    {budgets.data?.length ? budgets.data.map((budget) => <BudgetCard key={budget.id} budget={budget} onPress={() => navigation.navigate("BudgetDetail", { id: budget.id })} />) : <EmptyBlock title="No budgets" body="Set a spending limit for this month." />}
  </Page>;
}

function BudgetCard({ budget, onPress }: { budget: Budget; onPress: () => void }) {
  return <Pressable onPress={onPress}><Card style={styles.row}><View style={{ flex: 1 }}><Text style={styles.name}>{budget.categoryName ?? "Overall budget"}</Text><Text style={styles.muted}>{budget.month} · {money(budget.spentMinor)} spent</Text></View><View><Text style={[styles.amount, budget.remainingMinor < 0 && styles.danger]}>{money(budget.remainingMinor)}</Text><Text style={styles.muted}>{budget.percentageUsed}% used</Text></View></Card></Pressable>;
}

export function BudgetDetailScreen({ navigation, route }: any) {
  const client = useQueryClient();
  const budgets = useQuery({ queryKey: ["budgets", currentMonth()], queryFn: () => budgetService.list(currentMonth()) });
  const remove = useMutation({ mutationFn: budgetService.remove, onSuccess: () => invalidate(client).then(() => navigation.goBack()), onError: showError("Could not delete budget") });
  const budget = budgets.data?.find((item) => item.id === route.params.id);
  if (budgets.isLoading) return <Page><LoadingBlock /></Page>;
  if (!budget) return <Page><ErrorBlock message="Budget was not found." onRetry={() => void budgets.refetch()} /></Page>;
  return <Page><Title text={budget.categoryName ?? "Overall budget"} navigation={navigation} /><Card style={styles.summary}><Text style={styles.big}>{budget.percentageUsed}%</Text><Text style={styles.muted}>{money(budget.spentMinor)} of {money(budget.amountMinor)} spent</Text><Text style={styles.muted}>{money(budget.remainingMinor)} remaining · alert at {budget.alertPercentage}%</Text></Card><AppButton label="Edit budget" onPress={() => navigation.navigate("EditBudget", { id: budget.id })} /><AppButton outline label={remove.isPending ? "Deleting…" : "Delete budget"} onPress={() => Alert.alert("Delete budget?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(budget.id) }])} /></Page>;
}

export function CreateBudgetScreen({ navigation }: any) { return <BudgetForm navigation={navigation} />; }
export function EditBudgetScreen({ navigation, route }: any) { return <BudgetForm navigation={navigation} id={route.params.id} />; }
function BudgetForm({ navigation, id }: { navigation: any; id?: string }) {
  const client = useQueryClient(); const all = useQuery({ queryKey: ["budgets", currentMonth()], queryFn: () => budgetService.list(currentMonth()) }); const categories = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const existing = all.data?.find((item) => item.id === id); const [amount, setAmount] = useState(""); const [categoryId, setCategoryId] = useState<string | null>(null); const [hydrated, setHydrated] = useState(!id); useEffect(() => { if (!id || !existing || hydrated) return; setAmount(String(existing.amountMinor / 100)); setCategoryId(existing.categoryId ?? null); setHydrated(true); }, [id, existing, hydrated]);
  const save = useMutation({ mutationFn: () => { const parsed = budgetSchema.safeParse({ month: currentMonth(), categoryId, amountMinor: majorToMinor(amount), alertPercentage: existing?.alertPercentage ?? 80 }); if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the budget values."); return id ? budgetService.update(id, { categoryId, amountMinor: parsed.data.amountMinor, alertPercentage: parsed.data.alertPercentage }) : budgetService.create(parsed.data); }, onSuccess: () => invalidate(client).then(() => navigation.goBack()), onError: showError("Could not save budget") });
  return <Page><Title text={id ? "Edit budget" : "New budget"} navigation={navigation} /><Card style={styles.form}><Field label="Monthly limit" placeholder="0.00" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" /><Text style={styles.label}>CATEGORY</Text><View style={styles.chips}><Choice active={categoryId === null} label="Overall" onPress={() => setCategoryId(null)} />{categories.data?.filter((category) => category.type === "EXPENSE").map((category) => <Choice key={category.id} active={categoryId === category.id} label={category.name} onPress={() => setCategoryId(category.id)} />)}</View><AppButton label={save.isPending ? "Saving…" : "Save budget"} onPress={() => { if (save.isPending || (id && !hydrated)) return; if (!amount.trim()) return Alert.alert("Check the budget", "Enter a monthly limit."); save.mutate(); }} /></Card></Page>;
}
function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}><Text style={styles.chipText}>{label}</Text></Pressable>; }
function Title({ text, navigation }: { text: string; navigation: any }) { return <><BackLink onPress={() => navigation.goBack()} /><Text style={styles.title}>{text}</Text></>; }
function Page({ children }: { children: React.ReactNode }) { return <ScrollView style={styles.fill} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">{children}</ScrollView>; }
function showError(title: string) { return (error: unknown) => Alert.alert(title, error instanceof Error ? error.message : "Please try again."); }
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg }, page: { padding: 18, gap: 12 }, title: { color: colors.white, fontSize: 29, fontWeight: "900" }, row: { flexDirection: "row", gap: 10, padding: 14 }, name: { color: colors.white, fontWeight: "800" }, muted: { color: colors.muted, fontSize: 12 }, amount: { color: colors.green, fontWeight: "900", textAlign: "right" }, danger: { color: colors.red }, summary: { gap: 7, backgroundColor: colors.panel2 }, big: { color: colors.green, fontSize: 32, fontWeight: "900" }, form: { gap: 12 }, label: { color: colors.muted, fontSize: 10, fontWeight: "900" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, chip: { borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14 }, active: { backgroundColor: colors.green }, chipText: { color: colors.white, fontWeight: "800", fontSize: 11 } });
