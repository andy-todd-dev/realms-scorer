import { AppInfo, LoadAppInfoPorts } from "./load-app-info.ports";

export type AppInfoView = Awaited<ReturnType<AppInfo["get"]>>;

export interface LoadAppInfo {
  execute(): Promise<AppInfoView>;
}

export class LoadAppInfoUseCase implements LoadAppInfo {
  private readonly appInfo: AppInfo;

  constructor({ appInfo }: LoadAppInfoPorts) {
    this.appInfo = appInfo;
  }

  async execute(): Promise<AppInfoView> {
    const { version, buildNumber } = await this.appInfo.get();

    return { version, buildNumber };
  }
}
