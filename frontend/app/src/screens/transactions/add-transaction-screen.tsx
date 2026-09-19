import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { colors } from "../../theme/tokens";
import type { MainTabParamList } from "../../navigation/types";
import { AppButton } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Field } from "../../components/ui/field";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { IconBox } from "../../components/ui/icon-box";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import type { IconName } from "../../config/finance-tools";

type Props = BottomTabScreenProps<MainTabParamList, "Add">;
const kinds = ["Expense", "Income", "Transfer"] as const;
const frequent: [string, IconName][] = [
  ["Food", "fast-food-outline"],
  ["Shopping", "bag-outline"],
  ["Fuel", "car-outline"],
  ["Bills", "receipt-outline"],
];

export function AddTransactionScreen({ navigation }: Props) {
  const [kind, setKind] = useState<(typeof kinds)[number]>("Expense");

  return (
    <Screen>
      <Header title="Add Transaction" subtitle="Choose what you want to add" />
      <View style={styles.filters}>
        {kinds.map((item) => (
          <Pressable
            key={item}
            onPress={() => setKind(item)}
            style={[styles.kind, kind === item && styles.kindActive]}
          >
            <Icon
              name={
                item === "Expense"
                  ? "arrow-down"
                  : item === "Income"
                    ? "arrow-up"
                    : "swap-horizontal"
              }
              color={kind === item ? colors.green : colors.muted}
            />
            <Text style={styles.itemTitle}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ gap: 18 }}>
        <Field label="Amount" placeholder="₹ 0.00" />
        <Field label="Category" placeholder="Select category" />
        <Field label="Account" placeholder="Select account" />
        <Field label="Date" placeholder="Today" />
        <Field label="Note" placeholder="Add an optional note" />
        <AppButton
          label="Save transaction"
          onPress={() => {
            Alert.alert("Saved", "Your transaction was added.");
            navigation.navigate("Transactions");
          }}
        />
      </Card>
      <SectionTitle title="Frequently Used" />
      <View style={styles.quick}>
        {frequent.map(([title, icon]) => (
          <View key={title} style={styles.quickItem}>
            <IconBox name={icon} />
            <Text style={styles.quickText}>{title}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  kind: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  kindActive: { backgroundColor: colors.panel2, borderColor: colors.green },
  itemTitle: { color: colors.white, fontSize: 14, fontWeight: "800" },
  quick: { flexDirection: "row", justifyContent: "space-between" },
  quickItem: { width: "24%", alignItems: "center", gap: 7 },
  quickText: { color: colors.white, fontSize: 11, textAlign: "center" },
});
