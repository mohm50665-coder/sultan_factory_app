import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { representativeService } from "@/lib/services/representative.service";

const STATUS: Record<string, string> = { PENDING_WAREHOUSE_ISSUE: "بانتظار التنفيذ", WAREHOUSE_PARTIAL: "تنفيذ جزئي", WAREHOUSE_NOT_EXECUTED: "لم يتم التنفيذ" };
const esc = (v: unknown) => String(v ?? "-").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as any)[c] || c);

export default function WarehouseOverdueOrders() {
  const colors = useColors();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await representativeService.scanOverdue();
      const data: any = await representativeService.transactions.list({ transactionType: "order" });
      setRows((data || []).filter((row: any) => row.isOverdue && ["PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL", "WAREHOUSE_NOT_EXECUTED"].includes(row.status)));
    } catch (error: any) { Alert.alert("تعذر تحميل التقرير", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const reportHtml = useMemo(() => {
    const body = rows.map((row, i) => `<tr><td>${i + 1}</td><td>${esc(row.referenceCode)}</td><td>${esc(row.customerName)}</td><td>${esc(row.representativeName)}</td><td>${esc(row.orderDate)}</td><td>${esc(row.warehouseDeadlineAt ? new Date(row.warehouseDeadlineAt).toLocaleString("ar-SA") : "-")}</td><td>${esc(STATUS[row.status] || row.status)}</td><td>${esc(row.rejectionReason || "لم يوثق السبب بعد")}</td></tr>`).join("");
    return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير الطلبات المتأخرة</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial;color:#17202a;direction:rtl}h1{color:#991b1b;font-size:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right}th{background:#991b1b;color:#fff}tr{page-break-inside:avoid}</style></head><body><h1>تقرير طلبات العملاء المتأخرة عن مهلة 48 ساعة</h1><p>عدد الطلبات: ${rows.length} — تاريخ التقرير: ${esc(new Date().toLocaleString("ar-SA"))}</p><table><thead><tr><th>#</th><th>رقم الطلب</th><th>العميل</th><th>المندوب</th><th>تاريخ الطلب</th><th>آخر موعد</th><th>الحالة</th><th>السبب/الإجراء</th></tr></thead><tbody>${body || '<tr><td colspan="8">لا توجد طلبات متأخرة</td></tr>'}</tbody></table></body></html>`;
  }, [rows]);
  const exportReport = (format: "word" | "excel") => {
    if (Platform.OS !== "web" || typeof document === "undefined") return Alert.alert("التنزيل متاح من الويب", "افتح نسخة الويب لتنزيل التقرير");
    const url = URL.createObjectURL(new Blob(["\ufeff", reportHtml], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" }));
    const a = document.createElement("a"); a.href = url; a.download = `تقرير-الطلبات-المتأخرة-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`; a.click(); URL.revokeObjectURL(url);
  };
  const print = () => { if (Platform.OS !== "web" || typeof window === "undefined") return Alert.alert("الطباعة متاحة من الويب"); const w = window.open("", "overdue-orders", "width=1400,height=900"); if (!w) return; w.document.write(reportHtml.replace("</body>", '<script>window.onload=()=>window.print()</script></body>')); w.document.close(); };
  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.title}>تقرير الطلبات المتأخرة</Text><Text style={styles.subtitle}>المهلة النظامية لإخراج الطلب: 48 ساعة</Text></View><MaterialIcons name="warning" size={28} color="#fff" /></View><View style={styles.summary}><Text style={styles.count}>{loading ? "—" : rows.length}</Text><Text style={styles.countLabel}>طلب متأخر يحتاج إجراء</Text></View><View style={styles.actions}><TouchableOpacity style={styles.button} onPress={() => exportReport("word")}><Text style={styles.buttonText}>Word</Text></TouchableOpacity><TouchableOpacity style={styles.button} onPress={() => exportReport("excel")}><Text style={styles.buttonText}>Excel</Text></TouchableOpacity><TouchableOpacity style={styles.print} onPress={print}><Text style={styles.buttonText}>طباعة PDF</Text></TouchableOpacity></View><ScrollView contentContainerStyle={styles.content}>{loading ? <Text style={styles.empty}>جارٍ تحديث التقرير...</Text> : rows.length === 0 ? <Text style={styles.empty}>لا توجد طلبات متأخرة حاليًا</Text> : rows.map((row) => <TouchableOpacity key={row.id} style={styles.card} onPress={() => router.push({ pathname: "/representative-approvals", params: { id: String(row.id) } } as any)}><View style={styles.cardHead}><Text style={styles.badge}>{STATUS[row.status] || row.status}</Text><Text style={styles.reference}>{row.referenceCode}</Text></View><Text style={styles.customer}>{row.customerName}</Text><Text style={styles.meta}>المندوب: {row.representativeName} · تاريخ الطلب: {row.orderDate || "-"}</Text><Text style={styles.overdue}>آخر موعد: {row.warehouseDeadlineAt ? new Date(row.warehouseDeadlineAt).toLocaleString("ar-SA") : "-"} · المسؤول: المستودعات</Text><Text style={styles.reason}>السبب/الإجراء: {row.rejectionReason || "لم يوثق السبب بعد"}</Text><Text style={styles.detail}>فتح تفاصيل الطلب والسجل الزمني</Text></TouchableOpacity>)}</ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ header: { backgroundColor: "#991b1b", padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, title: { color: "#fff", fontWeight: "900", fontSize: 19, textAlign: "right" }, subtitle: { color: "#fee2e2", fontSize: 11, marginTop: 3, textAlign: "right" }, summary: { margin: 10, padding: 14, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, alignItems: "center" }, count: { color: "#b91c1c", fontSize: 30, fontWeight: "900" }, countLabel: { color: "#7f1d1d", fontWeight: "800" }, actions: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 10 }, button: { flex: 1, backgroundColor: "#0369a1", padding: 9, borderRadius: 8, alignItems: "center" }, print: { flex: 1, backgroundColor: "#991b1b", padding: 9, borderRadius: 8, alignItems: "center" }, buttonText: { color: "#fff", fontWeight: "900", fontSize: 11 }, content: { padding: 10, gap: 8 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fecaca", borderRadius: 10, padding: 11, gap: 5 }, cardHead: { flexDirection: "row-reverse", justifyContent: "space-between" }, reference: { color: "#0f172a", fontWeight: "900" }, badge: { color: "#991b1b", fontWeight: "900", fontSize: 11 }, customer: { color: "#0f172a", fontWeight: "900", fontSize: 16, textAlign: "right" }, meta: { color: "#64748b", fontSize: 11, textAlign: "right" }, overdue: { color: "#b91c1c", fontWeight: "900", fontSize: 11, textAlign: "right" }, reason: { color: "#475569", fontSize: 11, textAlign: "right" }, detail: { color: "#0369a1", fontWeight: "900", fontSize: 11, textAlign: "right" }, empty: { textAlign: "center", color: "#64748b", padding: 40 } });
