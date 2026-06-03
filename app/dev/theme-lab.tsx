import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

type PaletteName = keyof typeof SchemeColors.light;

const paletteNames: PaletteName[] = Object.keys(SchemeColors.light) as PaletteName[];

function ColorSwatch({ name, value }: { name: PaletteName; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ height: 24, width: 24, borderRadius: 9999, borderWidth: 1, borderColor: colors.border, backgroundColor: value }} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{name}</Text>
      </View>
      <Text style={{ fontSize: 12, color: colors.muted }}>{value}</Text>
    </View>
  );
}

export default function ThemeLabScreen() {
  const [pressCount, setPressCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>("None yet");
  const { colorScheme, setColorScheme } = useThemeContext();
  const colors = useColors();

  const swatches = useMemo(
    () =>
      paletteNames.map((name) => ({
        name,
        value: SchemeColors[colorScheme][name],
      })),
    [colorScheme],
  );

  const tileStyles = useMemo(() => {
    const build = (scheme: ColorScheme) => ({
      background: SchemeColors[scheme].background,
      border: SchemeColors[scheme].border,
      text: SchemeColors[scheme].foreground,
      subText: SchemeColors[scheme].muted,
      activeBackground: SchemeColors[scheme].primary,
      activeText: SchemeColors[scheme].background,
    });
    return {
      light: build("light"),
      dark: build("dark"),
    };
  }, []);

  return (
    <ScreenContainer style={{ padding: 20 }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ gap: 16, paddingBottom: 32 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(["light", "dark"] as ColorScheme[]).map((scheme) => (
              <Pressable
                key={scheme}
                style={[
                  styles.schemeToggle,
                  {
                    backgroundColor:
                      colorScheme === scheme
                        ? tileStyles[scheme].activeBackground
                        : tileStyles[scheme].background,
                    borderColor:
                      colorScheme === scheme
                        ? tileStyles[scheme].activeBackground
                        : tileStyles[scheme].border,
                  },
                ]}
                onPress={() => {
                  setColorScheme(scheme);
                  setLastAction(`Applied ${scheme} globally`);
                }}
              >
                <Text
                  style={[
                    styles.schemeToggleTitle,
                    {
                      color:
                        colorScheme === scheme
                          ? tileStyles[scheme].activeText
                          : tileStyles[scheme].text,
                    },
                  ]}
                >
                  {scheme === "light" ? "Light preview" : "Dark preview"}
                </Text>
                <Text
                  style={[
                    styles.schemeToggleSubtitle,
                    {
                      color:
                        colorScheme === scheme
                          ? tileStyles[scheme].activeText
                          : tileStyles[scheme].subText,
                    },
                  ]}
                >
                  Global theme (NativeWind + useColors)
                </Text>
              </Pressable>
            ))}
          </View>

          <ThemedView style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.foreground }}>
              Tailwind tokens
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: colors.muted }}>
              Buttons and badges driven by global {colorScheme} palette
            </Text>

            <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SchemeColors[colorScheme].primary }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Primary token");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.background }}>Primary</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: SchemeColors[colorScheme].surface }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Surface token");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                  Surface
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SchemeColors[colorScheme].success }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Success token");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.background }}>
                  Success
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SchemeColors[colorScheme].warning }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Warning token");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.background }}>
                  Warning
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: SchemeColors[colorScheme].error }}
                onPress={() => {
                  setPressCount((count) => count + 1);
                  setLastAction("Pressed Error token");
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.background }}>
                  Error
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16, borderRadius: 12, backgroundColor: colors.background, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>
                useColors()
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: colors.muted }}>
                Background: {colors.background} • Text: {colors.text} • Tint: {colors.tint}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                (Pressable uses style; Tailwind on Pressable is disabled via remap)
              </Text>
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconSymbol name="house.fill" color={colors.tint} size={20} />
                  <Text style={{ fontSize: 14, color: colors.foreground }}>
                    Press count: {pressCount}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, color: colors.muted }}>
                  Last action: {lastAction}
                </Text>
              </View>
            </View>
          </ThemedView>

          <ThemedView style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.foreground }}>
              Palette values
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: colors.muted }}>
              Live values for the selected scheme
            </Text>
            <View style={{ marginTop: 12, gap: 8 }}>
              {swatches.map((item) => (
                <ColorSwatch key={item.name} name={item.name} value={item.value} />
              ))}
            </View>
          </ThemedView>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  schemeToggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  schemeToggleTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  schemeToggleSubtitle: {
    fontSize: 12,
  },
});
