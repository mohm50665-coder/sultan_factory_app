import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { manufacturingStageService } from "@/lib/services/data.service";

const stageNames: Record<string, string> = { rosso: "الروسو", qalb: "القلب", kawiya: "الكاوية", inspection: "الفحص", packing: "التعبئة والتغليف", antislip: "مانع الانزلاق", storage: "التخزين" };
const quantity = (row: any) => `${Number(row.quantityDozen || 0)} درزن + ${Number(row.quantityPair || 0)} زوج`;

export default function MyCustodyScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const router = useRouter();
  const isAr = language === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); try { setRows(await manufacturingStageService.myCustody()); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={styles.headerText}><Text style={styles.title}>{isAr ? "عهدتي الحالية" : "My Current Custody"}</Text><Text style={styles.subtitle}>{isAr ? "المنتجات الموجودة لديك ولم تُسلّم بعد" : "Products currently held by you"}</Text></View><MaterialIcons name="assignment-ind" size={28} color="#fff" /></View>
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.content}>
      <View style={[styles.notice, { borderColor: rows.some((row) => row.isOverdue) ? "#fdba74" : colors.border }]}><MaterialIcons name="info-outline" size={20} color={rows.some((row) => row.isOverdue) ? "#c2410c" : colors.primary} /><Text style={styles.noticeText}>{isAr ? "يجب تسليم العهدة الحالية قبل استلام منتج جديد. يتم التنبيه تلقائياً عند تجاوز 24 ساعة." : "Deliver current custody before receiving another product. You are notified automatically after 24 hours."}</Text></View>
      {loading ? <ActivityIndicator color={colors.primary} size="large" /> : rows.length === 0 ? <View style={styles.empty}><MaterialIcons name="task-alt" size={42} color="#16a34a" /><Text style={styles.emptyTitle}>{isAr ? "لا توجد عهدة حالية" : "No active custody"}</Text><Text style={styles.emptyText}>{isAr ? "يمكنك استلام منتج جديد عند ظهوره في قائمة المرحلة." : "You can receive a new product when it appears in your stage queue."}</Text></View> : rows.map((row) => <View key={String(row.id)} style={[styles.card, row.isOverdue && styles.overdueCard]}><View style={styles.cardTop}><View style={[styles.badge, { backgroundColor: row.isOverdue ? "#ffedd5" : "#fee2e2" }]}><Text style={{ color: row.isOverdue ? "#c2410c" : "#b91c1c", fontWeight: "900", fontSize: 11 }}>{row.isOverdue ? (isAr ? `متأخرة ${row.hoursOpen} ساعة` : `Overdue ${row.hoursOpen}h`) : (isAr ? "مستلم" : "Received")}</Text></View><Text style={styles.product}>{row.productName || "—"}</Text></View><View style={styles.grid}><Text style={styles.cell}><Text style={styles.label}>{isAr ? "المرحلة" : "Stage"}</Text>{stageNames[row.stageName] || row.stageName || "—"}</Text><Text style={styles.cell}><Text style={styles.label}>{isAr ? "الكمية" : "Quantity"}</Text>{quantity(row)}</Text><Text style={styles.cell}><Text style={styles.label}>{isAr ? "وقت الاستلام" : "Received"}</Text>{row.receivedAt ? new Date(row.receivedAt).toLocaleString(isAr ? "ar-SA" : "en-US") : "—"}</Text></View><TouchableOpacity style={styles.openButton} onPress={() => router.push({ pathname: "/manufacturing", params: { stage: row.stageName } })}><MaterialIcons name="open-in-new" size={17} color="#fff" /><Text style={styles.openText}>{isAr ? "فتح بطاقة العهدة وتسليم المنتج" : "Open custody card"}</Text></TouchableOpacity></View>)}
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ header: { backgroundColor: "#0a7ea4", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }, headerText: { flex: 1, alignItems: "flex-end" }, title: { color: "#fff", fontSize: 19, fontWeight: "900" }, subtitle: { color: "#dbeafe", fontSize: 11, marginTop: 3 }, content: { padding: 12, gap: 10, paddingBottom: 50 }, notice: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, borderWidth: 1, borderRadius: 10, backgroundColor: "#fff7ed" }, noticeText: { flex: 1, color: "#7c2d12", fontSize: 11, textAlign: "right", lineHeight: 17 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, gap: 9 }, overdueCard: { borderColor: "#fb923c", backgroundColor: "#fffaf5" }, cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, product: { flex: 1, color: "#0f172a", fontSize: 16, fontWeight: "900", textAlign: "right" }, badge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 5 }, grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, cell: { flex: 1, minWidth: 130, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6, padding: 7, color: "#334155", fontSize: 11, textAlign: "right" }, label: { color: "#64748b", fontSize: 10, fontWeight: "800", marginBottom: 3 }, openButton: { backgroundColor: "#0a7ea4", borderRadius: 7, paddingVertical: 9, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }, openText: { color: "#fff", fontWeight: "900", fontSize: 12 }, empty: { alignItems: "center", paddingVertical: 70, gap: 8 }, emptyTitle: { color: "#15803d", fontSize: 17, fontWeight: "900" }, emptyText: { color: "#64748b", textAlign: "center", fontSize: 12 } });
