import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/tokens";
import { Header } from "../../components/ui/header";
import { Icon } from "../../components/ui/icon";
import { Screen } from "../../components/ui/screen";
import { SectionTitle } from "../../components/ui/section-title";
import { TransactionList } from "../../components/finance/transaction-list";

const filters = ["All", "Income", "Expense", "Transfer"] as const;

export function TransactionsScreen() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  return (
    <Screen>
      <Header
        title="Transactions"
        subtitle="Track all your activities"
        action={<Icon name="search-outline" size={28} />}
      />
      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[styles.pill, filter === item && styles.pillActive]}
          >
            <Text style={filter === item ? styles.pillTextActive : styles.pillText}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <SectionTitle title="Today" />
      <TransactionList section="today" />
      <SectionTitle title="Earlier" />
      <TransactionList section="earlier" limit={3} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
  },
  pillActive: { backgroundColor: colors.green },
  pillText: { color: colors.muted },
  pillTextActive: { color: colors.ink, fontWeight: "900" },
});
