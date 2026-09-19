import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList } from "../../navigation/types";
import { toolById } from "../../config/finance-tools";
import { demoSummary, featureChart } from "../../data/fixtures";
import { ChartBars } from "../../components/finance/bars";
import { Metric } from "../../components/finance/metric";
import { TransactionList } from "../../components/finance/transaction-list";
import { BackLink } from "../../components/ui/back-link";
import { Card } from "../../components/ui/card";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";

type Props = NativeStackScreenProps<AppStackParamList, "Feature">;

export function FeatureScreen({ navigation, route }: Props) {
  const tool = toolById(route.params.toolId);

  return (
    <Screen>
      <BackLink onPress={() => navigation.goBack()} />
      <View style={styles.hero}>
        <View style={styles.icon}>
          <Icon name={tool?.icon ?? "wallet-outline"} size={44} />
        </View>
        <Text style={styles.h1}>{tool?.title ?? "Finance tool"}</Text>
        <Text style={styles.subtitle}>{tool?.subtitle ?? "Manage your money with confidence"}</Text>
      </View>
      <View style={styles.grid3}>
        <Metric label="This month" value={demoSummary.expenses} color={colors.red} />
        <Metric label="Available" value="₹78,400" color={colors.green} />
        <Metric label="Change" value="+12.4%" color={colors.gold} />
      </View>
      <Card>
        <SectionTitle title="Monthly activity" />
        <ChartBars values={featureChart} />
      </Card>
      <SectionTitle title="Recent activity" />
      <TransactionList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 10, paddingVertical: 20 },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  grid3: { flexDirection: "row", gap: 8 },
});
