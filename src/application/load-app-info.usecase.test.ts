import { LoadAppInfoUseCase } from "./load-app-info.usecase";

describe("LoadAppInfoUseCase", () => {
  it("returns the installed app's version and build number", async () => {
    const useCase = new LoadAppInfoUseCase({
      appInfo: { get: async () => ({ version: "0.3.0", buildNumber: "42" }) },
    });

    await expect(useCase.execute()).resolves.toEqual({
      version: "0.3.0",
      buildNumber: "42",
    });
  });

  it("passes on a missing version and build number", async () => {
    const useCase = new LoadAppInfoUseCase({
      appInfo: { get: async () => ({ version: null, buildNumber: null }) },
    });

    await expect(useCase.execute()).resolves.toEqual({
      version: null,
      buildNumber: null,
    });
  });

  it("fails when the app info can't be read", async () => {
    const useCase = new LoadAppInfoUseCase({
      appInfo: { get: () => Promise.reject(new Error("Unavailable")) },
    });

    await expect(useCase.execute()).rejects.toThrow("Unavailable");
  });
});
