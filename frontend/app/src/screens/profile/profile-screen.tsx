import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { colors } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { useSession } from "../../providers/session-provider";
import { profileService } from "../../services/profile.service";
import { Card } from "../../components/ui/card";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { MenuGroup } from "../../components/ui/menu-group";
import { Screen } from "../../components/ui/screen";
import { LoadingBlock } from "../../components/ui/states";
import { initials } from "../../lib/format";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<AppStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { signOut, user } = useSession();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileService.get() });
  const name = profile.data?.name ?? user?.name ?? "Hisaab user";
  const email = profile.data?.email ?? user?.email ?? "";
  const currency = profile.data?.defaultCurrency ?? "INR";

  if (profile.isLoading) {
    return (
      <Screen>
        <Header title="Profile" />
        <LoadingBlock />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Profile"
        action={
          <Pressable onPress={() => navigation.navigate("Settings")} style={styles.round}>
            <Icon name="settings-outline" />
          </Pressable>
        }
      />
      <Card style={styles.profileCard}>
        <View style={styles.bigAvatar}>
          <Text style={styles.bigAvatarText}>{initials(name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{name}</Text>
          <Text style={styles.subtitle}>{email}</Text>
          <Text style={styles.member}>
            {profile.data?.emailVerified ? "Verified account" : "Verify your email"}
          </Text>
        </View>
      </Card>
      <Pressable
        onPress={() => navigation.navigate("Subscription")}
        style={[styles.button, styles.manage]}
      >
        <Icon name="diamond-outline" />
        <Text style={[styles.buttonText, { flex: 1 }]}>Manage Subscription</Text>
        <Icon name="chevron-forward" />
      </Pressable>
      <MenuGroup
        title="ACCOUNT"
        items={[
          { name: "Personal Information", icon: "person-outline", value: name },
          { name: "Linked Accounts", icon: "link-outline" },
          { name: "Security & Privacy", icon: "shield-checkmark-outline" },
          { name: "Settings", icon: "settings-outline" },
        ]}
        onPress={(item) => item === "Settings" && navigation.navigate("Settings")}
      />
      <MenuGroup
        title="PREFERENCES"
        items={[
          { name: "Notifications", icon: "notifications-outline" },
          {
            name: "Appearance",
            icon: "moon-outline",
            value: profile.data?.theme ?? "system",
          },
          { name: "Language", icon: "globe-outline", value: profile.data?.language ?? "en" },
          { name: "Currency", icon: "cash-outline", value: currency },
        ]}
      />
      <MenuGroup
        title="SUPPORT"
        items={[
          { name: "Help & Support", icon: "help-circle-outline" },
          { name: "Terms & Privacy", icon: "document-text-outline" },
          { name: "About Hisaab", icon: "information-circle-outline" },
        ]}
      />
      <Pressable
        style={styles.logout}
        onPress={() => {
          Alert.alert("Log out", "Sign out of this device?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log out",
              style: "destructive",
              onPress: () => void signOut(),
            },
          ]);
        }}
      >
        <Icon name="log-out-outline" color={colors.red} />
        <Text style={[styles.buttonText, { color: colors.red }]}>Log out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  bigAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  bigAvatarText: { color: colors.white, fontWeight: "900", fontSize: 20 },
  cardTitle: { color: colors.white, fontSize: 18, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 2 },
  member: { color: colors.gold, marginTop: 6, fontWeight: "700", fontSize: 12 },
  button: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  manage: { backgroundColor: colors.panel2, borderColor: colors.green },
  buttonText: { color: colors.white, fontWeight: "800" },
  logout: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: "#2A1212",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
});
