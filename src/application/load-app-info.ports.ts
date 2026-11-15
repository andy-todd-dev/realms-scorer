import type { AppInfoView } from "./load-app-info.usecase";

// The installed app's version and build number, or null where the platform doesn't report one.
export interface AppInfo {
  get(): Promise<{ version: string | null; buildNumber: string | null }>;
}

// What the UI shows of the installed app, once read.
export interface AppVersion {
  save(info: AppInfoView): void;
}

export interface LoadAppInfoPorts {
  appInfo: AppInfo;
  appVersion: AppVersion;
}
