import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { demoUser } from "../../data/fixtures";
import { useSession } from "../../providers/session-provider";
import { authService } from "../../services/auth.service";
import { Card } from "../../components/ui/card";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { MenuGroup } from "../../components/ui/menu-group";
import { Screen } from "../../components/ui/screen";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Profile">,
  NativeStackScreenProps<AppStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const { signOut } = useSession();

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
          <Text style={styles.bigAvatarText}>{demoUser.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{demoUser.name}</Text>
          <Text style={styles.subtitle}>{demoUser.email}</Text>
          <Text style={styles.member}>♛ Premium Member</Text>
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
      <Card style={styles.score}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Financial Health Score</Text>
          <Text style={styles.subtitle}>Keep building healthy money habits.</Text>
        </View>
        <View style={styles.scoreRing}>
          <Text style={styles.scoreNum}>{demoUser.healthScore}</Text>
          <Text style={styles.positive}>Good</Text>
        </View>
      </Card>
      <MenuGroup
        title="ACCOUNT"
        items={[
          { name: "Personal Information", icon: "person-outline" },
          { name: "Linked Accounts", icon: "link-outline" },
          { name: "Security & Privacy", icon: "shield-checkmark-outline" },
          { name: "Settings", icon: "settings-outline" },
        ]}
        onPress={(name) => name === "Settings" && navigation.navigate("Settings")}
      />
      <MenuGroup
        title="PREFERENCES"
        items={[
          { name: "Notifications", icon: "notifications-outline" },
          { name: "Appearance", icon: "moon-outline", value: "Dark" },
          { name: "Language", icon: "globe-outline", value: "English" },
          { name: "Currency", icon: "cash-outline", value: "INR (₹)" },
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
              onPress: async () => {
                await authService.signOut();
                signOut();
              },
            },
          ]);
        }}
      >
        <Icon name="log-out-outline" color={colors.red} />
        <Text style={{ color: colors.red, fontWeight: "800" }}>Log out</Text>
      </Pressable>
      <Text style={styles.center}>Hisaab v1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 15 },
  bigAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  bigAvatarText: { fontSize: 26, color: colors.white, fontWeight: "900" },
  cardTitle: { fontSize: 20, color: colors.white, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  member: {
    color: colors.goldInk,
    backgroundColor: colors.gold,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontWeight: "800",
    alignSelf: "flex-start",
    marginTop: 7,
  },
  button: {
    height: 54,
    borderRadius: 15,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  manage: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  buttonText: { fontSize: 16, fontWeight: "900", color: colors.green },
  score: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 9,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 27, color: colors.white, fontWeight: "900" },
  positive: { color: colors.green, fontWeight: "800" },
  logout: {
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.red,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
  center: { color: colors.muted, textAlign: "center" },
});
