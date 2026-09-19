import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AppStackParamList, MainTabParamList } from "./types";
import { TabBar } from "./tab-bar";
import { HomeScreen } from "../screens/home/home-screen";
import { FinanceScreen } from "../screens/finance/finance-screen";
import { AddTransactionScreen } from "../screens/transactions/add-transaction-screen";
import { TransactionsScreen } from "../screens/transactions/transactions-screen";
import { ProfileScreen } from "../screens/profile/profile-screen";
import { FeatureScreen } from "../screens/finance/feature-screen";
import { SettingsScreen } from "../screens/profile/settings-screen";
import { SubscriptionScreen } from "../screens/profile/subscription-screen";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "transparent", borderTopWidth: 0, elevation: 0 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Finance" component={FinanceScreen} />
      <Tab.Screen name="Add" component={AddTransactionScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Feature" component={FeatureScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}
