import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors, radius } from "../../theme/tokens";
import { Icon } from "./icon";
import type { IconName } from "../../config/finance-tools";

export function Field({
  label,
  placeholder,
  secure,
  value,
  onChangeText,
  hint,
  variant = "dark",
  leftIcon,
  right,
  keyboardType,
  autoCapitalize = "none",
  editable = true,
}: {
  label?: string;
  placeholder: string;
  secure?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
  hint?: string;
  variant?: "dark" | "light";
  leftIcon?: IconName;
  right?: ReactNode;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "words" | "sentences";
  editable?: boolean;
}) {
  const light = variant === "light";
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, light && styles.labelLight]}>{label}</Text> : null}
      <View style={[styles.inputRow, light && styles.inputRowLight, !editable && styles.disabled]}>
        {leftIcon ? (
          <Icon name={leftIcon} size={18} color={light ? colors.lightMuted : colors.muted} />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={light ? colors.lightMuted : colors.muted}
          secureTextEntry={secure}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          editable={editable}
          style={[styles.input, light && styles.inputLight]}
        />
        {right}
      </View>
      {hint ? <Text style={[styles.hint, light && styles.hintLight]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.white, fontWeight: "700" },
  labelLight: { color: colors.lightInk, fontWeight: "700", fontSize: 14 },
  inputRow: {
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    backgroundColor: colors.input,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputRowLight: {
    backgroundColor: colors.lightInput,
    borderColor: colors.lightLine,
    borderRadius: 16,
  },
  disabled: { opacity: 0.65 },
  input: {
    flex: 1,
    color: colors.white,
    height: "100%",
  },
  inputLight: { color: colors.lightInk },
  hint: { color: colors.muted, fontSize: 12 },
  hintLight: { color: colors.lightMuted },
});
