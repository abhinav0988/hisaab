import { StyleSheet, View } from "react-native";
import { colors } from "../../theme/tokens";

export function SparkBars({ values }: { values: number[] }) {
  return (
    <View style={styles.spark}>
      {values.map((height, index) => (
        <View key={index} style={[styles.bar, { height: height / 2 }]} />
      ))}
    </View>
  );
}

export function ChartBars({ values }: { values: number[] }) {
  return (
    <View style={styles.chart}>
      {values.map((height, index) => (
        <View key={index} style={[styles.chartBar, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  spark: {
    position: "absolute",
    right: 18,
    bottom: 20,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  bar: { width: 5, borderRadius: 4, backgroundColor: colors.green },
  chart: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    justifyContent: "space-around",
  },
  chartBar: { width: 12, borderRadius: 8, backgroundColor: colors.green2 },
});
