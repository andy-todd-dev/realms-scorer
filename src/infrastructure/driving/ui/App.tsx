// NativeWind needs this outside the file that registers the root component, which is main.tsx.
import "./global.css";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import type { AppUseCases } from "../../../application/app-use-cases";
import { AppStore } from "../state/store";
import { GluestackUIProvider } from "./gluestack/gluestack-ui-provider";
import { NavigationProvider } from "./NavigationProvider";
import { ScanProvider } from "./ScanProvider";
import { Screens } from "./Screens";
import { UseCasesProvider } from "./UseCasesProvider";

// Gluestack shows sheets in its own overlay host, outside the screens, so any context they read goes above its provider.
export function App({
  store,
  useCases,
}: {
  store: AppStore;
  useCases: AppUseCases;
}) {
  return (
    <Provider store={store}>
      <UseCasesProvider useCases={useCases}>
        <NavigationProvider>
          <ScanProvider>
            <SafeAreaProvider>
              <GluestackUIProvider mode="dark">
                <Screens />
              </GluestackUIProvider>
            </SafeAreaProvider>
          </ScanProvider>
        </NavigationProvider>
      </UseCasesProvider>
    </Provider>
  );
}
