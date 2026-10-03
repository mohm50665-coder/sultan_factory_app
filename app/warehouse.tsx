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
  const { language } = useLanguage();
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
      label: isAr ? "مستودع الإنتاج التام" : "Finished Goods Warehouse",
      icon: "inventory",
      color: "#16a34a",
      route: "/warehouse-finished",
      description: isAr ? "إدخال الإنتاج التام والنخب الثاني" : "Input finished goods and second grade",
    },
    {
      id: "representative_orders",
      label: isAr ? "طلبات المناديب / طلبات المبيعات" : "Representative / Sales Orders",
      icon: "assignment",
      color: "#f59e0b",
      route: "/warehouse-representative-orders",
      description: isAr ? "استلام الطلبات المحولة من المندوبين وإخراجها وتنفيذها" : "Receive, issue and execute representative sales orders",
    },
    {
      id: "raw_in",
      label: isAr ? "مستودع المواد الخام" : "Raw Materials Warehouse",
      icon: "inventory-2",
      color: "#3b82f6",
      route: "/warehouse-raw",
      description: isAr ? "إدخال المواد الخام والخيوط وقطع الغيار" : "Input raw materials, threads, and spare parts",
    },
    {
      id: "out",
      label: isAr ? "الخارج من المستودعات" : "Warehouse Outbound",
      icon: "output",
      color: "#ef4444",
      route: "/warehouse-out",
      description: isAr ? "إخراج من مستودع الإنتاج التام أو المواد الخام" : "Output from finished goods or raw materials warehouse",
    },
    {
      id: "production_requests",
      label: isAr ? "طلبات الإنتاج" : "Production Requests",
      icon: "assignment",
      color: "#8b5cf6",
      route: "/production-requests",
      description: isAr ? "طلبات إنتاج من المستودعات - مربوطة بالإنتاج" : "Production requests from warehouse - linked to production",
    },
    {
      id: "customer_orders",
      label: isAr ? "طلبات العملاء" : "Customer Orders",
      icon: "shopping-bag",
      color: "#0a7ea4",
      route: "/orders-visits",
      description: isAr ? "عرض طلبات العملاء وحالة التجهيز" : "View customer orders and preparation status",
    },
  ];

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: "#f59e0b" }]}>
        <BackButton />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isAr ? "المستودعات" : "Warehouses"}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 19,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 10,
    paddingBottom: 18,
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInfo: {
    flex: 1,
    marginRight: 10,
    alignItems: "flex-end",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#11181C",
    textAlign: "right",
  },
  sectionDescription: {
    fontSize: 11,
    color: "#687076",
    marginTop: 2,
    textAlign: "right",
  },
});
