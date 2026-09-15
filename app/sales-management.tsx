import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";

const MANAGEMENT_ITEMS = [
  { id: "daily", title: "التقرير اليومي للمبيعات والتحصيل", description: "إعداد وحفظ تقرير الإدارة اليومي وفق النموذج المعتمد", icon: "today", color: "#0f766e", route: "/daily-summary" },
  { id: "evaluation", title: "تقييم أداء المندوب", description: "النسبة المئوية ومعايير التقييم والأوزان المعتمدة", icon: "percent", color: "#7c3aed", route: "/representative-reports" },
  { id: "approvals", title: "الاعتمادات والطلبات", description: "اعتماد الطلبات والتصنيع والعينات ومتابعة المسؤول الحالي", icon: "fact-check", color: "#2563eb", route: "/representative-approvals" },
  { id: "report", title: "تقرير أداء المندوب الشامل", description: "تقرير يومي وأسبوعي وشهري وشامل منذ بداية التشغيل", icon: "analytics", color: "#b45309", route: "/representative-reports" },
] as const;

const normalize = (value: unknown) => String(value || "").normalize("NFKC").replace(/[\u064B-\u065F\u0670]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export default function SalesManagementScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const department = normalize(user?.department);
  const position = normalize(user?.position);
  const isSalesDepartment = department.includes("sales") || department.includes("marketing") || department.includes("المبيعات") || department.includes("التسويق");
  const isManager = user?.role === "admin" || (["manager", "supervisor"].includes(String(user?.role)) && isSalesDepartment) || position.includes("مدير المبيعات") || position.includes("مدير التسويق");

  if (!isManager) {
    return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><Text style={styles.headerTitle}>إدارة التسويق والمبيعات</Text></View><View style={styles.denied}><MaterialIcons name="lock" size={46} color="#b91c1c" /><Text style={styles.deniedTitle}>غير مصرح بالدخول</Text><Text style={styles.deniedText}>هذه الواجهة مخصصة لمدير إدارة التسويق والمبيعات والأدمن.</Text></View></ScreenContainer>;
  }

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={styles.headerText}><Text style={styles.headerTitle}>إدارة التسويق والمبيعات</Text><Text style={styles.headerSubtitle}>التقارير والتقييم والاعتمادات والمتابعة الإدارية</Text></View><MaterialIcons name="business-center" size={28} color="#fff" /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.notice}><MaterialIcons name="info-outline" size={21} color="#075985" /><Text style={styles.noticeText}>تم نقل الطلبات والزيارات والتصنيع الخاص والتحصيل إلى وحدة أداء المندوب. هذه الصفحة مخصصة للإدارة والاعتماد والتقارير فقط.</Text></View>
      {MANAGEMENT_ITEMS.map((item) => <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.75} onPress={() => router.push(item.route as any)}>
        <View style={[styles.iconBox, { backgroundColor: `${item.color}18` }]}><MaterialIcons name={item.icon} size={29} color={item.color} /></View>
        <View style={styles.cardText}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.cardDescription}>{item.description}</Text></View>
        <MaterialIcons name="chevron-left" size={25} color="#94a3b8" />
      </TouchableOpacity>)}
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 20, lineHeight: 28, fontWeight: "900", textAlign: "right", flex: 1 },
  headerSubtitle: { color: "#dbeafe", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 2 },
  content: { padding: 15, paddingBottom: 90, gap: 12 },
  notice: { backgroundColor: "#e0f2fe", borderWidth: 1, borderColor: "#bae6fd", borderRadius: 14, padding: 13, flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  noticeText: { color: "#075985", lineHeight: 21, textAlign: "right", flex: 1 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 15, flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  iconBox: { width: 54, height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1 },
  cardTitle: { color: "#0f172a", fontSize: 16, lineHeight: 23, fontWeight: "900", textAlign: "right" },
  cardDescription: { color: "#64748b", fontSize: 12, lineHeight: 19, textAlign: "right", marginTop: 3 },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
  deniedTitle: { color: "#991b1b", fontSize: 19, fontWeight: "900" },
  deniedText: { color: "#64748b", textAlign: "center", lineHeight: 21 },
});
