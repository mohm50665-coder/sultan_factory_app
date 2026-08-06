import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

interface BackButtonProps {
  color?: string;
  size?: number;
  target?: string;
}

export function BackButton({ color = "white", size = 24, target = "/(tabs)" }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.replace(target as any)}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      <MaterialIcons name="arrow-back" size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
});
