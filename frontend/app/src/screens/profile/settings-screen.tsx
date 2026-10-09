import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import type { IconName } from "../../config/finance-tools";
import { BackLink } from "../../components/ui/back-link";
import { Header } from "../../components/ui/header";
import { IconBox } from "../../components/ui/icon-box";
import { MenuGroup } from "../../components/ui/menu-group";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { ErrorBlock, LoadingBlock } from "../../components/ui/states";
import { profileService } from "../../services/profile.service";

type Props = NativeStackScreenProps<AppStackParamList, "Settings">;

function ToggleRow({
  label,
  icon,
  value,
  setValue,
  busy,
}: {
  label: string;
  icon: IconName;
  value: boolean;
  setValue: (value: boolean) => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.row}>
      <IconBox name={icon} />
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        disabled={busy}
        onValueChange={setValue}
        trackColor={{ true: colors.green2 }}
      />
    </View>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const [smartNotifications, setSmart] = useState(true);
  const [weeklySummary, setWeekly] = useState(true);
  const [appLockEnabled, setLock] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setSmart(profile.data.smartNotifications ?? true);
    setWeekly(profile.data.weeklySummary ?? true);
    setLock(profile.data.appLockEnabled ?? false);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: (patch: {
      smartNotifications?: boolean;
      weeklySummary?: boolean;
      appLockEnabled?: boolean;
    }) =>
      profileService.update({
        name: profile.data?.name,
        countryCode: profile.data?.countryCode,
        defaultCurrency: profile.data?.defaultCurrency,
        timezone: profile.data?.timezone,
        language: profile.data?.language ?? "en",
        theme: profile.data?.theme ?? "dark",
        profileNote: profile.data?.profileNote ?? null,
        smartNotifications,
        weeklySummary,
        appLockEnabled,
        ...patch,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    },
  });

  if (profile.isLoading) {
    return (
      <Screen>
        <BackLink onPress={() => navigation.goBack()} />
        <Header title="Settings" subtitle="Control your Hisaab experience" />
        <LoadingBlock />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <BackLink onPress={() => navigation.goBack()} />
        <Header title="Settings" subtitle="Control your Hisaab experience" />
        <ErrorBlock message="Could not load settings." onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }

  const data = profile.data;

  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <Header title="Settings" subtitle="Control your Hisaab experience" />
      <MenuGroup
        title="GENERAL"
        items={[
          { name: "Personal Information", icon: "person-outline", value: data.name },
          { name: "Default Currency", icon: "cash-outline", value: data.defaultCurrency },
          { name: "Language", icon: "globe-outline", value: data.language ?? "en" },
          {
            name: "Theme",
            icon: "moon-outline",
            value: data.theme === "light" ? "Light" : data.theme === "dark" ? "Dark" : "System",
          },
          { name: "Country", icon: "flag-outline", value: data.countryCode },
          { name: "Timezone", icon: "time-outline", value: data.timezone },
        ]}
        onPress={(item) => {
          if (["Personal Information", "Default Currency", "Language", "Theme", "Country", "Timezone"].includes(item)) navigation.navigate("EditProfile");
        }}
      />
      <SectionTitle title="SECURITY & ALERTS" />
      <View style={styles.list}>
        <ToggleRow
          label="App lock"
          icon="finger-print-outline"
          value={appLockEnabled}
          busy={save.isPending}
          setValue={(value) => {
            setLock(value);
            save.mutate({ appLockEnabled: value });
          }}
        />
        <ToggleRow
          label="Smart notifications"
          icon="notifications-outline"
          value={smartNotifications}
          busy={save.isPending}
          setValue={(value) => {
            setSmart(value);
            save.mutate({ smartNotifications: value });
          }}
        />
        <ToggleRow
          label="Weekly summary"
          icon="mail-outline"
          value={weeklySummary}
          busy={save.isPending}
          setValue={(value) => {
            setWeekly(value);
            save.mutate({ weeklySummary: value });
          }}
        />
      </View>
      <MenuGroup
        title="DATA"
        items={[
          { name: "Transaction export", icon: "download-outline" },
        ]}
        onPress={(item) => {
          if (item === "Transaction export") Alert.alert("Export", "Open Analytics to export the current report CSV.");
        }}
      />
      <MenuGroup title="ACCOUNT & LEGAL" items={[{ name: "Subscription", icon: "diamond-outline" }, { name: "Terms of Service", icon: "document-text-outline" }, { name: "Privacy Policy", icon: "shield-checkmark-outline" }]} onPress={(item) => { if (item === "Subscription") navigation.navigate("Subscription"); if (item === "Terms of Service") navigation.navigate("Terms"); if (item === "Privacy Policy") navigation.navigate("Privacy"); }} />
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
