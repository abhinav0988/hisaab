import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors } from "../../theme/tokens";
import { localDateKey, startOfLocalDay } from "../../lib/datetime";
import { Icon } from "./icon";

/** Calendar-backed YYYY-MM-DD field for forms (Android system picker / iOS sheet). */
export function DateField({
  label,
  value,
  onChange,
  optional,
  maximumDate,
  minimumDate,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  optional?: boolean;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? startOfLocalDay(value) : new Date();

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !selected) return;
    onChange(localDateKey(selected));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {optional ? " (optional)" : ""}
      </Text>
      <View style={styles.row}>
        <Pressable
          style={styles.chip}
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Pick ${label}`}
        >
          <Icon name="calendar-outline" color={colors.green} size={18} />
          <Text style={styles.chipText}>{value || "Select date"}</Text>
        </Pressable>
        {optional && value ? (
          <Pressable style={styles.clear} onPress={() => onChange("")} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={parsed}
          mode="date"
          display="calendar"
          onChange={onPick}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
        />
      ) : null}
      {open && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={parsed}
                mode="date"
                display="spinner"
                onChange={onPick}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
              />
              <Pressable style={styles.done} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.white, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  chipText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  clear: { paddingVertical: 8, paddingHorizontal: 4 },
  clearText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
  },
  done: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  doneText: { color: colors.green, fontWeight: "800" },
});
