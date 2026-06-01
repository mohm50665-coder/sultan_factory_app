module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  // reanimated plugin includes worklets internally, so we only need reanimated
  // MUST be last plugin in the list
  plugins.push("react-native-reanimated/plugin");

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins,
  };
};
