import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface WarehouseSection {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string;
  description: string;
}

const WAREHOUSE_SECTIONS: WarehouseSection[] = [
  {
    id: "finished_in",
    label: "مستودع الإنتاج التام",
    icon: "inventory",
    color: "#16a34a",
    route: "/warehouse-finished",
    description: "إدخال الإنتاج التام والنخب الثاني",
  },
  {
    id: "raw_in",
    label: "مستودع المواد الخام",
    icon: "inventory-2",
    color: "#3b82f6",
    route: "/warehouse-raw",
    description: "إدخال المواد الخام والخيوط وقطع الغيار",
  },
  {
    id: "out",
    label: "الخارج من المستودعات",
    icon: "output",
    color: "#ef4444",
    route: "/warehouse-out",
    description: "إخراج من مستودع الإنتاج التام أو المواد الخام",
  },
];

export default function WarehouseScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: "#f59e0b" }]}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>المستودعات</Text>
          <Text style={styles.headerSubtitle}>إدارة المخزون والمواد</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* الأقسام */}
      <ScrollView contentContainerStyle={styles.content}>
        {WAREHOUSE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.id}
            onPress={() => router.push(section.route as any)}
            activeOpacity={0.7}
            style={styles.sectionCard}
          >
            <View style={styles.sectionRow}>
              <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <Text style={styles.sectionDescription}>{section.description}</Text>
              </View>
              <View style={[styles.sectionIcon, { backgroundColor: `${section.color}15` }]}>
                <MaterialIcons name={section.icon as any} size={28} color={section.color} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 20,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInfo: {
    flex: 1,
    marginRight: 16,
    alignItems: "flex-end",
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#11181C",
    textAlign: "right",
  },
  sectionDescription: {
    fontSize: 12,
    color: "#687076",
    marginTop: 4,
    textAlign: "right",
  },
});
