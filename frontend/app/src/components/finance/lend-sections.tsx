import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { LendRecord, RepaymentStatus } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import { Card } from "../ui/card";
import { AppButton } from "../ui/button";
import { Field } from "../ui/field";
import { financeService } from "../../services/finance.service";
import { friendlyError } from "../../lib/api-errors";
import { useSingleFlight } from "../../lib/single-flight";
import { localDateKey, money } from "../../lib/format";

const repaymentLabels: Record<RepaymentStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_REPAID: "Partially repaid",
  REPAID: "Repaid",
  OVERPAID: "Overpaid",
};
export const repaymentLabel = (status?: RepaymentStatus) => (status ? repaymentLabels[status] : "Pending");

const frequencies = [
  { value: "ONCE", label: "Once" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BEFORE_DUE", label: "Day before due" },
] as const;
type Frequency = (typeof frequencies)[number]["value"];

const pad = (n: number) => String(n).padStart(2, "0");
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const formatStamp = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : `${localDateKey(date)} ${localTime(date)}`;
};

export function LendRepaymentSection({ record }: { record: LendRecord }) {
  const client = useQueryClient();
  const history = useQuery({ queryKey: ["lend-records", record.id, "repayments"], queryFn: () => financeService.listLendRepayments(record.id) });
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(localDateKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const key = useRef(randomUUID());
  const flight = useSingleFlight();

  const submit = () => {
    const value = amount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) return setError("Enter a repayment amount greater than 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt.trim()) || paidAt.trim() > localDateKey()) return setError("Paid date must be YYYY-MM-DD and not in the future.");
    setError("");
    flight.run(saving, () => {
      setSaving(true);
      setStatus("");
      void financeService
        .recordLendRepayment(record.id, { amountMinor: Math.round(Number(value) * 100), paidAt: paidAt.trim(), note: note.trim() || null }, key.current)
        .then(async ({ record: updated }) => {
          key.current = randomUUID();
          setAmount("");
          setNote("");
          setStatus(`Recorded ${money(Math.round(Number(value) * 100), record.currency)}. ${repaymentLabel(updated.repaymentStatus)}.`);
          await Promise.all([client.invalidateQueries({ queryKey: ["lend-records"] }), client.invalidateQueries({ queryKey: ["dashboard"] })]);
        })
        .catch((e) => setError(friendlyError(e, "Could not record repayment.")))
        .finally(() => {
          setSaving(false);
          flight.end();
        });
    });
  };

  const items = [...(history.data?.items ?? [])].sort((a, b) => (b.paidAt === a.paidAt ? b.createdAt.localeCompare(a.createdAt) : b.paidAt.localeCompare(a.paidAt)));
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Record repayment</Text>
      <Card style={styles.card}>
        <Field label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <Field label="Paid date" placeholder="YYYY-MM-DD" value={paidAt} onChangeText={setPaidAt} />
        <Field label="Note (optional)" placeholder="UPI, cash, etc." value={note} onChangeText={setNote} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {status ? <Text style={styles.ok} accessibilityLiveRegion="polite">{status}</Text> : null}
        <AppButton label={saving ? "Saving…" : "Record repayment"} icon="cash-outline" disabled={saving} onPress={submit} />
      </Card>
      <Text style={styles.heading}>Repayment history</Text>
      {history.isLoading ? <Text style={styles.sub}>Loading history…</Text> : null}
      {history.isError ? <Text style={styles.error}>{friendlyError(history.error, "Could not load history.")}</Text> : null}
      {history.isSuccess && !items.length ? <Text style={styles.sub}>No repayments recorded yet.</Text> : null}
      {items.map((item) => (
        <Card key={item.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.paidAt}</Text>
            <Text style={styles.sub}>{item.note ?? "No note"}</Text>
          </View>
          <Text style={styles.amount}>{money(item.amountMinor, record.currency)}</Text>
        </Card>
      ))}
    </View>
  );
}

