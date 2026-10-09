import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import { Card } from "../ui/card";
import { AppButton } from "../ui/button";
import { transactionService } from "../../services/transaction.service";
import { fileKind, fileService } from "../../services/file.service";
import { nativePickerService } from "../../services/native-picker.service";
import { friendlyError } from "../../lib/api-errors";
import { useSingleFlight } from "../../lib/single-flight";

export function TransactionAttachments({ transactionId }: { transactionId: string }) {
  const client = useQueryClient();
  const key = ["transaction", transactionId, "attachments"];
  const attachments = useQuery({ queryKey: key, queryFn: () => transactionService.listAttachments(transactionId) });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const flight = useSingleFlight();
  const refresh = () => client.invalidateQueries({ queryKey: key });

  const attach = () =>
    flight.run(busy !== null, () => {
      setBusy("attach");
      setMessage("");
      void (async () => {
        try {
          const picked = await nativePickerService.pickDocument();
          if (!picked) return;
          setMessage("Uploading…");
          const stored = await fileService.upload(picked);
          setMessage("Attaching…");
          await transactionService.attach(transactionId, stored.id);
          await refresh();
          setMessage(`Attached ${stored.originalName}`);
        } catch (error) {
          setMessage(friendlyError(error, "Could not attach this file."));
        } finally {
          setBusy(null);
          flight.end();
        }
      })();
    });

  const open = (fileId: string, name: string, mimeType: string) => {
    if (busy) return;
    setBusy(`open:${fileId}`);
    void fileService
      .open(fileId, name, mimeType)
      .catch((error) => setMessage(friendlyError(error, "Could not open this file.")))
      .finally(() => setBusy(null));
  };

  const confirmRemove = (attachmentId: string, name: string) =>
    Alert.alert("Remove attachment?", `${name} will be unlinked from this transaction.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setBusy(`remove:${attachmentId}`);
          void transactionService
            .removeAttachment(transactionId, attachmentId)
            .then(async () => {
              await refresh();
              setMessage("Attachment removed");
            })
            .catch((error) => setMessage(friendlyError(error, "Could not remove attachment.")))
            .finally(() => setBusy(null));
        },
      },
    ]);

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>ATTACHMENTS</Text>
      {attachments.isLoading ? <Text style={styles.muted}>Loading attachments…</Text> : null}
      {attachments.isError ? <Text style={styles.muted}>Could not load attachments. {friendlyError(attachments.error)}</Text> : null}
      {attachments.data?.length
        ? attachments.data.map((item) => (
            <View key={item.id} style={styles.row}>
              <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${item.originalName}`} onPress={() => open(item.fileId, item.originalName, item.mimeType)}>
                <Text style={styles.value}>{item.originalName}</Text>
                <Text style={styles.muted}>{fileKind(item.mimeType)} · {busy === `open:${item.fileId}` ? "Opening…" : "Tap to open"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.originalName}`} disabled={busy !== null} onPress={() => confirmRemove(item.id, item.originalName)}>
                <Text style={styles.remove}>{busy === `remove:${item.id}` ? "Removing…" : "Remove"}</Text>
              </Pressable>
            </View>
          ))
        : attachments.isSuccess
          ? <Text style={styles.muted}>No attachments yet. Add a JPEG, PNG, or PDF up to 8 MB.</Text>
          : null}
      <AppButton label={busy === "attach" ? "Attaching…" : "Add attachment"} icon="attach-outline" outline disabled={busy !== null} onPress={attach} />
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 14 },
  label: { color: colors.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  value: { color: colors.white, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  remove: { color: colors.red, fontWeight: "800" },
});
