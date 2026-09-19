import { useSession } from "../providers/session-provider";
import { AuthNavigator } from "./auth-navigator";
import { AppNavigator } from "./app-navigator";

export function RootNavigator() {
  const { signedIn } = useSession();
  return signedIn ? <AppNavigator /> : <AuthNavigator />;
}