export function LendReminderSection({ record }: { record: LendRecord }) {
  const client = useQueryClient();
  const queryKey = ["lend-records", record.id, "reminder"];
  const reminder = useQuery({ queryKey, queryFn: () => financeService.getLendReminder(record.id) });
  const [enabled, setEnabled] = useState(true);
  const [date, setDate] = useState(localDateKey());
  const [time, setTime] = useState("09:00");
  const [frequency, setFrequency] = useState<Frequency>("ONCE");
  const [busy, setBusy] = useState<"save" | "disable" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const flight = useSingleFlight();
  const current = reminder.data?.reminder ?? null;

  useEffect(() => {
    if (!current) return;
    const at = new Date(current.remindAt);
    setEnabled(current.enabled);
    if (!Number.isNaN(at.getTime())) {
      setDate(localDateKey(at));
      setTime(localTime(at));
    }
    setFrequency(current.frequency as Frequency);
  }, [current?.id, current?.remindAt, current?.enabled, current?.frequency]);

  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return setError("Date must be YYYY-MM-DD.");
    if (!/^\d{2}:\d{2}$/.test(time.trim())) return setError("Time must be HH:MM (24-hour).");
    const at = new Date(`${date.trim()}T${time.trim()}:00`);
    if (Number.isNaN(at.getTime())) return setError("Choose a valid reminder time.");
    setError("");
    flight.run(busy !== null, () => {
      setBusy("save");
      void financeService
        .putLendReminder(record.id, { enabled, remindAt: at.toISOString(), frequency })
        .then(async () => {
          await client.invalidateQueries({ queryKey });
          setMessage(enabled ? "Reminder saved." : "Reminder saved as off.");
        })
        .catch((e) => setError(friendlyError(e, "Could not save reminder.")))
        .finally(() => {
          setBusy(null);
          flight.end();
        });
    });
  };

  const disable = () =>
    Alert.alert("Turn off reminder?", "No further reminders will be created for this record.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Turn off",
        style: "destructive",
        onPress: () =>
          flight.run(busy !== null, () => {
            setBusy("disable");
            void financeService
              .deleteLendReminder(record.id)
              .then(async () => {
                await client.invalidateQueries({ queryKey });
                setMessage("Reminder turned off.");
              })
              .catch((e) => setError(friendlyError(e, "Could not turn off reminder.")))
              .finally(() => {
                setBusy(null);
                flight.end();
              });
          }),
      },
    ]);

  const notice = reminder.data?.notices[0];
  const settled = record.status === "settled" || record.repaymentStatus === "REPAID" || record.repaymentStatus === "OVERPAID";
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Reminder</Text>
      <Card style={styles.card}>
        {reminder.isLoading ? <Text style={styles.sub}>Loading reminder…</Text> : null}
        {reminder.isError ? <Text style={styles.error}>{friendlyError(reminder.error, "Could not load reminder.")}</Text> : null}
        <Text style={styles.sub}>
          {current
            ? current.enabled
              ? `On · ${frequencies.find((f) => f.value === current.frequency)?.label ?? current.frequency} · next ${formatStamp(current.nextRunAt)}`
              : "Off"
            : "No reminder set."}
          {notice ? `\nLast shown in the app ${formatStamp(notice.createdAt)}` : ""}
        </Text>
        {settled ? (
          <Text style={styles.sub}>This record is fully repaid, so reminders are not available.</Text>
        ) : (
          <>
            <View style={styles.chips}>
              <Chip label={enabled ? "Enabled" : "Disabled"} active={enabled} onPress={() => setEnabled(!enabled)} />
            </View>
            <View style={styles.split}>
              <View style={{ flex: 1 }}><Field label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} /></View>
              <View style={{ flex: 1 }}><Field label="Time" placeholder="HH:MM" value={time} onChangeText={setTime} /></View>
            </View>
            <View style={styles.chips}>
              {frequencies.map((f) => <Chip key={f.value} label={f.label} active={frequency === f.value} onPress={() => setFrequency(f.value)} />)}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.ok} accessibilityLiveRegion="polite">{message}</Text> : null}
            <AppButton label={busy === "save" ? "Saving…" : current ? "Update reminder" : "Save reminder"} icon="alarm-outline" disabled={busy !== null} onPress={save} />
            {current ? <AppButton label={busy === "disable" ? "Turning off…" : "Turn off reminder"} outline disabled={busy !== null} onPress={disable} /> : null}
          </>
        )}
        <Text style={styles.sub}>Reminders appear inside Hisaab only. Email and push delivery are not available yet.</Text>
      </Card>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 6 },
  card: { gap: 10, padding: 14 },
  row: { flexDirection: "row", gap: 10, padding: 14, alignItems: "center" },
  name: { color: colors.white, fontWeight: "800" },
  amount: { color: colors.white, fontWeight: "900", fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  ok: { color: colors.green, fontSize: 12, lineHeight: 18 },
  error: { color: colors.red, fontSize: 12, lineHeight: 18 },
  split: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { borderColor: colors.green, backgroundColor: colors.panel2 },
  chipText: { color: colors.white, fontSize: 12, fontWeight: "800" },
});
