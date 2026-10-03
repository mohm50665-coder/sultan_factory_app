import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { representativeService } from "@/lib/services/representative.service";
import { useColors } from "@/hooks/use-colors";

const LABELS: Record<string, string> = {
  PENDING_WAREHOUSE_ISSUE: "بانتظار التنفيذ",
  WAREHOUSE_PARTIAL: "تنفيذ جزئي / رد مطلوب",
  WAREHOUSE_EXECUTED: "تم التنفيذ",
  REPRESENTATIVE_CLOSED: "أغلقه المندوب",
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" } as Record<string, string>)[char] || char);

export default function WarehouseRepresentativeOrders() {
  const colors = useColors();
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await representativeService.transactions.list({ transactionType: "order" });
      setRows((data || []).filter((row: any) => ["PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL", "WAREHOUSE_EXECUTED"].includes(row.status)));
    } catch (e: any) {
      Alert.alert("تعذر تحميل الطلبات", e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: number, action: string) => {
    try {
      await representativeService.transactions.transition({ id, action, notes: notes[id] || "" });
      setNotes((current) => ({ ...current, [id]: "" }));
      await load();
      Alert.alert("تم الحفظ", action === "warehouse_execute" ? "تم تنفيذ الطلب وخصم الكميات من مستودع الإنتاج التام" : "تم تسجيل الملاحظة وإعادة الطلب للمندوب، وتم إرسال إشعار له");
    } catch (e: any) {
      Alert.alert("تعذر تنفيذ الإجراء", e?.message || "حدث خطأ ولم يتم خصم أي كمية");
    }
  };

  const reportHtml = useMemo(() => {
    const reportRows = rows.map((row, index) => {
      const itemRows = (row.items || []).map((item: any) => `<li>${escapeHtml(item.productName)} — المقاس: ${escapeHtml(item.size)} — اللون: ${escapeHtml(item.color)} — الكمية: ${escapeHtml(item.quantity)} ${item.quantityUnit === "dozen" ? "درزن" : "زوج"} — الباركود: ${escapeHtml(item.barcode || "-")}</li>`).join("");
      return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.referenceCode || "-")}</strong></td><td>${escapeHtml(row.customerName || "-")}</td><td>${escapeHtml(row.representativeName || "-")}</td><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.deliveryDate || "-")}</td><td>${escapeHtml(LABELS[row.status] || row.status || "-")}</td><td><ul>${itemRows || "<li>لا توجد أصناف</li>"}</ul></td><td>${escapeHtml(row.rejectionReason || row.correctiveAction || "-")}</td></tr>`;
    }).join("");
    return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير طلبات المناديب</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#17202a;direction:rtl}h1{color:#075985;font-size:20px}p{color:#475569;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #94a3b8;padding:5px;text-align:right;vertical-align:top}th{background:#075985;color:#fff}tr{page-break-inside:avoid}ul{margin:0;padding-right:15px}</style></head><body><h1>تقرير طلبات المناديب</h1><p>تاريخ ووقت التقرير: ${escapeHtml(new Date().toLocaleString("ar-SA"))} — عدد الطلبات: ${rows.length}</p><table><thead><tr><th>#</th><th>رقم الطلب</th><th>العميل</th><th>المندوب</th><th>تاريخ الطلب</th><th>موعد التسليم</th><th>الحالة</th><th>الأصناف والكميات والباركود</th><th>الملاحظات</th></tr></thead><tbody>${reportRows || '<tr><td colspan="9">لا توجد طلبات</td></tr>'}</tbody></table></body></html>`;
  }, [rows]);

  const downloadReport = (format: "word" | "excel") => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      Alert.alert("التنزيل متاح من الويب", "افتح نسخة الويب لتنزيل التقرير");
      return;
    }
    const blob = new Blob(["\ufeff", reportHtml], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `تقرير-طلبات-المناديب-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert("PDF متاح من الويب", "افتح نسخة الويب ثم اختر طباعة وحفظ بصيغة PDF");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;
    printWindow.document.write(`${reportHtml.replace("</body>", '<script>window.onload=()=>window.print()</script></body>')}`);
    printWindow.document.close();
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.title}>طلبات المناديب</Text><Text style={styles.subtitle}>طلبات العملاء المحولة للمستودعات للإخراج والتنفيذ</Text></View><MaterialIcons name="assignment" size={26} color="#fff" /></View>
    <View style={styles.exportBar}><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("word")}><MaterialIcons name="description" size={17} color="#fff" /><Text style={styles.exportText}>Word</Text></TouchableOpacity><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("excel")}><MaterialIcons name="table-view" size={17} color="#fff" /><Text style={styles.exportText}>Excel</Text></TouchableOpacity><TouchableOpacity style={styles.pdfButton} onPress={printPdf}><MaterialIcons name="picture-as-pdf" size={17} color="#fff" /><Text style={styles.exportText}>PDF</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content}>{loading ? <Text style={styles.empty}>جارٍ تحميل الطلبات...</Text> : rows.length === 0 ? <Text style={styles.empty}>لا توجد طلبات بانتظار المستودع</Text> : rows.map((row) => <View key={row.id} style={styles.card}><View style={styles.cardHead}><Text style={styles.ref}>{row.referenceCode}</Text><Text style={styles.badge}>{LABELS[row.status] || row.status}</Text></View><Text style={styles.customer}>{row.customerName}</Text><Text style={styles.meta}>المندوب: {row.representativeName} · تاريخ الطلب: {row.orderDate || "-"} · موعد التسليم: {row.deliveryDate || "-"}</Text><View style={styles.items}>{(row.items || []).map((item: any, i: number) => <Text key={i} style={styles.item}>• {item.productName} — المقاس {item.size} — اللون {item.color} — {item.quantity} {item.quantityUnit === "dozen" ? "درزن" : "زوج"} — باركود {item.barcode || "-"}</Text>)}</View>{row.status !== "WAREHOUSE_EXECUTED" && <><TextInput value={notes[row.id] || ""} onChangeText={(value) => setNotes((current) => ({ ...current, [row.id]: value }))} placeholder="ملاحظات المستودع عند عدم التوفر أو التنفيذ الجزئي" multiline textAlign="right" style={styles.notes} /><View style={styles.actions}><TouchableOpacity style={styles.partial} onPress={() => void act(Number(row.id), "warehouse_partial")}><Text style={styles.actionText}>غير متاح / تنفيذ جزئي</Text></TouchableOpacity><TouchableOpacity style={styles.execute} onPress={() => void act(Number(row.id), "warehouse_execute")}><Text style={styles.actionText}>تم التنفيذ وخصم الرصيد</Text></TouchableOpacity></View></>}{row.status === "WAREHOUSE_EXECUTED" && <Text style={styles.done}>تم تنفيذ الطلب وخصم الرصيد — بانتظار إغلاق المندوب</Text>}<TouchableOpacity onPress={() => router.push({ pathname: "/representative-approvals", params: { id: String(row.id) } } as any)}><Text style={styles.detail}>عرض التفاصيل والسجل الزمني</Text></TouchableOpacity></View>)}</ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ header: { backgroundColor: "#f59e0b", padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 12 }, title: { color: "#fff", fontWeight: "900", fontSize: 20, textAlign: "right" }, subtitle: { color: "#fffbeb", fontSize: 12, marginTop: 3, textAlign: "right" }, exportBar: { flexDirection: "row-reverse", gap: 8, padding: 10, backgroundColor: "#fff7ed", borderBottomWidth: 1, borderBottomColor: "#fed7aa" }, exportButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, backgroundColor: "#2563eb", paddingVertical: 9, borderRadius: 8 }, pdfButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, backgroundColor: "#b91c1c", paddingVertical: 9, borderRadius: 8 }, exportText: { color: "#fff", fontWeight: "800", fontSize: 12 }, content: { padding: 16, gap: 12 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, gap: 8 }, cardHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, ref: { color: "#0f172a", fontWeight: "900" }, badge: { backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: "800" }, customer: { fontSize: 17, fontWeight: "900", color: "#0f172a", textAlign: "right" }, meta: { color: "#64748b", fontSize: 12, textAlign: "right" }, items: { backgroundColor: "#f8fafc", padding: 10, gap: 4 }, item: { color: "#334155", fontSize: 12, textAlign: "right" }, notes: { minHeight: 54, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 9, color: "#0f172a" }, actions: { flexDirection: "row-reverse", gap: 8 }, execute: { flex: 1, backgroundColor: "#15803d", padding: 11, borderRadius: 8, alignItems: "center" }, partial: { flex: 1, backgroundColor: "#dc2626", padding: 11, borderRadius: 8, alignItems: "center" }, actionText: { color: "#fff", fontWeight: "800", fontSize: 12 }, done: { color: "#15803d", fontWeight: "800", textAlign: "right" }, detail: { color: "#0369a1", fontWeight: "800", textAlign: "right", paddingTop: 4 }, empty: { textAlign: "center", color: "#64748b", padding: 40 } });
