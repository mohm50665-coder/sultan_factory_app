import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, Platform, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";
import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    try {
      nativewindColorScheme.set(scheme);
    } catch (e) {
      // Silently fail
    }
    try {
      if (Platform.OS !== "web") {
        Appearance.setColorScheme?.(scheme);
      }
    } catch (e) {
      // Silently fail
    }
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        const root = document.documentElement;
        root.dataset.theme = scheme;
        root.classList.toggle("dark", scheme === "dark");
        const palette = SchemeColors[scheme];
        Object.entries(palette).forEach(([token, value]) => {
          root.style.setProperty(`--color-${token}`, value);
        });
      } catch (e) {
        // Silently fail
      }
    }
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  // CSS Variables for NativeWind on native platforms
  const themeVariables = useMemo(() => {
    try {
      const palette = SchemeColors[colorScheme];
      if (!palette) return {};
      return vars({
        "--color-primary": palette.primary,
        "--color-background": palette.background,
        "--color-surface": palette.surface,
        "--color-foreground": palette.foreground,
        "--color-muted": palette.muted,
        "--color-border": palette.border,
        "--color-success": palette.success,
        "--color-warning": palette.warning,
        "--color-error": palette.error,
      });
    } catch (e) {
      return {};
    }
  }, [colorScheme]);

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme, setColorScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
