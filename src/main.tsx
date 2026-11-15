import { registerRootComponent } from "expo";
import { createApp } from "./composition-root";
import { App } from "./infrastructure/driving/ui/App";

const { store, useCases } = createApp();

function Root() {
  return <App store={store} useCases={useCases} />;
}

registerRootComponent(Root);
