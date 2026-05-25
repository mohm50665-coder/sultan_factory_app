import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { administrativeService } from "@/lib/services/data.service";

export function AdminCard() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadPendingCount();
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
      style={styles.card}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <MaterialIcons name="chevron-left" size={24} color="#0369a1" />
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.title}>الإجراءات الإدارية</Text>
        <Text style={styles.subtitle}>
          الطلبات والإجراءات الإدارية للموظفين
        </Text>
        {pendingCount > 0 && (
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>{pendingCount} طلب معلق</Text>
            <View style={styles.badge} />
          </View>
        )}
      </View>
      <View style={styles.iconContainer}>
        <MaterialIcons name="assignment" size={28} color="white" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "#f0f9ff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: "#0369a1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0369a1",
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  badgeText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
  },
  iconContainer: {
    backgroundColor: "#0369a1",
    borderRadius: 12,
    padding: 10,
    marginLeft: 12,
  },
});
