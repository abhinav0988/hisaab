import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeTagName } from "@hisaab/validation";
import { colors } from "../../theme/tokens";
import { Field } from "../ui/field";
import { AppButton } from "../ui/button";
import { transactionService } from "../../services/transaction.service";
import { errorCode, friendlyError } from "../../lib/api-errors";
import { useSingleFlight } from "../../lib/single-flight";

/** Selected tag names; the transaction API resolves names to the user's tags. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const client = useQueryClient();
  const tags = useQuery({ queryKey: ["tags"], queryFn: transactionService.listTags });
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const flight = useSingleFlight();
  const selected = new Set(value.map(normalizeTagName));
  const toggle = (name: string) => {
    const key = normalizeTagName(name);
    onChange(selected.has(key) ? value.filter((tag) => normalizeTagName(tag) !== key) : [...value, name]);
  };
  const add = () =>
    flight.run(creating, () => {
      const name = draft.trim();
      if (!name) {
        setMessage("Enter a tag name.");
        flight.end();
        return;
      }
      const existing = tags.data?.find((tag) => normalizeTagName(tag.name) === normalizeTagName(name));
      if (existing) {
        setMessage("This tag already exists. It has been selected.");
        if (!selected.has(normalizeTagName(existing.name))) onChange([...value, existing.name]);
        setDraft("");
        flight.end();
        return;
      }
      setCreating(true);
      setMessage("");
      void transactionService
        .createTag(name)
        .then(async (tag) => {
          await client.invalidateQueries({ queryKey: ["tags"] });
          onChange([...value, tag.name]);
          setDraft("");
          setMessage(`Created #${tag.name}`);
        })
        .catch(async (error) => {
          setMessage(friendlyError(error, "Could not create tag."));
          if (errorCode(error) === "TAG_EXISTS") await client.invalidateQueries({ queryKey: ["tags"] });
        })
        .finally(() => {
          setCreating(false);
          flight.end();
        });
    });
  const known = tags.data ?? [];
  const extra = value.filter((name) => !known.some((tag) => normalizeTagName(tag.name) === normalizeTagName(name)));
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tags</Text>
      <View style={styles.chips}>
        {[...known.map((tag) => tag.name), ...extra].map((name) => {
          const active = selected.has(normalizeTagName(name));
          return (
            <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${active ? "Remove" : "Add"} tag ${name}`} onPress={() => toggle(name)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{active ? "✓ " : ""}#{name}</Text>
            </Pressable>
          );
        })}
        {!known.length && !extra.length ? <Text style={styles.muted}>{tags.isLoading ? "Loading tags…" : tags.isError ? "Could not load tags." : "No tags yet. Create one below."}</Text> : null}
      </View>
      <Field label="New tag" placeholder="e.g. Travel" value={draft} onChangeText={setDraft} autoCapitalize="words" />
      <AppButton label={creating ? "Creating…" : "Create tag"} icon="add" outline disabled={creating} onPress={add} />
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

export function TagChips({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <View style={styles.chips}>
      {tags.map((tag) => (
        <View key={tag} style={styles.chip}>
          <Text style={styles.chipText}>#{tag}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: { color: colors.white, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  chipTextActive: { color: colors.ink },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
