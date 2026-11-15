import { AppInfo, LoadAppInfoPorts } from "./load-app-info.ports";

export type AppInfoView = Awaited<ReturnType<AppInfo["get"]>>;

export interface LoadAppInfo {
  execute(): Promise<void>;
}

export class LoadAppInfoUseCase implements LoadAppInfo {
  private readonly ports: LoadAppInfoPorts;

  constructor({ appInfo, appVersion }: LoadAppInfoPorts) {
    this.ports = { appInfo, appVersion };
  }

  // Reads the installed app's version and build number and saves them. Rejects if they can't be read, saving nothing.
  async execute(): Promise<void> {
    const { version, buildNumber } = await this.ports.appInfo.get();

    this.ports.appVersion.save({ version, buildNumber });
  }
}
