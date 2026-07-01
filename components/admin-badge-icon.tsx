import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { administrativeService } from "@/lib/services/data.service";

interface AdminBadgeIconProps {
  size?: number;
  color?: string;
}

export function AdminBadgeIcon({ size = 24, color = "white" }: AdminBadgeIconProps) {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadPendingCount();
    // Refresh every 10 seconds
    const interval = setInterval(loadPendingCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingCount = async () => {
    try {
      const requests = await administrativeService.getAll();
      const pending = requests.filter(
        (r) =>
          r.directManagerStatus === "pending" ||
          r.generalManagerStatus === "pending" ||
          r.boardRepStatus === "pending"
      ).length;
      setPendingCount(pending);
    } catch (error) {
      console.error("Error loading pending count:", error);
    }
  };

  return (
    <TouchableOpacity
      onPress={() => router.push("/administrative" as any)}
      style={styles.container}
    >
      <MaterialIcons name="assignment" size={size} color={color} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendingCount > 99 ? "99+" : pendingCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: 8,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "white",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
});
