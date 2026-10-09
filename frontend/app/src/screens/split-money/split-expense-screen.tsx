import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money, localDateKey } from "../../lib/format";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { splitKeys } from "../../features/split-money/api/splitMoneyQueries";
import { useSingleFlight } from "../../lib/single-flight";
import { SplitReceipts } from "../../components/finance/split-receipts";
import { friendlyError } from "../../lib/api-errors";

type Props = NativeStackScreenProps<AppStackParamList, "SplitExpense">;
export function SplitExpenseScreen({ navigation, route }: Props) {
  const client = useQueryClient(); const { id } = route.params;
  const expense = useQuery({ queryKey: splitKeys.expense(id), queryFn: () => splitMoneyApi.getExpense(id) });
  const invalidate = async () => { await Promise.all([client.invalidateQueries({ queryKey: splitKeys.expense(id) }), client.invalidateQueries({ queryKey: splitKeys.dashboard }), client.invalidateQueries({ queryKey: splitKeys.history }), client.invalidateQueries({ queryKey: splitKeys.expenses })]); };
  const settle = useMutation({ mutationFn: () => splitMoneyApi.settle(id), onSuccess: invalidate, onError: (e) => Alert.alert("Could not settle", friendlyError(e)) });
  if (expense.isLoading) return <View style={styles.fill}><LoadingBlock /></View>;
  if (!expense.data) return <View style={styles.fill}><ErrorBlock message="Could not load this expense." onRetry={() => void expense.refetch()} /></View>;
  const item = expense.data;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><BackLink onPress={() => navigation.goBack()} /><Text style={styles.title}>{item.title}</Text><Text style={styles.sub}>{item.category} · {item.expenseDate} · {item.status.replaceAll("_", " ")}</Text>
    <Card style={styles.total}><Text style={styles.label}>TOTAL EXPENSE</Text><Text style={styles.big}>{money(item.totalAmountMinor, item.currency)}</Text><Text style={styles.sub}>Due {item.dueDate ?? "No due date"} · {item.settledPercent ?? (item.totalAmountMinor ? Math.round(((item.participants?.reduce((sum, p) => sum + p.paidAmountMinor, 0) ?? 0) / item.totalAmountMinor) * 100) : 0)}% settled</Text></Card>
    <Text style={styles.heading}>Participants</Text>{item.participants?.map((p) => <Card key={p.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.name}>{p.person?.fullName ?? "Participant"}</Text><Text style={styles.sub}>{p.status.replaceAll("_", " ")} · paid {money(p.paidAmountMinor, item.currency)}</Text></View><View><Text style={styles.amount}>{money(p.shareAmountMinor, item.currency)}</Text><Text style={styles.pending}>{money(p.pendingAmountMinor, item.currency)} left</Text></View></Card>)}
    <Text style={styles.heading}>Payments</Text>{item.payments?.length ? item.payments.map((payment) => <Card key={payment.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.name}>{payment.payer?.fullName ?? "Payer"} → {payment.receiver?.fullName ?? "Receiver"}</Text><Text style={styles.sub}>{payment.method.replaceAll("_", " ")} · {payment.paymentDate}{payment.referenceId ? ` · ${payment.referenceId}` : ""}</Text></View><Text style={styles.amount}>{money(payment.amountMinor, item.currency)}</Text></Card>) : <Text style={styles.sub}>No payments recorded.</Text>}
    <SplitReceipts expense={item} onChanged={invalidate} onUseValues={(values) => navigation.navigate("AddTransaction", values)} />
    <View style={styles.actions}><AppButton label="Record payment" icon="cash-outline" onPress={() => navigation.navigate("SplitPayment", { id })} /><AppButton label="Adjust balance" icon="options-outline" outline onPress={() => navigation.navigate("SplitAdjustment", { id })} /><AppButton label={settle.isPending ? "Settling…" : "Settle all"} icon="checkmark-circle-outline" outline onPress={() => { if (!settle.isPending) settle.mutate(); }} /></View>
    <Text style={styles.heading}>Activity</Text>{item.activities?.length ? item.activities.map(a => <Text key={a.id} style={styles.sub}>{a.createdAt.slice(0, 10)} · {a.action.replaceAll("_", " ")}</Text>) : <Text style={styles.sub}>No activity has been recorded.</Text>}
  </ScrollView>;
}
export function SplitPaymentScreen({ navigation, route }: NativeStackScreenProps<AppStackParamList, "SplitPayment">) {
  const query = useQuery({ queryKey: splitKeys.expense(route.params.id), queryFn: () => splitMoneyApi.getExpense(route.params.id) }); const client = useQueryClient(); const [amount, setAmount] = useState(""); const flight = useSingleFlight();
  const mutation = useMutation({ mutationFn: () => { const e = query.data!; const p = e.participants?.find(x => x.pendingAmountMinor > 0); const receiver = e.payers?.[0]; const amountMinor = amount.trim() ? Math.round(Number(amount) * 100) : p?.pendingAmountMinor ?? 0; if (!p || !receiver) throw new Error("There is no payable balance on this expense."); if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > p.pendingAmountMinor) throw new Error("Enter an amount up to the pending balance."); return splitMoneyApi.payment(e.id, { participantId: p.id, payerPersonId: p.personId, receiverPersonId: receiver.personId, amountMinor, method: "other", paymentDate: localDateKey(), isFinalSettlement: amountMinor === p.pendingAmountMinor }); }, onSuccess: async () => { await client.invalidateQueries({ queryKey: splitKeys.root }); navigation.goBack(); }, onError: e => Alert.alert("Could not record payment", e instanceof Error ? e.message : "Try again."), onSettled: () => flight.end() });
  if (!query.data) return <View style={styles.fill}><LoadingBlock /></View>; const p = query.data.participants?.find(x => x.pendingAmountMinor > 0);
  return <View style={styles.fill}><View style={styles.page}><BackLink onPress={() => navigation.goBack()} /><Text style={styles.title}>Record payment</Text><Text style={styles.sub}>Each confirmed payment is kept as an individual backend history record. Leave blank to settle the full remaining balance.</Text><Card style={styles.total}><Text style={styles.label}>PENDING BALANCE</Text><Text style={styles.big}>{money(p?.pendingAmountMinor ?? 0, query.data.currency)}</Text></Card><Field label="Payment amount" placeholder="Full pending balance" value={amount} onChangeText={setAmount} keyboardType="decimal-pad"/><AppButton label={mutation.isPending ? "Recording…" : "Confirm payment"} disabled={mutation.isPending} icon="checkmark" onPress={() => flight.run(mutation.isPending, () => mutation.mutate())} /></View></View>;
}
const styles = StyleSheet.create({ fill:{flex:1,backgroundColor:colors.bg},page:{padding:18,gap:13},title:{color:colors.white,fontWeight:"900",fontSize:29},sub:{color:colors.muted,fontSize:12,lineHeight:18},label:{color:colors.muted,fontSize:10,fontWeight:"800",letterSpacing:.6},total:{gap:8,backgroundColor:colors.panel2},big:{color:colors.white,fontWeight:"900",fontSize:31},heading:{color:colors.white,fontSize:17,fontWeight:"900",marginTop:3},row:{padding:14,flexDirection:"row",gap:10},name:{color:colors.white,fontWeight:"800"},amount:{color:colors.white,fontWeight:"900"},pending:{color:colors.orange,fontSize:11,marginTop:3},actions:{gap:10,marginTop:5} });
