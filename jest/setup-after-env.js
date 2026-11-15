// Mocks and settings every component test needs, once the test framework has loaded.

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// Their native modules don't exist under Jest. Reanimated's mock needs Worklets, so mock that too.
jest.mock("react-native-worklets", () =>
  jest.requireActual("react-native-worklets/lib/module/mock"),
);
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  // Missing from Reanimated's mock.
  useReducedMotion: () => false,
}));

// The first render loads all of React Native, which takes over 5s without a Jest cache.
jest.setTimeout(30000);
