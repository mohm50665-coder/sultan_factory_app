import React from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";

interface WarehouseSection {
  id: string;
  label: string;
  icon: string;
  color: string;
  route: string;
  description: string;
}

export default function WarehouseScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";

  const WAREHOUSE_SECTIONS: WarehouseSection[] = [
    {
      id: "manufacturing_view",
      label: isAr ? "مراحل تسليم الإنتاج" : "Production Delivery Stages",
      icon: "precision-manufacturing",
      color: "#8b5cf6",
      route: "/manufacturing",
      description: isAr ? "عرض مراحل التسليم (قراءة فقط)" : "View delivery stages (Read only)",
    },
    {
      id: "finished_in",
      label: t("finished_warehouse"),
      icon: "inventory",
      color: "#16a34a",
      route: "/warehouse-finished",
      description: isAr ? "إدخال الإنتاج التام والنخب الثاني" : "Input finished goods and second grade",
    },
    {
      id: "raw_in",
      label: t("raw_materials_warehouse"),
      icon: "inventory-2",
      color: "#3b82f6",
      route: "/warehouse-raw",
      description: isAr ? "إدخال المواد الخام والخيوط وقطع الغيار" : "Input raw materials, threads, and spare parts",
    },
    {
      id: "out",
      label: t("warehouse_outgoing"),
      icon: "output",
      color: "#ef4444",
      route: "/warehouse-out",
      description: isAr ? "إخراج من مستودع الإنتاج التام أو المواد الخام" : "Output from finished goods or raw materials warehouse",
    },
  ];

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: "#f59e0b", flexDirection: isRtl ? "row-reverse" : "row" }]}>
        <BackButton />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t("warehouse")}</Text>
          <Text style={styles.headerSubtitle}>{isAr ? "إدارة المخزون والمواد" : "Inventory and Materials Management"}</Text>
        </View>
        <AdminBadgeIcon />
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {/* الأقسام */}
      <ScrollView contentContainerStyle={styles.content}>
        {WAREHOUSE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.id}
            onPress={() => router.push(section.route as any)}
            activeOpacity={0.7}
            style={styles.sectionCard}
          >
            <View style={[styles.sectionRow, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
              <MaterialIcons name={isRtl ? "chevron-left" : "chevron-right"} size={24} color={colors.muted} />
              <View style={[styles.sectionInfo, { alignItems: isRtl ? "flex-end" : "flex-start", marginRight: isRtl ? 16 : 0, marginLeft: isRtl ? 0 : 16 }]}>
                <Text style={[styles.sectionLabel, { textAlign: isRtl ? "right" : "left" }]}>{section.label}</Text>
                <Text style={[styles.sectionDescription, { textAlign: isRtl ? "right" : "left" }]}>{section.description}</Text>
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
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#11181C",
  },
  sectionDescription: {
    fontSize: 12,
    color: "#687076",
    marginTop: 4,
  },
});
