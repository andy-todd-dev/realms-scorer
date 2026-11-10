// The installed app's version and build number, or null where the platform doesn't report one.
export interface AppInfo {
  get(): Promise<{ version: string | null; buildNumber: string | null }>;
}

export interface LoadAppInfoPorts {
  appInfo: AppInfo;
}
