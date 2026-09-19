import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import type { IconName } from "../../config/finance-tools";
import { BackLink } from "../../components/ui/back-link";
import { Header } from "../../components/ui/header";
import { IconBox } from "../../components/ui/icon-box";
import { MenuGroup } from "../../components/ui/menu-group";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";

type Props = NativeStackScreenProps<AppStackParamList, "Settings">;

function ToggleRow({
  label,
  icon,
  value,
  setValue,
}: {
  label: string;
  icon: IconName;
  value: boolean;
  setValue: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <IconBox name={icon} />
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={setValue} trackColor={{ true: colors.green2 }} />
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const [biometric, setBiometric] = useState(true);
  const [push, setPush] = useState(true);

  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <Header title="Settings" subtitle="Control your Hisaab experience" />
      <MenuGroup
        title="GENERAL"
        items={[
          { name: "Personal Information", icon: "person-outline" },
          { name: "Default Currency", icon: "cash-outline", value: "INR (₹)" },
          { name: "Language", icon: "globe-outline", value: "English" },
          { name: "Theme", icon: "moon-outline", value: "Dark" },
        ]}
      />
      <SectionTitle title="SECURITY" />
      <View style={styles.list}>
        <ToggleRow
          label="Biometric login"
          icon="finger-print-outline"
          value={biometric}
          setValue={setBiometric}
        />
        <ToggleRow
          label="Push notifications"
          icon="notifications-outline"
          value={push}
          setValue={setPush}
        />
      </View>
      <MenuGroup
        title="DATA"
        items={[
          { name: "Export Transactions", icon: "download-outline" },
          { name: "Backup & Sync", icon: "cloud-upload-outline" },
          { name: "Delete Account", icon: "trash-outline" },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  row: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: { color: colors.white, fontSize: 14, fontWeight: "800", flex: 1 },
});
