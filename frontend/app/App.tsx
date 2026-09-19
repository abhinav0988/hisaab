import "react-native-gesture-handler";
import { AppProviders } from "./src/providers/app-providers";
import { RootNavigator } from "./src/navigation/root-navigator";

export default function App() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
