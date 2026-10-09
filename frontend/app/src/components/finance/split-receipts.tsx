import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { OcrReceiptResult, SplitExpense, SplitReceipt } from "@hisaab/types";
import { colors } from "../../theme/tokens";
import { Card } from "../ui/card";
import { AppButton } from "../ui/button";
import { Field } from "../ui/field";
import { splitMoneyApi } from "../../features/split-money/api/splitMoneyApi";
import { nativePickerService } from "../../services/native-picker.service";
import { fileKind, fileService, isScannable } from "../../services/file.service";
import { friendlyError } from "../../lib/api-errors";
import { useSingleFlight } from "../../lib/single-flight";

type Source = "gallery" | "camera" | "document";
const sourceLabel: Record<Source, string> = { gallery: "Gallery", camera: "Camera", document: "Documents" };

const minorToText = (value: number | null) => (value == null ? "" : (value / 100).toFixed(2));
const validAmount = (value: string) => value.trim() === "" || /^\d+(\.\d{1,2})?$/.test(value.trim());
const validDate = (value: string) => value.trim() === "" || /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

export function SplitReceipts({ expense, onChanged, onUseValues }: { expense: SplitExpense; onChanged: () => Promise<void>; onUseValues: (values: { amount: string; note: string }) => void }) {
  const flight = useSingleFlight();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [scanned, setScanned] = useState<{ receiptId: string; result: OcrReceiptResult } | null>(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState("");
  const [tax, setTax] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const receipts = expense.receipts ?? [];

  const finish = () => {
    setBusy(null);
    flight.end();
  };

  const upload = (source: Source) =>
    flight.run(busy !== null, () => {
      setBusy(source);
      setStatus("");
      void (async () => {
        try {
          const picked = source === "gallery" ? await nativePickerService.pickImage() : source === "camera" ? await nativePickerService.takePhoto() : await nativePickerService.pickDocument();
          if (!picked) {
            setStatus("No file selected. Nothing was uploaded.");
            return;
          }
          setStatus(`Uploading ${picked.name}…`);
          const stored = await fileService.upload(picked);
          setStatus(`Attaching ${stored.originalName}…`);
          try {
            await splitMoneyApi.attachReceipt(expense.id, stored.id);
          } catch (error) {
            setStatus(`${stored.originalName} uploaded but could not be attached. ${friendlyError(error)}`);
            return;
          }
          await onChanged();
          setStatus(`Attached ${stored.originalName}`);
        } catch (error) {
          setStatus(friendlyError(error, "Could not upload this receipt."));
        } finally {
          finish();
        }
      })();
    });

  const chooseSource = () =>
    Alert.alert("Add receipt", "Choose where the receipt comes from.", [
      { text: "Camera", onPress: () => upload("camera") },
      { text: "Gallery", onPress: () => upload("gallery") },
      { text: "Documents", onPress: () => upload("document") },
    ], { cancelable: true });

  const confirmRemove = (receipt: SplitReceipt) =>
    Alert.alert("Remove receipt?", `${receipt.fileName ?? "This receipt"} will be unlinked from this expense. The uploaded file is kept.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          flight.run(busy !== null, () => {
            setBusy(`remove:${receipt.id}`);
            void splitMoneyApi
              .deleteReceipt(expense.id, receipt.id)
              .then(async () => {
                if (scanned?.receiptId === receipt.id) setScanned(null);
                await onChanged();
                setStatus("Receipt removed");
              })
              .catch((error) => setStatus(friendlyError(error, "Could not remove receipt.")))
              .finally(finish);
          }),
      },
    ]);

  const scan = (receipt: SplitReceipt) =>
    flight.run(busy !== null || !receipt.fileId, () => {
      setBusy(`scan:${receipt.id}`);
      setConfirmed(false);
      setFormError("");
      setStatus("Scanning receipt…");
      void fileService
        .scanReceipt(receipt.fileId!)
        .then((result) => {
          setScanned({ receiptId: receipt.id, result });
          setMerchant(result.merchant ?? "");
          setDate(result.date ?? "");
          setTotal(minorToText(result.totalMinor));
          setCurrency(result.currency ?? "");
          setTax(minorToText(result.taxMinor));
          setStatus(result.detected ? "Review the suggestion. Nothing is saved until you confirm." : "No receipt text was detected. Enter the details manually.");
        })
        .catch((error) => {
          setScanned(null);
          setStatus(friendlyError(error, "Could not scan this receipt. You can enter the details manually."));
        })
        .finally(finish);
    });

  const confirm = () => {
    if (!validAmount(total) || !validAmount(tax)) return setFormError("Total and tax must be amounts like 125.50.");
    if (!validDate(date)) return setFormError("Date must be YYYY-MM-DD.");
    if (currency.trim() && !/^[A-Za-z]{3}$/.test(currency.trim())) return setFormError("Currency must be a 3-letter code like INR.");
    setFormError("");
    setConfirmed(true);
    setStatus("Values confirmed. No transaction has been created.");
  };

  const result = scanned?.result;
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Receipts</Text>
      {receipts.length ? (
        receipts.map((receipt) => {
          const scannable = isScannable(receipt.mimeType);
          return (
            <Card key={receipt.id} style={styles.item}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{receipt.fileName ?? "Receipt"}</Text>
                  <Text style={styles.sub}>{fileKind(receipt.mimeType)} · Uploaded</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${receipt.fileName ?? "receipt"}`} disabled={busy !== null} onPress={() => confirmRemove(receipt)}>
                  <Text style={styles.remove}>{busy === `remove:${receipt.id}` ? "Removing…" : "Remove"}</Text>
                </Pressable>
              </View>
              {scannable && receipt.fileId ? (
                <AppButton label={busy === `scan:${receipt.id}` ? "Scanning…" : "Scan receipt"} icon="scan-outline" outline disabled={busy !== null} onPress={() => scan(receipt)} />
              ) : (
                <Text style={styles.sub}>PDF receipts are stored but cannot be scanned.</Text>
              )}
            </Card>
          );
        })
      ) : (
        <Text style={styles.sub}>No receipts yet. Add a photo, image, or PDF up to 8 MB.</Text>
      )}
      <AppButton label={busy && sourceLabel[busy as Source] ? `Waiting for ${sourceLabel[busy as Source]}…` : "Add receipt"} icon="camera-outline" outline disabled={busy !== null} onPress={chooseSource} />
      {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
      {result ? (
        <Card style={styles.form}>
          <Text style={styles.label}>SCANNED SUGGESTION · {result.detected ? `CONFIDENCE ${Math.round((result.confidence ?? 0) * 100)}%` : "NOTHING DETECTED"}</Text>
          <Field label="Merchant" placeholder="Not detected" value={merchant} onChangeText={(v) => { setMerchant(v); setConfirmed(false); }} />
          <Field label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={(v) => { setDate(v); setConfirmed(false); }} />
          <Field label="Total" placeholder="Not detected" value={total} keyboardType="decimal-pad" onChangeText={(v) => { setTotal(v); setConfirmed(false); }} />
          <Field label="Currency" placeholder="Not detected" value={currency} autoCapitalize="none" onChangeText={(v) => { setCurrency(v.toUpperCase()); setConfirmed(false); }} />
          <Field label="Tax" placeholder="Not detected" value={tax} keyboardType="decimal-pad" onChangeText={(v) => { setTax(v); setConfirmed(false); }} />
          <Text style={styles.label}>ITEMS</Text>
          {result.items.length ? result.items.map((line, index) => (
            <Text key={`${line.name}-${index}`} style={styles.sub}>{line.name}{line.quantity != null ? ` × ${line.quantity}` : ""}{line.amountMinor != null ? ` · ${minorToText(line.amountMinor)}` : ""}</Text>
          )) : <Text style={styles.sub}>No line items detected.</Text>}
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <AppButton label={confirmed ? "Confirmed" : "Confirm values"} icon="checkmark-outline" disabled={confirmed} onPress={confirm} />
          {confirmed ? <AppButton label="Create transaction from these values" icon="add-outline" outline onPress={() => onUseValues({ amount: total.trim(), note: merchant.trim() })} /> : null}
          <AppButton label="Discard suggestion" outline onPress={() => { setScanned(null); setConfirmed(false); setStatus("Suggestion discarded. Nothing was saved."); }} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 5 },
  heading: { color: colors.white, fontSize: 17, fontWeight: "900", marginTop: 3 },
  item: { padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: colors.white, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  status: { color: colors.white, fontSize: 12, lineHeight: 18 },
  remove: { color: colors.red, fontWeight: "800" },
  form: { gap: 10, padding: 14, backgroundColor: colors.panel2 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  error: { color: colors.red, fontSize: 12 },
});
