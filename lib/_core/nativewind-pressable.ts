// NativeWind + Pressable/TouchableOpacity: className can swallow onPress on Android.
// IMPORTANT: Do NOT use remapProps on core RN components globally - it causes native crash on Android production builds.
// Instead, avoid passing className to Pressable/TouchableOpacity and use style prop directly.
// This file is kept as a no-op to avoid import errors.
