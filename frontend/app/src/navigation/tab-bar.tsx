import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/tokens";
import { Icon } from "../components/ui/icon";
import type { IconName } from "../config/finance-tools";
import type { MainTabParamList } from "./types";

const items: {
  name: keyof MainTabParamList;
  icon: IconName;
  iconActive: IconName;
  add?: boolean;
}[] = [
  { name: "Home", icon: "home-outline", iconActive: "home" },
  { name: "Finance", icon: "stats-chart-outline", iconActive: "stats-chart" },
  { name: "Add", icon: "add", iconActive: "add", add: true },
  { name: "Transactions", icon: "document-text-outline", iconActive: "document-text" },
  { name: "Profile", icon: "person-outline", iconActive: "person" },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.pill}>
        {items.map((item) => {
          const route = state.routes.find((entry) => entry.name === item.name);
          if (!route) return null;
          const index = state.routes.indexOf(route);
          const focused = state.index === index;
          const color = item.add ? colors.gold : focused ? colors.green : colors.muted;
          return (
            <Pressable
              key={item.name}
              onPress={() => navigation.navigate(item.name)}
              style={styles.navItem}
            >
              {item.add ? (
                <View style={styles.addHalo}>
                  <View style={styles.addBtn}>
                    <Icon name="add" size={30} color={colors.goldInk} />
                  </View>
                </View>
              ) : (
                <Icon name={focused ? item.iconActive : item.icon} size={22} color={color} />
              )}
              <Text style={[styles.navText, { color }]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  pill: {
    height: 70,
    borderRadius: 35,
    backgroundColor: "#041C17",
    borderWidth: 1,
    borderColor: "rgba(85, 231, 160, 0.14)",
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 9,
    paddingHorizontal: 6,
    overflow: "visible",
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  navText: {
    fontSize: 10,
    fontWeight: "600",
  },
  addHalo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -16,
    marginBottom: 1,
    backgroundColor: "rgba(245, 217, 139, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.gold,
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 10,
  },
});
