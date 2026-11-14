// NativeWind needs this outside the file that registers the root component, which is main.tsx.
import "./global.css";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { AppStore } from "../state/store";
import { GluestackUIProvider } from "./gluestack/gluestack-ui-provider";
import { NavigationProvider } from "./NavigationProvider";
import { Screens } from "./Screens";

// Gluestack shows sheets in its own overlay host, outside the screens, so any context they read goes above its provider.
export function App({ store }: { store: AppStore }) {
  return (
    <Provider store={store}>
      <NavigationProvider>
        <SafeAreaProvider>
          <GluestackUIProvider mode="dark">
            <Screens />
          </GluestackUIProvider>
        </SafeAreaProvider>
      </NavigationProvider>
    </Provider>
  );
}
