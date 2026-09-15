import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { representativeService } from "@/lib/services/representative.service";

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const SALES_DEPARTMENTS = ["sales", "marketing", "sales_manager", "المبيعات", "التسويق", "التسويق والمبيعات", "إدارة التسويق والمبيعات"];

export default function RepresentativePerformanceScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>({ representatives: [] });
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const canView = user?.role === "admin" || SALES_DEPARTMENTS.some((department) => normalize(user?.department).includes(normalize(department))) || normalize(user?.position).includes("مندوب");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [performance, approvals] = await Promise.all([representativeService.performance.summary(), representativeService.approvals()]);
      setSummary(performance || { representatives: [] });
      setPending(Array.isArray(approvals) ? approvals : []);
    } catch (error: any) { Alert.alert("تعذر تحميل وحدة أداء المندوب", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const modules = [
    { title: "دليل العملاء", description: "ملف مركزي ومرفقات وموقع العميل", icon: "business", color: "#0369a1", route: "/representative-customers" },
    { title: "الطلبات والزيارات", description: "طلبات متعددة المنتجات وزيارات ومرتجعات", icon: "assignment", color: "#0f766e", route: { pathname: "/representative-transactions", params: { type: "order" } } },
    { title: "التصنيع الخاص والعينات", description: "المواصفات ونسب الخيوط ودورة العينة", icon: "design-services", color: "#7c3aed", route: { pathname: "/representative-transactions", params: { type: "custom" } } },
    { title: "التحصيل", description: "ربط العميل والفاتورة وإثبات الدفع", icon: "payments", color: "#15803d", route: "/representative-collections" },
    { title: "المتابعة والاعتمادات", description: "المسؤول الحالي والمدة وسجل الإجراءات", icon: "fact-check", color: "#b45309", route: "/representative-approvals" },
  ] as const;
  const report = summary.representatives?.[0];

  if (!canView) return <ScreenContainer><View style={styles.locked}><MaterialIcons name="lock" size={45} color={colors.muted} /><Text style={[styles.lockedText, { color: colors.foreground }]}>هذه الوحدة مخصصة للمندوبين وإدارة التسويق والمبيعات</Text></View></ScreenContainer>;

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>أداء المندوب</Text><Text style={styles.headerSubtitle}>وحدة تشغيلية مؤتمتة لإدارة دورة العميل والمعاملة كاملة</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => void load()}><MaterialIcons name="refresh" size={22} color="#fff" /></TouchableOpacity></View><ScrollView contentContainerStyle={styles.content}><View style={styles.notice}><MaterialIcons name="info" size={20} color="#0369a1" /><Text style={styles.noticeText}>هذه الوحدة مستقلة عن «تقييم أداء الموظفين». هنا تُدار أعمال المندوب والعملاء والطلبات والتصنيع والتحصيل والاعتمادات.</Text></View><View style={styles.moduleGrid}>{modules.map((module) => <TouchableOpacity key={module.title} style={styles.moduleCard} onPress={() => router.push(module.route as any)}><View style={[styles.moduleIcon, { backgroundColor: `${module.color}18` }]}><MaterialIcons name={module.icon as any} size={29} color={module.color} /></View><Text style={styles.moduleTitle}>{module.title}</Text><Text style={styles.moduleDescription}>{module.description}</Text></TouchableOpacity>)}</View><TouchableOpacity style={styles.reportButton} onPress={() => router.push("/representative-reports" as any)}><MaterialIcons name="analytics" size={23} color="#fff" /><View style={{ flex: 1 }}><Text style={styles.reportTitle}>التقرير الشامل لأداء المندوب</Text><Text style={styles.reportSubtitle}>يومي وأسبوعي وشهري ومعايير قابلة للضبط</Text></View><MaterialIcons name="chevron-left" size={25} color="#fff" /></TouchableOpacity>{loading ? <ActivityIndicator color={colors.primary} size="large" /> : <><Text style={styles.sectionTitle}>ملخص التشغيل الحالي</Text><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{pending.length}</Text><Text style={styles.metricLabel}>تحتاج إجراء</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{report?.totals?.transactions || 0}</Text><Text style={styles.metricLabel}>المعاملات</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{report?.score ? `${report.score}%` : "—"}</Text><Text style={styles.metricLabel}>النتيجة</Text></View></View>{summary.representatives?.length > 1 && <><Text style={styles.sectionTitle}>نتائج المندوبين</Text>{summary.representatives.map((row: any) => <View key={row.representative.id} style={styles.repCard}><View style={[styles.score, { backgroundColor: row.score >= 80 ? "#dcfce7" : "#fef3c7" }]}><Text style={{ color: row.score >= 80 ? "#15803d" : "#a16207", fontWeight: "900" }}>{row.score}%</Text></View><View style={{ flex: 1 }}><Text style={styles.repName}>{row.representative.name}</Text><Text style={styles.repMeta}>طلبات {row.totals.orders} · زيارات {row.totals.visits} · تحصيل {row.totals.collectionAmount.toLocaleString("ar-SA")} ر.س</Text></View></View>)}</>}</>}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, content: { padding: 14, paddingBottom: 90, gap: 13 }, notice: { flexDirection: "row-reverse", gap: 8, backgroundColor: "#e0f2fe", borderRadius: 12, padding: 12 }, noticeText: { flex: 1, color: "#075985", fontSize: 12, lineHeight: 19, textAlign: "right" }, moduleGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 }, moduleCard: { width: "48%", minHeight: 146, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 15, padding: 13, alignItems: "flex-end" }, moduleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 10 }, moduleTitle: { color: "#0f172a", fontSize: 14, fontWeight: "900", textAlign: "right" }, moduleDescription: { color: "#64748b", fontSize: 10, textAlign: "right", lineHeight: 16, marginTop: 4 }, reportButton: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: "#0f172a", borderRadius: 14, padding: 14 }, reportTitle: { color: "#fff", fontWeight: "900", textAlign: "right" }, reportSubtitle: { color: "#cbd5e1", fontSize: 10, textAlign: "right", marginTop: 3 }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, metrics: { flexDirection: "row-reverse", gap: 9 }, metric: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, alignItems: "center" }, metricValue: { color: "#0a7ea4", fontSize: 19, fontWeight: "900" }, metricLabel: { color: "#64748b", fontSize: 10, marginTop: 3 }, repCard: { flexDirection: "row-reverse", alignItems: "center", gap: 9, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 11 }, score: { padding: 9, borderRadius: 10 }, repName: { color: "#0f172a", fontWeight: "900", textAlign: "right" }, repMeta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 3 }, locked: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }, lockedText: { marginTop: 12, fontWeight: "800", textAlign: "center" },
});
