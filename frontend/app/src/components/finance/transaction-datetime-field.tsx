import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors } from "../../theme/tokens";
import { combineLocalDateTime, localDateKey, localTimeKey, startOfLocalDay } from "../../lib/datetime";
import { Icon } from "../ui/icon";

function parseLocal(dateKey: string, timeKey: string) {
  try {
    return new Date(combineLocalDateTime(dateKey, timeKey));
  } catch {
    return new Date();
  }
}

export function TransactionDateTimeField({
  dateKey,
  timeKey,
  onChange,
  label = "Date & time",
}: {
  dateKey: string;
  timeKey: string;
  onChange: (next: { dateKey: string; timeKey: string }) => void;
  label?: string;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const value = parseLocal(dateKey, timeKey);

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setMode(null);
    if (event.type === "dismissed" || !selected) return;
    if (mode === "date") {
      onChange({ dateKey: localDateKey(selected), timeKey });
    } else if (mode === "time") {
      onChange({ dateKey, timeKey: localTimeKey(selected) });
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.chip}
          onPress={() => setMode("date")}
          accessibilityRole="button"
          accessibilityLabel="Pick transaction date"
        >
          <Icon name="calendar-outline" color={colors.green} size={18} />
          <Text style={styles.chipText}>{dateKey}</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => setMode("time")}
          accessibilityRole="button"
          accessibilityLabel="Pick transaction time"
        >
          <Icon name="time-outline" color={colors.green} size={18} />
          <Text style={styles.chipText}>{timeKey}</Text>
        </Pressable>
      </View>
      <View style={styles.presets}>
        {[
          { label: "Today", date: localDateKey() },
          {
            label: "Yesterday",
            date: localDateKey(new Date(Date.now() - 86_400_000)),
          },
        ].map((preset) => (
          <Pressable
            key={preset.label}
            style={[styles.preset, dateKey === preset.date && styles.presetOn]}
            onPress={() => onChange({ dateKey: preset.date, timeKey })}
          >
            <Text style={styles.presetText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      {mode && Platform.OS === "android" ? (
        <DateTimePicker
          value={mode === "date" ? startOfLocalDay(dateKey) : value}
          mode={mode}
          display={mode === "date" ? "calendar" : "default"}
          onChange={onPick}
        />
      ) : null}
      {mode && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade" onRequestClose={() => setMode(null)}>
          <Pressable style={styles.backdrop} onPress={() => setMode(null)}>
            <View style={styles.sheet}>
              <DateTimePicker value={value} mode={mode} display="spinner" onChange={onPick} />
              <Pressable style={styles.done} onPress={() => setMode(null)}>
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
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexGrow: 1,
    minWidth: 140,
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
  presets: { flexDirection: "row", gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetOn: { borderColor: colors.green, backgroundColor: "#0B3A2C" },
  presetText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
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
  done: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doneText: { color: colors.green, fontWeight: "800" },
});
