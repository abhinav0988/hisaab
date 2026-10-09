import { Alert, StyleSheet, Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import type { AppStackParamList } from "../../navigation/types";
import { profileService } from "../../services/profile.service";
import { Screen } from "../../components/ui/screen";
import { BackLink } from "../../components/ui/back-link";
import { Field } from "../../components/ui/field";
import { AppButton } from "../../components/ui/button";
import { LoadingBlock } from "../../components/ui/states";
import { colors } from "../../theme/tokens";

export function EditProfileScreen({ navigation }: NativeStackScreenProps<AppStackParamList, "EditProfile">) {
  const q = useQuery({ queryKey: ["profile"], queryFn: profileService.get });
  const c = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("");
  const [theme, setTheme] = useState("");
  const [country, setCountry] = useState("");
  useEffect(() => {
    if (!q.data || hydrated) return;
    setName(q.data.name);
    setCurrency(q.data.defaultCurrency);
    setTimezone(q.data.timezone);
    setLanguage(q.data.language ?? "en");
    setTheme(q.data.theme ?? "system");
    setCountry(q.data.countryCode);
    setHydrated(true);
  }, [q.data, hydrated]);
  const m = useMutation({
    mutationFn: () => profileService.update({
      ...q.data!,
      name: name.trim(),
      defaultCurrency: currency.trim().toUpperCase(),
      timezone: timezone.trim(),
      language: language.trim(),
      theme: theme.trim().toLowerCase() as "light" | "dark" | "system",
      countryCode: country.trim().toUpperCase(),
    }),
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: ["profile"] });
      Alert.alert("Saved", "Your profile was updated.");
      navigation.goBack();
    },
    onError: (e) => Alert.alert("Could not save", e instanceof Error ? e.message : "Try again."),
  });
  if (!q.data || !hydrated) return <Screen><LoadingBlock /></Screen>;
  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <Text style={s.title}>Edit profile</Text>
      <Field label="Name" placeholder="Your name" value={name} onChangeText={setName} />
      <Field label="Email" placeholder="" value={q.data.email} editable={false} />
      <Field label="Currency" placeholder="INR" value={currency} onChangeText={setCurrency} />
      <Field label="Timezone" placeholder="Asia/Kolkata" value={timezone} onChangeText={setTimezone} />
      <Field label="Language" placeholder="en" value={language} onChangeText={setLanguage} />
      <Field label="Country" placeholder="IN" value={country} onChangeText={setCountry} />
      <Field label="Theme" placeholder="system, light, or dark" value={theme} onChangeText={setTheme} />
      <AppButton
        label={m.isPending ? "Saving…" : "Save profile"}
        icon="checkmark"
        onPress={() => {
          if (m.isPending) return;
          const nextTheme = theme.trim().toLowerCase();
          if (!name.trim()) return Alert.alert("Check details", "Name is required.");
          if (!["inr", "npr", "pkr", "bdt", "usd"].includes(currency.trim().toLowerCase())) return Alert.alert("Check details", "Currency must be INR, NPR, PKR, BDT, or USD.");
          if (!["in", "np", "pk", "bd"].includes(country.trim().toLowerCase())) return Alert.alert("Check details", "Country must be IN, NP, PK, or BD.");
          if (!["light", "dark", "system"].includes(nextTheme)) return Alert.alert("Check details", "Theme must be light, dark, or system.");
          m.mutate();
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({ title: { color: colors.white, fontSize: 29, fontWeight: "900" } });
