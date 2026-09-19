import { StyleSheet, Text, View } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../../theme/tokens";
import type { AppStackParamList, MainTabParamList } from "../../navigation/types";
import { toolsByGroup, type FinanceTool } from "../../config/finance-tools";
import { ToolTile } from "../../components/finance/tool-tile";
import { Card } from "../../components/ui/card";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Finance">,
  NativeStackScreenProps<AppStackParamList>
>;

export function FinanceScreen({ navigation }: Props) {
  function openTool(tool: FinanceTool) {
    if (tool.tab === "Home") {
      navigation.navigate("Home");
      return;
    }
    if (tool.tab === "Transactions") {
      navigation.navigate("Transactions");
      return;
    }
    if (tool.id === "premium") {
      navigation.navigate("Subscription");
      return;
    }
    navigation.navigate("Feature", { toolId: tool.id });
  }

  return (
    <Screen>
      <Header
        title="Finance"
        subtitle="All your financial tools"
        action={<Icon name="search-outline" size={28} />}
      />
      <Card style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Your Financial World</Text>
          <Text style={styles.subtitle}>Manage, grow and protect your money</Text>
        </View>
        <Icon name="trending-up" size={64} />
      </Card>
      <SectionTitle title="EVERYDAY FINANCE" />
      <View style={styles.grid}>
        {toolsByGroup("everyday").map((tool) => (
          <ToolTile key={tool.id} tool={tool} onPress={() => openTool(tool)} />
        ))}
      </View>
      <SectionTitle title="GROW & PLAN" />
      <View style={styles.grid}>
        {toolsByGroup("grow").map((tool) => (
          <ToolTile key={tool.id} tool={tool} onPress={() => openTool(tool)} />
        ))}
      </View>
      <SectionTitle title="MORE FINANCE TOOLS" />
      {toolsByGroup("more").map((tool) => (
        <ToolTile key={tool.id} tool={tool} wide onPress={() => openTool(tool)} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 130, flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 20, color: colors.white, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
