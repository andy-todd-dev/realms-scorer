import * as Application from "expo-application";

// The installed app's version (Android versionName) and build number (versionCode), as the native build reports them.
export class ExpoApplicationAppInfo {
  async get(): Promise<{ version: string | null; buildNumber: string | null }> {
    return {
      version: Application.nativeApplicationVersion,
      buildNumber: Application.nativeBuildVersion,
    };
  }
}
