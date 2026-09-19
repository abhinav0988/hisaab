import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { premiumBenefits } from "../../data/fixtures";
import { AppButton } from "../../components/ui/button";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";

type Props = NativeStackScreenProps<AppStackParamList, "Subscription">;

export function SubscriptionScreen({ navigation }: Props) {
  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <Header title="Hisaab Premium" subtitle="Choose the plan that fits your goals" />
      <Card style={styles.premium}>
        <Text style={styles.pro}>CURRENT PLAN</Text>
        <Text style={styles.h1}>Premium Annual</Text>
        <Text style={styles.balance}>
          ₹999<Text style={{ fontSize: 16 }}>/year</Text>
        </Text>
        <Text style={styles.subtitle}>Renews on 14 September 2027</Text>
      </Card>
      <SectionTitle title="YOUR BENEFITS" />
      {premiumBenefits.map((item) => (
        <View key={item} style={styles.benefit}>
          <Icon name="checkmark-circle" />
          <Text style={styles.itemTitle}>{item}</Text>
        </View>
      ))}
      <AppButton
        label="Manage payment method"
        onPress={() => Alert.alert("Payment method", "Connect your payment provider here.")}
      />
      <AppButton
        outline
        label="Cancel subscription"
        onPress={() =>
          Alert.alert("Cancel subscription", "Add your cancellation confirmation flow here.")
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  premium: { borderColor: colors.gold, backgroundColor: colors.premium },
  pro: {
    fontSize: 10,
    color: colors.goldInk,
    fontWeight: "900",
    backgroundColor: colors.gold,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  h1: { color: colors.white, fontSize: 34, fontWeight: "900", letterSpacing: -1, marginTop: 8 },
  balance: { fontSize: 32, color: colors.white, fontWeight: "900", marginVertical: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  itemTitle: { color: colors.white, fontSize: 14, fontWeight: "800" },
});
