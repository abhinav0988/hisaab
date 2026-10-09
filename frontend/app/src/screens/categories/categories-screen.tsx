import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categorySchema } from "@hisaab/validation";
import type { Category, TransactionType } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { categoryService } from "../../services/category.service";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "Categories">;
const types: TransactionType[] = ["EXPENSE", "INCOME", "TRANSFER"];
export function CategoriesScreen({ navigation }: Props) {
  const client = useQueryClient(); const list = useQuery({ queryKey: ["categories"], queryFn: categoryService.list });
  const [editing, setEditing] = useState<Category | null>(null); const [name, setName] = useState(""); const [type, setType] = useState<TransactionType>("EXPENSE"); const [colour, setColour] = useState("#55E7A0"); const [icon, setIcon] = useState("pricetag");
  const close = () => { setEditing(null); setName(""); setType("EXPENSE"); setColour("#55E7A0"); setIcon("pricetag"); };
  const save = useMutation({ mutationFn: async () => { const parsed = categorySchema.safeParse({ name, type, colour, icon }); if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check category values."); return editing ? categoryService.update(editing.id, parsed.data) : categoryService.create(parsed.data); }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ["categories"] }); close(); }, onError: e => Alert.alert("Could not save category", e instanceof Error ? e.message : "Try again.") });
  const remove = useMutation({ mutationFn: (id: string) => categoryService.delete(id), onSuccess: () => void client.invalidateQueries({ queryKey: ["categories"] }), onError: e => Alert.alert("Could not delete category", e instanceof Error ? e.message : "Try again.") });
  const startEdit = (item: Category) => { setEditing(item); setName(item.name); setType(item.type); setColour(item.colour); setIcon(item.icon); };
  const confirmDelete = (item: Category) => Alert.alert("Delete category?", `Delete ${item.name}? Existing transactions keep their history.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { if (!remove.isPending) remove.mutate(item.id); } }]);
  if (list.isLoading) return <View style={styles.fill}><LoadingBlock /></View>;
  if (list.isError) return <View style={styles.fill}><ErrorBlock message="Could not load categories." onRetry={() => void list.refetch()} /></View>;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><BackLink onPress={() => navigation.goBack()}/><Text style={styles.title}>Categories</Text><Card style={styles.form}><Text style={styles.formTitle}>{editing ? "Edit category" : "New category"}</Text><Field label="Name" placeholder="Food, salary…" value={name} onChangeText={setName}/><Text style={styles.label}>TYPE</Text><View style={styles.chips}>{types.map(value => <Pressable key={value} onPress={() => setType(value)} style={[styles.chip, type === value && styles.active]}><Text style={[styles.chipText, type === value && styles.activeText]}>{value}</Text></Pressable>)}</View><Field label="Icon" placeholder="pricetag" value={icon} onChangeText={setIcon}/><Field label="Colour" placeholder="#55E7A0" value={colour} onChangeText={setColour}/><AppButton label={save.isPending ? "Saving…" : editing ? "Save category" : "Add category"} onPress={() => { if (!save.isPending) save.mutate(); }}/>{editing ? <AppButton label="Cancel edit" outline onPress={close}/> : null}</Card><Text style={styles.label}>YOUR CATEGORIES</Text>{list.data?.length ? list.data.map(item => <Card key={item.id} style={styles.row}><View style={[styles.swatch, { backgroundColor: item.colour }]}/><View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.muted}>{item.type}{item.isSystem ? " · System" : ""}</Text></View><Pressable onPress={() => startEdit(item)}><Text style={styles.action}>Edit</Text></Pressable>{!item.isSystem ? <Pressable onPress={() => confirmDelete(item)}><Text style={styles.delete}>Delete</Text></Pressable> : null}</Card>) : <EmptyBlock title="No categories" body="Create one to organize transactions."/>}</ScrollView>;
}
const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: colors.bg }, page: { padding: 18, gap: 12 }, title: { color: colors.white, fontSize: 29, fontWeight: "900" }, form: { gap: 12 }, formTitle: { color: colors.white, fontSize: 17, fontWeight: "900" }, label: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: .7 }, chips: { flexDirection: "row", gap: 7, flexWrap: "wrap" }, chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 }, active: { backgroundColor: colors.green, borderColor: colors.green }, chipText: { color: colors.white, fontSize: 11, fontWeight: "800" }, activeText: { color: colors.ink }, row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 }, swatch: { width: 28, height: 28, borderRadius: 14 }, name: { color: colors.white, fontWeight: "800" }, muted: { color: colors.muted, fontSize: 12 }, action: { color: colors.green, fontWeight: "800", fontSize: 12 }, delete: { color: colors.red, fontWeight: "800", fontSize: 12, marginLeft: 10 } });
