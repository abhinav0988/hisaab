import type { NavigationProp, ParamListBase } from "@react-navigation/native";

/** Safe back: stack pop when possible, otherwise land on main tabs. */
export function safeGoBack(
  navigation: NavigationProp<ParamListBase>,
  fallback: string = "Tabs",
) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  // @ts-expect-error fallback route is app-specific
  navigation.navigate(fallback);
}
