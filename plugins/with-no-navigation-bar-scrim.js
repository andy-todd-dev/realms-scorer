const { withAndroidStyles } = require("expo/config-plugins");

/*
  Android lays a contrast scrim over a transparent 3-button navigation bar, which hides the app's colours behind it.
  Turning that off lets the app show through, with the buttons styled for the app's dark mode.
*/
module.exports = function withNoNavigationBarScrim(config) {
  return withAndroidStyles(config, (config) => {
    const appTheme = config.modResults.resources.style?.find(
      (style) => style.$.name === "AppTheme",
    );

    if (!appTheme) {
      throw new Error("with-no-navigation-bar-scrim: no AppTheme style found");
    }

    const name = "android:enforceNavigationBarContrast";
    appTheme.item = (appTheme.item ?? []).filter(
      (item) => item.$.name !== name,
    );
    appTheme.item.push({ _: "false", $: { name, "tools:targetApi": "29" } });

    return config;
  });
};
