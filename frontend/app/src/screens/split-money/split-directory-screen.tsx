import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SplitRelationship } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { Screen } from "../../components/ui/screen";
import { Card } from "../../components/ui/card";
import { AppButton } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { money } from "../../lib/format";
import { friendlyError } from "../../lib/api-errors";
import { useSingleFlight } from "../../lib/single-flight";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { splitKeys } from "../../features/split-money/api/splitMoneyQueries";

const RELATIONSHIPS: SplitRelationship[] = ["friend", "family", "colleague", "other"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// People

export function SplitPeopleScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "SplitPeople">) {
  const client = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const people = useQuery({
    queryKey: [...splitKeys.people, showArchived ? "all" : "active"],
    queryFn: () => splitMoneyApi.people(showArchived),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", relationship: "friend" as SplitRelationship });
  const flight = useSingleFlight();
  const create = useMutation({
    mutationFn: () => {
      const fullName = form.fullName.trim();
      if (!fullName) throw new Error("Name is required.");
      const email = form.email.trim();
      if (email && !EMAIL.test(email)) throw new Error("Enter a valid email or leave it blank.");
      return splitMoneyApi.createPerson({
        fullName,
        phone: form.phone.trim() || null,
        email: email || null,
        countryCode: "IN",
        relationship: form.relationship,
      });
    },
    onSuccess: async (person) => {
      setForm({ fullName: "", phone: "", email: "", relationship: "friend" });
      setOpen(false);
      await client.invalidateQueries({ queryKey: splitKeys.people });
      if ((person as { existing?: boolean }).existing) {
        Alert.alert("Already saved", `${person.fullName} was already in your people list, so no duplicate was created.`);
      }
    },
    onError: (e) => Alert.alert("Could not add person", friendlyError(e)),
    onSettled: () => flight.end(),
  });
  const active = (people.data ?? []).filter((p) => !p.archivedAt);
  const archived = (people.data ?? []).filter((p) => p.archivedAt);

  return (
    <Directory title="People" onBack={() => navigation.goBack()} loading={people.isLoading} error={people.isError} retry={() => void people.refetch()}>
      <Card style={styles.form}>
        {open ? (
          <>
            <Field label="Full name" placeholder="Full name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} autoCapitalize="words" />
            <Field label="Phone (optional)" placeholder="+91…" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <Field label="Email (optional)" placeholder="name@example.com" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.muted}>Relationship</Text>
            <View style={styles.chips}>
              {RELATIONSHIPS.map((r) => (
                <Pressable key={r} onPress={() => setForm({ ...form, relationship: r })} style={[styles.chip, form.relationship === r && styles.chipOn]}>
                  <Text style={[styles.chipText, form.relationship === r && styles.chipTextOn]}>{r}</Text>
                </Pressable>
              ))}
            </View>
            <AppButton label={create.isPending ? "Saving…" : "Save person"} icon="person-add-outline" disabled={create.isPending} onPress={() => flight.run(create.isPending, () => create.mutate())} />
            <AppButton label="Cancel" outline disabled={create.isPending} onPress={() => setOpen(false)} />
          </>
        ) : (
          <AppButton label="Add person" icon="person-add-outline" onPress={() => setOpen(true)} />
        )}
      </Card>
      {active.length === 0 ? <Text style={styles.muted}>No people yet. Add the friends you split with.</Text> : null}
      {active.map((p) => (
        <Pressable key={p.id} onPress={() => navigation.navigate("SplitPersonDetail", { id: p.id })}>
          <Card style={styles.row}>
            <Avatar name={p.fullName} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.fullName}{p.isSelf ? " (you)" : ""}</Text>
              <Text style={styles.muted}>{p.relationship}{p.phone ? ` · ${p.phone}` : ""}{p.email ? ` · ${p.email}` : ""}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
      <Pressable onPress={() => setShowArchived((v) => !v)}>
        <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>{showArchived ? "Hide archived people" : "Show archived people"}</Text>
      </Pressable>
      {showArchived && archived.map((p) => (
        <Pressable key={p.id} onPress={() => navigation.navigate("SplitPersonDetail", { id: p.id })}>
          <Card style={[styles.row, { opacity: 0.6 }]}>
            <Avatar name={p.fullName} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.fullName}</Text>
              <Text style={styles.muted}>archived · history kept</Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </Directory>
  );
}

export function SplitPersonDetailScreen({ navigation, route }: NativeStackScreenProps<AppStackParamList, "SplitPersonDetail">) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: splitKeys.person(route.params.id), queryFn: () => splitMoneyApi.person(route.params.id) });
  const [form, setForm] = useState<{ fullName: string; phone: string; email: string; relationship: SplitRelationship } | null>(null);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: splitKeys.people }),
      client.invalidateQueries({ queryKey: splitKeys.person(route.params.id) }),
      client.invalidateQueries({ queryKey: splitKeys.root }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Nothing to save.");
      if (!form.fullName.trim()) throw new Error("Name is required.");
      const email = form.email.trim();
      if (email && !EMAIL.test(email)) throw new Error("Enter a valid email or leave it blank.");
      return splitMoneyApi.updatePerson(route.params.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        email: email || null,
        relationship: form.relationship,
      });
    },
    onSuccess: async () => {
      setForm(null);
      await refresh();
    },
    onError: (e) => Alert.alert("Could not save", friendlyError(e)),
  });
  const archive = useMutation({
    mutationFn: (restore: boolean) => (restore ? splitMoneyApi.restorePerson(route.params.id) : splitMoneyApi.archivePerson(route.params.id)),
    onSuccess: refresh,
    onError: (e) => Alert.alert("Could not update person", friendlyError(e)),
  });

  return (
    <Directory title="Person" onBack={() => navigation.goBack()} loading={q.isLoading} error={q.isError} retry={() => void q.refetch()}>
      {q.data ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>{q.data.person.fullName}</Text>
            <Text style={styles.muted}>
              {q.data.person.relationship}
              {q.data.person.phone ? ` · ${q.data.person.phone}` : ""}
              {q.data.person.email ? ` · ${q.data.person.email}` : ""}
              {q.data.person.archivedAt ? " · archived" : ""}
            </Text>
            {(q.data.balances?.length ? q.data.balances : [{ currency: q.data.currency ?? "INR", youOweMinor: q.data.youOweMinor, youAreOwedMinor: q.data.youAreOwedMinor }]).map((b) => (
              <Text key={b.currency} style={styles.name}>
                They owe you {money(b.youAreOwedMinor, b.currency)} · You owe them {money(b.youOweMinor, b.currency)}
              </Text>
            ))}
            <Text style={styles.muted}>Balances come from the server ledger across all shared expenses with this person.</Text>
          </Card>

          {form ? (
            <Card style={styles.form}>
              <Field label="Name" placeholder="Full name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} autoCapitalize="words" />
              <Field label="Phone" placeholder="Optional" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              <Field label="Email" placeholder="Optional" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
              <View style={styles.chips}>
                {RELATIONSHIPS.map((r) => (
                  <Pressable key={r} onPress={() => setForm({ ...form, relationship: r })} style={[styles.chip, form.relationship === r && styles.chipOn]}>
                    <Text style={[styles.chipText, form.relationship === r && styles.chipTextOn]}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <AppButton label={save.isPending ? "Saving…" : "Save person"} icon="checkmark" disabled={save.isPending} onPress={() => { if (!save.isPending) save.mutate(); }} />
              <AppButton label="Discard" outline disabled={save.isPending} onPress={() => setForm(null)} />
            </Card>
          ) : (
            <AppButton
              label="Edit person"
              icon="create-outline"
              outline
              onPress={() =>
                setForm({
                  fullName: q.data!.person.fullName,
                  phone: q.data!.person.phone ?? "",
                  email: q.data!.person.email ?? "",
                  relationship: q.data!.person.relationship,
                })
              }
            />
          )}

          {!q.data.person.isSelf ? (
            q.data.person.archivedAt ? (
              <AppButton label={archive.isPending ? "Restoring…" : "Restore person"} icon="refresh-outline" outline disabled={archive.isPending} onPress={() => archive.mutate(true)} />
            ) : (
              <AppButton
                label={archive.isPending ? "Archiving…" : "Archive person"}
                icon="archive-outline"
                outline
                disabled={archive.isPending}
                onPress={() =>
                  Alert.alert(
                    "Archive person?",
                    "They are hidden from new splits. Every past expense and repayment stays in history. You can restore them later.",
                    [
                      { text: "Keep", style: "cancel" },
                      { text: "Archive", style: "destructive", onPress: () => archive.mutate(false) },
                    ],
                  )
                }
              />
            )
          ) : null}

          <Text style={styles.name}>Shared expenses</Text>
          {q.data.expenses.length === 0 ? <Text style={styles.muted}>No shared expenses yet.</Text> : null}
          {q.data.expenses.map((e) => (
            <Pressable key={e.id} onPress={() => navigation.navigate("SplitExpense", { id: e.id })}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.title}</Text>
                  <Text style={styles.muted}>{e.expenseDate} · {e.status.replaceAll("_", " ")}</Text>
                </View>
                <Text style={styles.name}>{money(e.totalAmountMinor, e.currency)}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </Directory>
  );
}

// ---------------------------------------------------------------------------
// Groups

export function SplitGroupsScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "SplitGroups">) {
  const client = useQueryClient();
  const groups = useQuery({ queryKey: splitKeys.groups, queryFn: () => splitMoneyApi.groups() });
  const people = useQuery({ queryKey: splitKeys.people, queryFn: () => splitMoneyApi.people() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const flight = useSingleFlight();
  const create = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Group name is required.");
      return splitMoneyApi.createGroup({
        name: name.trim(),
        description: description.trim() || null,
        category: null,
        imageUrl: null,
        memberPersonIds: memberIds,
        groupType: "shared",
        currency: "INR",
        defaultSplitMethod: "equal",
        defaultDueDays: 7,
        allowMemberAdd: true,
        allowMemberEdit: true,
        allowMemberSettle: true,
        sendNotifications: true,
      });
    },
    onSuccess: async (group) => {
      setName("");
      setDescription("");
      setMemberIds([]);
      setOpen(false);
      await client.invalidateQueries({ queryKey: splitKeys.groups });
      navigation.navigate("SplitGroupDetail", { id: group.id });
    },
    onError: (e) => Alert.alert("Could not create group", friendlyError(e)),
    onSettled: () => flight.end(),
  });
  const candidates = (people.data ?? []).filter((p) => !p.isSelf && !p.archivedAt);

  return (
    <Directory title="Groups" onBack={() => navigation.goBack()} loading={groups.isLoading} error={groups.isError} retry={() => void groups.refetch()}>
      <Card style={styles.form}>
        {open ? (
          <>
            <Field label="Group name" placeholder="Trip, home, family…" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label="Description (optional)" placeholder="What is this group for?" value={description} onChangeText={setDescription} autoCapitalize="sentences" />
            <Text style={styles.muted}>Members (you are added automatically)</Text>
            {candidates.length === 0 ? (
              <Text style={styles.muted}>No people yet — add people first, or create the group and add members later.</Text>
            ) : (
              candidates.map((p) => {
                const on = memberIds.includes(p.id);
                return (
                  <Pressable key={p.id} onPress={() => setMemberIds((ids) => (on ? ids.filter((id) => id !== p.id) : [...ids, p.id]))}>
                    <Card style={[styles.row, on ? styles.rowOn : null]}>
                      <Avatar name={p.fullName} />
                      <Text style={[styles.name, { flex: 1 }]}>{p.fullName}</Text>
                      <Text style={{ color: on ? colors.green : colors.muted, fontWeight: "800" }}>{on ? "Added" : "Add"}</Text>
                    </Card>
                  </Pressable>
                );
              })
            )}
            <AppButton label={create.isPending ? "Creating…" : `Create group${memberIds.length ? ` with ${memberIds.length} member${memberIds.length === 1 ? "" : "s"}` : ""}`} icon="add-circle-outline" disabled={create.isPending} onPress={() => flight.run(create.isPending, () => create.mutate())} />
            <AppButton label="Cancel" outline disabled={create.isPending} onPress={() => setOpen(false)} />
          </>
        ) : (
          <AppButton label="Create group" icon="add-circle-outline" onPress={() => setOpen(true)} />
        )}
      </Card>
      {(groups.data ?? []).length === 0 ? <Text style={styles.muted}>No groups yet.</Text> : null}
      {groups.data?.map((g) => (
        <Pressable key={g.id} onPress={() => navigation.navigate("SplitGroupDetail", { id: g.id })}>
          <Card style={styles.row}>
            <Avatar name={g.name} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{g.name}</Text>
              <Text style={styles.muted}>{g.members?.length ?? 0} members · {g.defaultSplitMethod} · {g.currency}</Text>
            </View>
            {typeof g.yourNetMinor === "number" && g.yourNetMinor !== 0 ? (
              <Text style={{ color: g.yourNetMinor > 0 ? colors.green : colors.orange, fontWeight: "800" }}>
                {g.yourNetMinor > 0 ? `+${money(g.yourNetMinor, g.currency)}` : `−${money(-g.yourNetMinor, g.currency)}`}
              </Text>
            ) : null}
          </Card>
        </Pressable>
      ))}
    </Directory>
  );
}

export function SplitGroupDetailScreen({ navigation, route }: NativeStackScreenProps<AppStackParamList, "SplitGroupDetail">) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: splitKeys.group(route.params.id), queryFn: () => splitMoneyApi.group(route.params.id) });
  const people = useQuery({ queryKey: splitKeys.people, queryFn: () => splitMoneyApi.people() });
  const [name, setName] = useState<string | null>(null);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: splitKeys.groups });
    await client.invalidateQueries({ queryKey: splitKeys.group(route.params.id) });
  };
  const save = useMutation({
    mutationFn: () => {
      if (!name?.trim()) throw new Error("Group name is required.");
      return splitMoneyApi.updateGroup(route.params.id, { name: name.trim() });
    },
    onSuccess: async () => {
      setName(null);
      await refresh();
    },
    onError: (e) => Alert.alert("Could not save", friendlyError(e)),
  });
  const add = useMutation({
    mutationFn: (personId: string) => splitMoneyApi.addGroupMember(route.params.id, personId),
    onSuccess: refresh,
    onError: (e) => Alert.alert("Could not add member", friendlyError(e)),
  });
  const remove = useMutation({
    mutationFn: (memberId: string) => splitMoneyApi.removeGroupMember(route.params.id, memberId),
    onSuccess: refresh,
    onError: (e) => Alert.alert("Could not remove member", friendlyError(e)),
  });
  const g = q.data;
  const currency = g?.currency ?? "INR";
  const balances = g?.memberBalances ?? [];
  const balanceFor = (personId: string) => balances.find((b) => b.personId === personId);
  const summary = g?.summary;

  return (
    <Directory title="Group" onBack={() => navigation.goBack()} loading={q.isLoading} error={q.isError} retry={() => void q.refetch()}>
      {g ? (
        <>
          <Card style={{ gap: 6 }}>
            <Text style={styles.title}>{g.name}</Text>
            <Text style={styles.muted}>{g.description ?? "No description"} · {g.currency} · default {g.defaultSplitMethod}</Text>
            <Text style={styles.name}>
              Shared {money(summary?.totalSharedMinor ?? 0, currency)} · Repaid {money(summary?.collectedMinor ?? 0, currency)} · Outstanding{" "}
              {money(summary?.outstandingMinor ?? 0, currency)}
            </Text>
            <Text style={styles.muted}>
              {summary?.memberCount ?? g.members?.length ?? 0} members · {summary?.activeExpenses ?? 0} active · {summary?.settledExpenses ?? 0} settled ·{" "}
              {summary?.settledPercent ?? 0}% settled
            </Text>
          </Card>

          <AppButton label="Add expense to this group" icon="add-circle-outline" onPress={() => navigation.navigate("SplitCreate", { groupId: g.id })} />

          <Text style={styles.name}>Member balances</Text>
          <Text style={styles.muted}>Positive = should receive, negative = owes. Server-computed across every expense in this group.</Text>
          {balances.length === 0 ? <Text style={styles.muted}>No balances yet.</Text> : null}
          {balances.map((b) => (
            <Card key={b.personId} style={styles.row}>
              <Avatar name={b.person?.fullName ?? "?"} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{b.person?.fullName ?? "Unknown"}{b.isMember ? "" : " (former)"}</Text>
                <Text style={styles.muted}>
                  share {money(b.shareMinor, currency)} · upfront {money(b.upfrontPaidMinor, currency)} · repaid {money(b.repaymentSentMinor, currency)} · received{" "}
                  {money(b.repaymentReceivedMinor, currency)}
                </Text>
              </View>
              <Text style={{ fontWeight: "900", color: b.netMinor > 0 ? colors.green : b.netMinor < 0 ? colors.orange : colors.muted }}>
                {b.netMinor > 0 ? `+${money(b.netMinor, currency)}` : b.netMinor < 0 ? `−${money(-b.netMinor, currency)}` : "settled"}
              </Text>
            </Card>
          ))}

          <Text style={styles.name}>Members</Text>
          {g.members?.map((m) => {
            const b = balanceFor(m.personId);
            return (
              <Card key={m.id} style={styles.row}>
                <Avatar name={m.person?.fullName ?? "Member"} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.person?.fullName ?? "Member"}</Text>
                  <Text style={styles.muted}>{m.role}{b && b.netMinor !== 0 ? (b.netMinor > 0 ? ` · is owed ${money(b.netMinor, currency)}` : ` · owes ${money(-b.netMinor, currency)}`) : " · settled"}</Text>
                </View>
                {m.role !== "owner" && !m.person?.isSelf ? (
                  <Pressable
                    disabled={remove.isPending}
                    onPress={() =>
                      Alert.alert(
                        "Remove member?",
                        b && b.netMinor !== 0
                          ? `${m.person?.fullName ?? "This member"} still ${b.netMinor < 0 ? "owes" : "is owed"} ${money(Math.abs(b.netMinor), currency)} in this group. The server will refuse removal until it is settled.`
                          : `Remove ${m.person?.fullName ?? "this member"} from the group? Their past expenses stay in history.`,
                        [
                          { text: "Keep", style: "cancel" },
                          { text: "Remove", style: "destructive", onPress: () => remove.mutate(m.id) },
                        ],
                      )
                    }
                  >
                    <Text style={{ color: colors.red, fontWeight: "800" }}>{remove.isPending ? "…" : "Remove"}</Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })}

          <Text style={styles.name}>Add member</Text>
          {(people.data ?? [])
            .filter((p) => !p.archivedAt && !g.members?.some((m) => m.personId === p.id))
            .map((p) => (
              <AppButton key={p.id} label={add.isPending ? "Adding…" : `Add ${p.fullName}`} icon="person-add-outline" outline disabled={add.isPending} onPress={() => { if (!add.isPending) add.mutate(p.id); }} />
            ))}

          <Text style={styles.name}>Settings</Text>
          {name === null ? (
            <AppButton label="Rename group" icon="create-outline" outline onPress={() => setName(g.name)} />
          ) : (
            <Card style={styles.form}>
              <Field label="Group name" placeholder="Group name" value={name} onChangeText={setName} />
              <AppButton label={save.isPending ? "Saving…" : "Save group"} icon="checkmark" disabled={save.isPending} onPress={() => { if (!save.isPending) save.mutate(); }} />
              <AppButton label="Discard" outline disabled={save.isPending} onPress={() => setName(null)} />
            </Card>
          )}

          <Text style={styles.name}>Expenses</Text>
          {(g.expenses ?? []).length === 0 ? <Text style={styles.muted}>No expenses in this group yet.</Text> : null}
          {g.expenses?.map((e) => (
            <Pressable key={e.id} onPress={() => navigation.navigate("SplitExpense", { id: e.id })}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.title}</Text>
                  <Text style={styles.muted}>
                    {e.expenseDate} · {e.status.replaceAll("_", " ")} · repaid {money(e.ledger?.collectedMinor ?? e.collectedMinor ?? 0, e.currency)} of{" "}
                    {money(e.ledger?.collectibleMinor ?? e.collectibleMinor ?? 0, e.currency)}
                  </Text>
                </View>
                <Text style={styles.name}>{money(e.totalAmountMinor, e.currency)}</Text>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}
    </Directory>
  );
}

// ---------------------------------------------------------------------------
// History

export function SplitHistoryScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "SplitHistory">) {
  const history = useQuery({ queryKey: splitKeys.history, queryFn: () => splitMoneyApi.history() });
  const [tab, setTab] = useState<"all" | "owe" | "owed" | "settled">("all");
  const s = history.data?.summary;
  const filtered = (history.data?.expenses ?? []).filter((e) => {
    const net = (e.youAreOwedMinor ?? 0) - (e.youOweMinor ?? 0);
    if (tab === "owe") return net < 0;
    if (tab === "owed") return net > 0;
    if (tab === "settled") return e.status === "settled";
    return true;
  });
  return (
    <Directory title="Split history" onBack={() => navigation.goBack()} loading={history.isLoading} error={history.isError} retry={() => void history.refetch()}>
      {s ? (
        <Card style={{ gap: 4 }}>
          <Text style={styles.name}>{s.totalExpenses} expenses · {money(s.totalExpensesMinor, s.currency)}</Text>
          <Text style={styles.muted}>
            Your share {money(s.yourShareMinor, s.currency)} · You paid upfront {money(s.youPaidMinor, s.currency)}
          </Text>
          <Text style={styles.muted}>
            You owe {money(s.youOweMinor, s.currency)} · You'll receive {money(s.youllReceiveMinor, s.currency)}
          </Text>
          <Text style={styles.muted}>
            Repayments recorded {money(s.repaymentsRecordedMinor ?? 0, s.currency)} · Outstanding {money(s.outstandingMinor ?? 0, s.currency)}
          </Text>
        </Card>
      ) : null}
      <View style={styles.chips}>
        {(
          [
            ["all", "All"],
            ["owe", "You owe"],
            ["owed", "Others owe"],
            ["settled", "Settled"],
          ] as const
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.chip, tab === id && styles.chipOn]}>
            <Text style={[styles.chipText, tab === id && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {filtered.length === 0 ? <Text style={styles.muted}>No split expenses match this filter.</Text> : null}
      {filtered.map((e) => {
        const net = (e.youAreOwedMinor ?? 0) - (e.youOweMinor ?? 0);
        return (
          <Pressable key={e.id} onPress={() => navigation.navigate("SplitExpense", { id: e.id })}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.title}</Text>
                <Text style={styles.muted}>
                  {e.expenseDate} · {e.status.replaceAll("_", " ")} ·{" "}
                  {net > 0 ? `you're owed ${money(net, e.currency)}` : net < 0 ? `you owe ${money(-net, e.currency)}` : "settled"}
                </Text>
              </View>
              <Text style={styles.name}>{money(e.totalAmountMinor, e.currency)}</Text>
            </Card>
          </Pressable>
        );
      })}
    </Directory>
  );
}

// ---------------------------------------------------------------------------

function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

function Directory({ title, onBack, loading, error, retry, children }: { title: string; onBack: () => void; loading: boolean; error: boolean; retry: () => void; children: ReactNode }) {
  return (
    <Screen onBack={onBack}>
      <Text style={styles.title}>{title}</Text>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={`Could not load ${title.toLowerCase()}.`} onRetry={retry} /> : children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  page: { padding: 18, gap: 12, paddingBottom: 32 },
  title: { color: colors.white, fontSize: 29, fontWeight: "900" },
  form: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowOn: { borderColor: colors.green, borderWidth: 1 },
  avatar: { height: 38, width: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  avatarText: { color: colors.ink, fontWeight: "900" },
  name: { color: colors.white, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontWeight: "700", textTransform: "capitalize" },
  chipTextOn: { color: colors.ink },
});
