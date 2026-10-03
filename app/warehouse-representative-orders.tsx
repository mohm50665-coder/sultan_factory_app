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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "executed">("all");
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});

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

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const searchable = [row.referenceCode, row.customerName, row.representativeName].filter(Boolean).join(" ").toLocaleLowerCase();
      const matchesText = !needle || searchable.includes(needle);
      const matchesStatus = statusFilter === "all" || (statusFilter === "pending" && row.status === "PENDING_WAREHOUSE_ISSUE") || (statusFilter === "partial" && row.status === "WAREHOUSE_PARTIAL") || (statusFilter === "executed" && row.status === "WAREHOUSE_EXECUTED");
      return matchesText && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const selectedRows = useMemo(() => filteredRows.filter((row) => selectedIds[Number(row.id)]), [filteredRows, selectedIds]);
  const reportRows = selectedRows.length ? selectedRows : filteredRows;
  const hasSelection = selectedRows.length > 0;

  const toggleSelected = (id: number) => setSelectedIds((current) => ({ ...current, [id]: !current[id] }));
  const toggleAllVisible = () => {
    const allSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds[Number(row.id)]);
    setSelectedIds((current) => {
      const next = { ...current };
      filteredRows.forEach((row) => { next[Number(row.id)] = !allSelected; });
      return next;
    });
  };

  const act = async (id: number, action: string) => {
    try {
      await representativeService.transactions.transition({ id, action, notes: notes[id] || "" });
      setNotes((current) => ({ ...current, [id]: "" }));
      setSelectedIds((current) => { const next = { ...current }; delete next[id]; return next; });
      await load();
      Alert.alert("تم الحفظ", action === "warehouse_execute" ? "تم تنفيذ الطلب وخصم الكميات من مستودع الإنتاج التام" : "تم تسجيل الملاحظة وإعادة الطلب للمندوب، وتم إرسال إشعار له");
    } catch (e: any) {
      Alert.alert("تعذر تنفيذ الإجراء", e?.message || "حدث خطأ ولم يتم خصم أي كمية");
    }
  };

  const reportHtml = useMemo(() => {
    const reportRowsHtml = reportRows.map((row, index) => {
      const itemRows = (row.items || []).map((item: any) => `<li>${escapeHtml(item.productName)} — المقاس: ${escapeHtml(item.size)} — اللون: ${escapeHtml(item.color)} — الكمية: ${escapeHtml(item.quantity)} ${item.quantityUnit === "dozen" ? "درزن" : "زوج"} — الباركود: ${escapeHtml(item.barcode || "-")}</li>`).join("");
      return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.referenceCode || "-")}</strong></td><td>${escapeHtml(row.customerName || "-")}</td><td>${escapeHtml(row.representativeName || "-")}</td><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.deliveryDate || "-")}</td><td>${escapeHtml(LABELS[row.status] || row.status || "-")}</td><td><ul>${itemRows || "<li>لا توجد أصناف</li>"}</ul></td><td>${escapeHtml(row.rejectionReason || row.correctiveAction || "-")}</td></tr>`;
    }).join("");
    return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير طلبات المناديب</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#17202a;direction:rtl}h1{color:#075985;font-size:20px}p{color:#475569;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #94a3b8;padding:5px;text-align:right;vertical-align:top}th{background:#075985;color:#fff}tr{page-break-inside:avoid}ul{margin:0;padding-right:15px}</style></head><body><h1>تقرير طلبات المناديب</h1><p>تاريخ ووقت التقرير: ${escapeHtml(new Date().toLocaleString("ar-SA"))} — عدد الطلبات: ${reportRows.length}${hasSelection ? " — طلبات محددة" : " — جميع الطلبات الظاهرة"}</p><table><thead><tr><th>#</th><th>رقم الطلب</th><th>العميل</th><th>المندوب</th><th>تاريخ الطلب</th><th>موعد التسليم</th><th>الحالة</th><th>الأصناف والكميات والباركود</th><th>الملاحظات</th></tr></thead><tbody>${reportRowsHtml || '<tr><td colspan="9">لا توجد طلبات</td></tr>'}</tbody></table></body></html>`;
  }, [reportRows, hasSelection]);

  const downloadReport = (format: "word" | "excel") => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      Alert.alert("التنزيل متاح من الويب", "افتح نسخة الويب لتنزيل التقرير");
      return;
    }
    const blob = new Blob(["\ufeff", reportHtml], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `تقرير-طلبات-المناديب-${hasSelection ? "محدد" : "الجميع"}-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`;
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
    if (!reportRows.length) {
      Alert.alert("لا توجد بيانات", "لا توجد طلبات مطابقة للطباعة");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;
    printWindow.document.write(`${reportHtml.replace("</body>", '<script>window.onload=()=>window.print()</script></body>')}`);
    printWindow.document.close();
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.title}>طلبات المناديب</Text><Text style={styles.subtitle}>طلبات العملاء المحولة للمستودعات للإخراج والتنفيذ</Text></View><View style={styles.headerIcon}><MaterialIcons name="assignment" size={25} color="#fff" /><Text style={styles.headerCount}>{rows.length}</Text></View></View>
    <View style={styles.filterPanel}>
      <TextInput value={search} onChangeText={setSearch} placeholder="ابحث برقم الطلب أو العميل أو المندوب" placeholderTextColor="#94a3b8" textAlign="right" style={styles.searchInput} />
      <View style={styles.filterRow}>{([["all", "الكل"], ["pending", "بانتظار التنفيذ"], ["partial", "تنفيذ جزئي"], ["executed", "تم التنفيذ"]] as const).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setStatusFilter(key)} style={[styles.filterButton, statusFilter === key && styles.filterButtonActive]}><Text style={[styles.filterText, statusFilter === key && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={styles.selectionBar}><Text style={styles.selectionInfo}>{hasSelection ? `تم تحديد ${selectedRows.length} من ${filteredRows.length}` : `المعروض: ${filteredRows.length} طلب`}</Text><TouchableOpacity onPress={toggleAllVisible} style={styles.selectAllButton}><MaterialIcons name={filteredRows.length > 0 && filteredRows.every((row) => selectedIds[Number(row.id)]) ? "deselect" : "select-all"} size={17} color="#0369a1" /><Text style={styles.selectAllText}>{filteredRows.length > 0 && filteredRows.every((row) => selectedIds[Number(row.id)]) ? "إلغاء التحديد" : "تحديد المعروض"}</Text></TouchableOpacity></View>
    </View>
    <View style={styles.exportBar}><Text style={styles.printScope}>{hasSelection ? "طباعة المحدد" : "طباعة الجميع"}</Text><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("word")}><MaterialIcons name="description" size={17} color="#fff" /><Text style={styles.exportText}>Word</Text></TouchableOpacity><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("excel")}><MaterialIcons name="table-view" size={17} color="#fff" /><Text style={styles.exportText}>Excel</Text></TouchableOpacity><TouchableOpacity style={styles.pdfButton} onPress={printPdf}><MaterialIcons name="picture-as-pdf" size={17} color="#fff" /><Text style={styles.exportText}>PDF</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content}>{loading ? <Text style={styles.empty}>جارٍ تحميل الطلبات...</Text> : filteredRows.length === 0 ? <Text style={styles.empty}>لا توجد طلبات مطابقة للبحث والفلترة</Text> : filteredRows.map((row) => <View key={row.id} style={[styles.card, selectedIds[Number(row.id)] && styles.cardSelected]}><View style={styles.cardHead}><TouchableOpacity onPress={() => toggleSelected(Number(row.id))} style={styles.checkbox}><MaterialIcons name={selectedIds[Number(row.id)] ? "check-box" : "check-box-outline-blank"} size={23} color={selectedIds[Number(row.id)] ? "#0369a1" : "#94a3b8"} /></TouchableOpacity><Text style={styles.ref}>{row.referenceCode}</Text><Text style={styles.badge}>{LABELS[row.status] || row.status}</Text></View><Text style={styles.customer}>{row.customerName}</Text><Text style={styles.meta}>المندوب: {row.representativeName} · تاريخ الطلب: {row.orderDate || "-"} · موعد التسليم: {row.deliveryDate || "-"}</Text><View style={styles.items}>{(row.items || []).map((item: any, i: number) => <Text key={i} style={styles.item}>• {item.productName} — المقاس {item.size} — اللون {item.color} — {item.quantity} {item.quantityUnit === "dozen" ? "درزن" : "زوج"} — باركود {item.barcode || "-"}</Text>)}</View>{row.status !== "WAREHOUSE_EXECUTED" && <><TextInput value={notes[row.id] || ""} onChangeText={(value) => setNotes((current) => ({ ...current, [row.id]: value }))} placeholder="ملاحظات المستودع عند عدم التوفر أو التنفيذ الجزئي" multiline textAlign="right" style={styles.notes} /><View style={styles.actions}><TouchableOpacity style={styles.partial} onPress={() => void act(Number(row.id), "warehouse_partial")}><Text style={styles.actionText}>غير متاح / تنفيذ جزئي</Text></TouchableOpacity><TouchableOpacity style={styles.execute} onPress={() => void act(Number(row.id), "warehouse_execute")}><Text style={styles.actionText}>تم التنفيذ وخصم الرصيد</Text></TouchableOpacity></View></>}{row.status === "WAREHOUSE_EXECUTED" && <Text style={styles.done}>تم تنفيذ الطلب وخصم الرصيد — بانتظار إغلاق المندوب</Text>}<TouchableOpacity onPress={() => router.push({ pathname: "/representative-approvals", params: { id: String(row.id) } } as any)}><Text style={styles.detail}>عرض التفاصيل والسجل الزمني</Text></TouchableOpacity></View>)}</ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({ header: { backgroundColor: "#f59e0b", padding: 14, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, title: { color: "#fff", fontWeight: "900", fontSize: 19, textAlign: "right" }, subtitle: { color: "#fffbeb", fontSize: 11, marginTop: 2, textAlign: "right" }, headerIcon: { alignItems: "center", gap: 1 }, headerCount: { color: "#fff", fontSize: 11, fontWeight: "900" }, filterPanel: { backgroundColor: "#fff", padding: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 8 }, searchInput: { height: 40, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, color: "#0f172a", backgroundColor: "#f8fafc" }, filterRow: { flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" }, filterButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }, filterButtonActive: { backgroundColor: "#0369a1", borderColor: "#0369a1" }, filterText: { color: "#475569", fontSize: 11, fontWeight: "700" }, filterTextActive: { color: "#fff" }, selectionBar: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" }, selectionInfo: { color: "#64748b", fontSize: 11, fontWeight: "700" }, selectAllButton: { flexDirection: "row-reverse", alignItems: "center", gap: 4 }, selectAllText: { color: "#0369a1", fontSize: 11, fontWeight: "800" }, exportBar: { flexDirection: "row-reverse", gap: 6, padding: 9, backgroundColor: "#fff7ed", borderBottomWidth: 1, borderBottomColor: "#fed7aa", alignItems: "center" }, printScope: { color: "#92400e", fontSize: 11, fontWeight: "900", marginLeft: 2 }, exportButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, backgroundColor: "#2563eb", paddingVertical: 8, borderRadius: 8 }, pdfButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, backgroundColor: "#b91c1c", paddingVertical: 8, borderRadius: 8 }, exportText: { color: "#fff", fontWeight: "800", fontSize: 11 }, content: { padding: 10, gap: 8 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 11, gap: 7 }, cardSelected: { borderColor: "#0369a1", borderWidth: 2 }, cardHead: { flexDirection: "row-reverse", justifyContent: "flex-start", alignItems: "center", gap: 8 }, checkbox: { marginLeft: "auto" }, ref: { color: "#0f172a", fontWeight: "900" }, badge: { backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: "800" }, customer: { fontSize: 16, fontWeight: "900", color: "#0f172a", textAlign: "right" }, meta: { color: "#64748b", fontSize: 11, textAlign: "right" }, items: { backgroundColor: "#f8fafc", padding: 8, gap: 3 }, item: { color: "#334155", fontSize: 11, textAlign: "right" }, notes: { minHeight: 50, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 8, color: "#0f172a" }, actions: { flexDirection: "row-reverse", gap: 7 }, execute: { flex: 1, backgroundColor: "#15803d", padding: 10, borderRadius: 8, alignItems: "center" }, partial: { flex: 1, backgroundColor: "#dc2626", padding: 10, borderRadius: 8, alignItems: "center" }, actionText: { color: "#fff", fontWeight: "800", fontSize: 11 }, done: { color: "#15803d", fontWeight: "800", textAlign: "right" }, detail: { color: "#0369a1", fontWeight: "800", textAlign: "right", paddingTop: 3, fontSize: 11 }, empty: { textAlign: "center", color: "#64748b", padding: 40 } });
