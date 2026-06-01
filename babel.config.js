module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Use react-native-css-interop as JSX import source for NativeWind className support
          jsxImportSource: "react-native-css-interop",
        },
      ],
    ],
    plugins: [
      // NativeWind's babel plugin for CSS class processing
      require("react-native-css-interop/dist/babel-plugin").default,
      // reanimated plugin MUST be last - it includes worklets internally
      "react-native-reanimated/plugin",
    ],
  };
};
