import { AppInfoView, LoadAppInfoUseCase } from "./load-app-info.usecase";
import { InMemoryStore } from "./testing/in-memory-store";

const unread: AppInfoView = { version: null, buildNumber: null };

describe("LoadAppInfoUseCase", () => {
  it("saves the installed app's version and build number", async () => {
    const appVersion = new InMemoryStore(unread);

    await new LoadAppInfoUseCase({
      appInfo: { get: async () => ({ version: "0.3.0", buildNumber: "42" }) },
      appVersion,
    }).execute();

    expect(appVersion.get()).toEqual({ version: "0.3.0", buildNumber: "42" });
  });

  it("passes on a missing version and build number", async () => {
    const appVersion = new InMemoryStore<AppInfoView>({
      version: "old",
      buildNumber: "1",
    });

    await new LoadAppInfoUseCase({
      appInfo: { get: async () => ({ version: null, buildNumber: null }) },
      appVersion,
    }).execute();

    expect(appVersion.get()).toEqual(unread);
  });

  it("fails when the app info can't be read, saving nothing", async () => {
    const appVersion = new InMemoryStore(unread);

    await expect(
      new LoadAppInfoUseCase({
        appInfo: { get: () => Promise.reject(new Error("Unavailable")) },
        appVersion,
      }).execute(),
    ).rejects.toThrow("Unavailable");
    expect(appVersion.get()).toBe(unread);
  });
});
