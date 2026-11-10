import type { ExpoConfig } from "expo/config";

// Set from the release tag by the EAS release workflow (.eas/workflows/release.yml).
const releaseVersion = process.env.APP_VERSION;

// A production build without a release version would ship the fallback below, so it fails instead.
if (process.env.EAS_BUILD_PROFILE === "production" && !releaseVersion) {
  throw new Error(
    "APP_VERSION is not set. Production builds take their version from a release tag.",
  );
}

const config: ExpoConfig = {
  name: "Realms Scorer",
  slug: "realms-scorer",
  // Builds made locally, or for other profiles, use the version of the last release.
  version: releaseVersion ?? "0.2.0",
  userInterfaceStyle: "dark",
  android: {
    package: "dev.andytodd.realmsscorer",
  },
  plugins: [
    [
      "expo-font",
      {
        fonts: [
          "node_modules/@expo-google-fonts/marcellus/400Regular/Marcellus_400Regular.ttf",
          "node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf",
          "node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf",
          "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf",
          "node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf",
        ],
      },
    ],
    "./plugins/with-no-navigation-bar-scrim",
    "expo-image",
    [
      "expo-image-picker",
      {
        cameraPermission:
          "Realms Scorer uses the camera to take a photo of your hand and read the card names.",
        photosPermission:
          "Realms Scorer reads card names from a photo of your hand that you choose.",
        microphonePermission: false,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "f2fd1628-3d70-4892-8c21-d33e38e0ea32",
    },
  },
  owner: "andytodddev",
};

export default config;
