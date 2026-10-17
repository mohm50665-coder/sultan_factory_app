import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { representativeService } from "@/lib/services/representative.service";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" } as Record<string, string>)[char] || char);

function statusLabel(language: "ar" | "en", status: string) {
  const labels: Record<string, string> = {
    PENDING_WAREHOUSE_ISSUE: localize(language, "بانتظار التنفيذ", "Pending fulfillment"),
    WAREHOUSE_PARTIAL: localize(language, "تنفيذ جزئي / رد مطلوب", "Partially fulfilled / response required"),
    WAREHOUSE_NOT_EXECUTED: localize(language, "لم يتم التنفيذ / رد مطلوب", "Not fulfilled / response required"),
    WAREHOUSE_EXECUTED: localize(language, "تم التنفيذ", "Fulfilled"),
    REPRESENTATIVE_CLOSED: localize(language, "أغلقه المندوب", "Closed by representative"),
  };
  return labels[status] || status;
}

export default function WarehouseRepresentativeOrders() {
  const colors = useColors();
  const router = useRouter();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const textAlign = textAlignFor(language);
  const direction = writingDirection(language);
  const rowDirection = english ? "row" : "row-reverse";
  const dateLocale = english ? "en-US" : "ar-SA";
  const l = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "partial" | "not_executed" | "executed">("all");
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  const [shortages, setShortages] = useState<Record<number, any[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await representativeService.scanOverdue().catch(() => null);
      const data: any = await representativeService.transactions.list({ transactionType: "order" });
      const visibleRows = (data || []).filter((row: any) => ["PENDING_WAREHOUSE_ISSUE", "WAREHOUSE_PARTIAL", "WAREHOUSE_NOT_EXECUTED", "WAREHOUSE_EXECUTED"].includes(row.status));
      setRows(visibleRows);
      setShortages((current) => {
        const next = { ...current };
        visibleRows.forEach((row: any) => {
          if (!next[Number(row.id)]) next[Number(row.id)] = (row.items || []).map((item: any) => {
            const requestedDozen = Number(item.quantityDozen || (item.quantityUnit === "dozen" ? item.quantity : 0) || 0);
            return { productName: item.productName || "", barcode: item.barcode || "", requestedDozen, issuedDozen: requestedDozen, shortageDozen: 0, notes: "" };
          });
        });
        return next;
      });
    } catch (e: any) {
      Alert.alert(l("تعذر تحميل الطلبات", "Unable to load orders"), e?.message || l("حدث خطأ", "An error occurred"));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const searchable = [row.referenceCode, row.customerName, row.representativeName].filter(Boolean).join(" ").toLocaleLowerCase();
      const matchesText = !needle || searchable.includes(needle);
      const matchesStatus = statusFilter === "all" || (statusFilter === "pending" && row.status === "PENDING_WAREHOUSE_ISSUE") || (statusFilter === "partial" && row.status === "WAREHOUSE_PARTIAL") || (statusFilter === "not_executed" && row.status === "WAREHOUSE_NOT_EXECUTED") || (statusFilter === "executed" && row.status === "WAREHOUSE_EXECUTED");
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

  const updateShortage = (id: number, index: number, field: "shortageDozen" | "notes", value: string) => {
    setShortages((current) => {
      const next = [...(current[id] || [])];
      const item = { ...(next[index] || {}) };
      if (field === "shortageDozen") {
        const shortageDozen = Math.max(0, Number(value.replace(/[^0-9.]/g, "") || 0));
        item.shortageDozen = shortageDozen;
        item.issuedDozen = Math.max(0, Number(item.requestedDozen || 0) - shortageDozen);
      } else {
        item.notes = value;
      }
      next[index] = item;
      return { ...current, [id]: next };
    });
  };

  const act = async (id: number, action: string) => {
    try {
      const warehouseShortages = action === "warehouse_partial" ? (shortages[id] || []).filter((item: any) => Number(item.shortageDozen) > 0) : [];
      await representativeService.transactions.transition({ id, action, notes: notes[id] || "", warehouseShortages });
      setNotes((current) => ({ ...current, [id]: "" }));
      setSelectedIds((current) => { const next = { ...current }; delete next[id]; return next; });
      await load();
      Alert.alert(
        l("تم الحفظ", "Saved"),
        action === "warehouse_execute"
          ? l("تم تنفيذ الطلب وخصم الكميات من مستودع الإنتاج التام", "The order was fulfilled and quantities were deducted from the finished-goods warehouse")
          : action === "warehouse_not_executed"
            ? l("تم تسجيل عدم تنفيذ الطلب وإرسال السبب للمندوب", "The unfulfilled order and its reason were sent to the representative")
            : l("تم تسجيل التنفيذ الجزئي وإرسال النواقص للمندوب", "Partial fulfillment and shortages were sent to the representative"),
      );
    } catch (e: any) {
      Alert.alert(l("تعذر تنفيذ الإجراء", "Unable to complete the action"), e?.message || l("حدث خطأ ولم يتم خصم أي كمية", "An error occurred and no quantities were deducted"));
    }
  };

  const reportHtml = useMemo(() => {
    const reportRowsHtml = reportRows.map((row, index) => {
      const itemRows = (row.items || []).map((item: any) => `<li>${escapeHtml(item.productName)} — ${l("المقاس", "Size")}: ${escapeHtml(item.size)} — ${l("اللون", "Color")}: ${escapeHtml(item.color)} — ${l("الكمية", "Quantity")}: ${escapeHtml(item.quantity)} ${item.quantityUnit === "dozen" ? l("درزن", "dozen") : l("زوج", "pair")} — ${l("الباركود", "Barcode")}: ${escapeHtml(item.barcode || "-")}</li>`).join("");
      return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.referenceCode || "-")}</strong></td><td>${escapeHtml(row.customerName || "-")}</td><td>${escapeHtml(row.representativeName || "-")}</td><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.deliveryDate || "-")}</td><td>${escapeHtml(statusLabel(language, row.status) || "-")}</td><td><ul>${itemRows || `<li>${l("لا توجد أصناف", "No items")}</li>`}</ul></td><td>${escapeHtml(row.rejectionReason || row.correctiveAction || "-")}</td></tr>`;
    }).join("");
    return `<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><title>${l("تقرير طلبات المناديب", "Representative orders report")}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#17202a;direction:${direction}}h1{color:#075985;font-size:20px}p{color:#475569;font-size:11px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #94a3b8;padding:5px;text-align:${textAlign};vertical-align:top}th{background:#075985;color:#fff}tr{page-break-inside:avoid}ul{margin:0;padding-${english ? "left" : "right"}:15px}</style></head><body><h1>${l("تقرير طلبات المناديب", "Representative orders report")}</h1><p>${l("تاريخ ووقت التقرير", "Report date and time")}: ${escapeHtml(new Date().toLocaleString(dateLocale))} — ${l("عدد الطلبات", "Orders")}: ${reportRows.length}${hasSelection ? ` — ${l("طلبات محددة", "selected orders")}` : ` — ${l("جميع الطلبات الظاهرة", "all visible orders")}`}</p><table><thead><tr><th>#</th><th>${l("رقم الطلب", "Order number")}</th><th>${l("العميل", "Customer")}</th><th>${l("المندوب", "Representative")}</th><th>${l("تاريخ الطلب", "Order date")}</th><th>${l("موعد التسليم", "Delivery date")}</th><th>${l("الحالة", "Status")}</th><th>${l("الأصناف والكميات والباركود", "Items, quantities, and barcodes")}</th><th>${l("الملاحظات", "Notes")}</th></tr></thead><tbody>${reportRowsHtml || `<tr><td colspan="9">${l("لا توجد طلبات", "No orders")}</td></tr>`}</tbody></table></body></html>`;
  }, [reportRows, hasSelection, language, direction, textAlign, english, dateLocale]);

  const downloadReport = (format: "word" | "excel") => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      Alert.alert(l("التنزيل متاح من الويب", "Download is available on the web"), l("افتح نسخة الويب لتنزيل التقرير", "Open the web version to download the report"));
      return;
    }
    const blob = new Blob(["\ufeff", reportHtml], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${l("تقرير-طلبات-المناديب", "representative-orders-report")}-${hasSelection ? l("محدد", "selected") : l("الجميع", "all")}-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert(l("PDF متاح من الويب", "PDF is available on the web"), l("افتح نسخة الويب ثم اختر طباعة وحفظ بصيغة PDF", "Open the web version, then choose Print and Save as PDF"));
      return;
    }
    if (!reportRows.length) {
      Alert.alert(l("لا توجد بيانات", "No data"), l("لا توجد طلبات مطابقة للطباعة", "There are no matching orders to print"));
      return;
    }
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;
    printWindow.document.write(`${reportHtml.replace("</body>", '<script>window.onload=()=>window.print()</script></body>')}`);
    printWindow.document.close();
  };

  const filterOptions = [
    ["all", l("الكل", "All")],
    ["pending", l("بانتظار التنفيذ", "Pending fulfillment")],
    ["partial", l("تنفيذ جزئي", "Partial fulfillment")],
    ["not_executed", l("لم يتم التنفيذ", "Not fulfilled")],
    ["executed", l("تم التنفيذ", "Fulfilled")],
  ] as const;
  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds[Number(row.id)]);

  return <ScreenContainer style={{ backgroundColor: colors.background, direction }}>
    <View style={[styles.header, { flexDirection: rowDirection }]}>
      <BackButton />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { textAlign }]}>{l("طلبات المناديب", "Representative orders")}</Text>
        <Text style={[styles.subtitle, { textAlign }]}>{l("طلبات العملاء المحولة للمستودعات للإخراج والتنفيذ", "Customer orders sent to warehouses for picking and fulfillment")}</Text>
      </View>
      <View style={styles.headerIcon}><MaterialIcons name="assignment" size={25} color="#fff" /><Text style={styles.headerCount}>{rows.length}</Text></View>
    </View>
    <View style={styles.filterPanel}>
      <TextInput value={search} onChangeText={setSearch} placeholder={l("ابحث برقم الطلب أو العميل أو المندوب", "Search by order number, customer, or representative")} placeholderTextColor="#94a3b8" textAlign={textAlign} style={[styles.searchInput, { writingDirection: direction }]} />
      <View style={[styles.filterRow, { flexDirection: rowDirection }]}>{filterOptions.map(([key, label]) => <TouchableOpacity key={key} onPress={() => setStatusFilter(key)} style={[styles.filterButton, statusFilter === key && styles.filterButtonActive]}><Text style={[styles.filterText, { textAlign }, statusFilter === key && styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}</View>
      <View style={[styles.selectionBar, { flexDirection: rowDirection }]}>
        <Text style={[styles.selectionInfo, { textAlign }]}>{hasSelection ? l(`تم تحديد ${selectedRows.length} من ${filteredRows.length}`, `${selectedRows.length} of ${filteredRows.length} selected`) : l(`المعروض: ${filteredRows.length} طلب`, `Showing: ${filteredRows.length} orders`)}</Text>
        <TouchableOpacity onPress={toggleAllVisible} style={[styles.selectAllButton, { flexDirection: rowDirection }]}><MaterialIcons name={allVisibleSelected ? "deselect" : "select-all"} size={17} color="#0369a1" /><Text style={[styles.selectAllText, { textAlign }]}>{allVisibleSelected ? l("إلغاء التحديد", "Clear selection") : l("تحديد المعروض", "Select visible")}</Text></TouchableOpacity>
      </View>
    </View>
    <View style={[styles.exportBar, { flexDirection: rowDirection }]}><Text style={[styles.printScope, { textAlign, marginLeft: english ? 0 : 2, marginRight: english ? 2 : 0 }]}>{hasSelection ? l("طباعة المحدد", "Print selected") : l("طباعة الجميع", "Print all")}</Text><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("word")}><MaterialIcons name="description" size={17} color="#fff" /><Text style={styles.exportText}>{l("Word", "Word")}</Text></TouchableOpacity><TouchableOpacity style={styles.exportButton} onPress={() => downloadReport("excel")}><MaterialIcons name="table-view" size={17} color="#fff" /><Text style={styles.exportText}>{l("Excel", "Excel")}</Text></TouchableOpacity><TouchableOpacity style={styles.pdfButton} onPress={printPdf}><MaterialIcons name="picture-as-pdf" size={17} color="#fff" /><Text style={styles.exportText}>{l("PDF", "PDF")}</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content}>{loading ? <Text style={[styles.empty, { textAlign }]}>{l("جارٍ تحميل الطلبات...", "Loading orders...")}</Text> : filteredRows.length === 0 ? <Text style={[styles.empty, { textAlign }]}>{l("لا توجد طلبات مطابقة للبحث والفلترة", "No orders match the search and filters")}</Text> : filteredRows.map((row) => <View key={row.id} style={[styles.card, selectedIds[Number(row.id)] && styles.cardSelected]}>
      <View style={[styles.cardHead, { flexDirection: rowDirection }]}><TouchableOpacity onPress={() => toggleSelected(Number(row.id))} style={[styles.checkbox, { marginLeft: english ? 0 : "auto", marginRight: english ? "auto" : 0 }]}><MaterialIcons name={selectedIds[Number(row.id)] ? "check-box" : "check-box-outline-blank"} size={23} color={selectedIds[Number(row.id)] ? "#0369a1" : "#94a3b8"} /></TouchableOpacity><Text style={[styles.ref, { textAlign }]}>{row.referenceCode}</Text><Text style={[styles.badge, { textAlign }]}>{statusLabel(language, row.status)}</Text></View>
      <Text style={[styles.customer, { textAlign }]}>{row.customerName}</Text>
      <Text style={[styles.meta, { textAlign }]}>{l("المندوب", "Representative")}: {row.representativeName} · {l("تاريخ الطلب", "Order date")}: {row.orderDate || "-"} · {l("موعد التسليم", "Delivery date")}: {row.deliveryDate || "-"}</Text>
      {row.warehouseDeadlineAt && <Text style={[styles.meta, { textAlign }, row.isOverdue && styles.overdueMeta]}>{l("مهلة إخراج المستودع", "Warehouse picking deadline")}: {new Date(row.warehouseDeadlineAt).toLocaleString(dateLocale)} · {row.isOverdue ? l(`متأخر — المسؤول: ${row.overdueResponsible || "المستودعات"}`, `Overdue — responsible: ${row.overdueResponsible || "Warehouse"}`) : l("ضمن مهلة 48 ساعة", "Within the 48-hour deadline")}</Text>}
      <View style={styles.items}>{(row.items || []).map((item: any, i: number) => <Text key={i} style={[styles.item, { textAlign }]}>• {item.productName} — {l("المقاس", "Size")} {item.size} — {l("اللون", "Color")} {item.color} — {item.quantity} {item.quantityUnit === "dozen" ? l("درزن", "dozen") : l("زوج", "pair")} — {l("باركود", "Barcode")} {item.barcode || "-"}</Text>)}</View>
      {row.status !== "WAREHOUSE_EXECUTED" && <><View style={styles.shortageBox}><Text style={[styles.shortageTitle, { textAlign }]}>{l("تفصيل النواقص — اختر التنفيذ الجزئي وحدد الناقص لكل صنف", "Shortage details — choose partial fulfillment and enter the shortage for each item")}</Text>{(shortages[Number(row.id)] || []).map((item: any, itemIndex: number) => <View key={`${row.id}-${itemIndex}`} style={styles.shortageRow}><Text style={[styles.shortageName, { textAlign }]}>{item.productName} · {l("المطلوب", "Requested")} {item.requestedDozen} {l("درزن", "dozen")}</Text><TextInput value={String(item.shortageDozen || 0)} onChangeText={(value) => updateShortage(Number(row.id), itemIndex, "shortageDozen", value)} keyboardType="numeric" placeholder={l("الناقص بالدرزن", "Shortage in dozens")} textAlign={textAlign} style={[styles.shortageInput, { writingDirection: direction }]} /><Text style={[styles.shortageIssued, { textAlign }]}>{l("المنفذ تلقائياً", "Automatically fulfilled")}: {item.issuedDozen || 0} {l("درزن", "dozen")}</Text></View>)}</View><TextInput value={notes[row.id] || ""} onChangeText={(value) => setNotes((current) => ({ ...current, [row.id]: value }))} placeholder={row.status === "PENDING_WAREHOUSE_ISSUE" ? l("اكتب سبب عدم التنفيذ أو النواقص قبل اختيار الحالة", "Enter the reason for non-fulfillment or shortages before selecting a status") : l("حدّث سبب عدم التنفيذ أو النواقص", "Update the reason for non-fulfillment or shortages")} multiline textAlign={textAlign} style={[styles.notes, { writingDirection: direction }]} /><View style={[styles.actions, { flexDirection: rowDirection }]}><TouchableOpacity style={styles.notExecuted} onPress={() => void act(Number(row.id), "warehouse_not_executed")}><Text style={styles.actionText}>{l("لم يتم التنفيذ", "Not fulfilled")}</Text></TouchableOpacity><TouchableOpacity style={styles.partial} onPress={() => void act(Number(row.id), "warehouse_partial")}><Text style={styles.actionText}>{l("تم التنفيذ الجزئي", "Partially fulfilled")}</Text></TouchableOpacity><TouchableOpacity style={styles.execute} onPress={() => void act(Number(row.id), "warehouse_execute")}><Text style={styles.actionText}>{l("تم التنفيذ وخصم الرصيد", "Fulfill and deduct inventory")}</Text></TouchableOpacity></View></>}
      {row.status === "WAREHOUSE_EXECUTED" && <Text style={[styles.done, { textAlign }]}>{l("تم تنفيذ الطلب وخصم الرصيد — بانتظار إغلاق المندوب", "Order fulfilled and inventory deducted — awaiting representative closure")}</Text>}
      {row.status === "WAREHOUSE_NOT_EXECUTED" && <Text style={[styles.notExecutedText, { textAlign }]}>{l("لم يتم التنفيذ", "Not fulfilled")} — {l("السبب", "Reason")}: {row.rejectionReason || "-"}</Text>}
      {row.status === "WAREHOUSE_PARTIAL" && <Text style={[styles.partialText, { textAlign }]}>{l("تم التنفيذ الجزئي", "Partially fulfilled")} — {l("النواقص/الملاحظات", "Shortages/notes")}: {row.rejectionReason || "-"}</Text>}
      <TouchableOpacity onPress={() => router.push({ pathname: "/representative-approvals", params: { id: String(row.id) } } as any)}><Text style={[styles.detail, { textAlign }]}>{l("عرض التفاصيل والسجل الزمني", "View details and timeline")}</Text></TouchableOpacity>
    </View>)}</ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#f59e0b", padding: 14, alignItems: "center", gap: 10 },
  title: { color: "#fff", fontWeight: "900", fontSize: 19 },
  subtitle: { color: "#fffbeb", fontSize: 11, marginTop: 2 },
  headerIcon: { alignItems: "center", gap: 1 },
  headerCount: { color: "#fff", fontSize: 11, fontWeight: "900" },
  filterPanel: { backgroundColor: "#fff", padding: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 8 },
  searchInput: { height: 40, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, color: "#0f172a", backgroundColor: "#f8fafc" },
  filterRow: { gap: 6, flexWrap: "wrap" },
  filterButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  filterButtonActive: { backgroundColor: "#0369a1", borderColor: "#0369a1" },
  filterText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  selectionBar: { justifyContent: "space-between", alignItems: "center" },
  selectionInfo: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  selectAllButton: { alignItems: "center", gap: 4 },
  selectAllText: { color: "#0369a1", fontSize: 11, fontWeight: "800" },
  exportBar: { gap: 6, padding: 9, backgroundColor: "#fff7ed", borderBottomWidth: 1, borderBottomColor: "#fed7aa", alignItems: "center" },
  printScope: { color: "#92400e", fontSize: 11, fontWeight: "900" },
  exportButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, backgroundColor: "#2563eb", paddingVertical: 8, borderRadius: 8 },
  pdfButton: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 3, backgroundColor: "#b91c1c", paddingVertical: 8, borderRadius: 8 },
  exportText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  content: { padding: 10, gap: 8 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 11, gap: 7 },
  shortageBox: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 8, padding: 8, gap: 6 },
  shortageTitle: { color: "#9a3412", fontSize: 11, fontWeight: "900" },
  shortageRow: { borderTopWidth: 1, borderTopColor: "#fed7aa", paddingTop: 5, gap: 3 },
  shortageName: { color: "#334155", fontSize: 11, fontWeight: "800" },
  shortageInput: { height: 32, borderWidth: 1, borderColor: "#fdba74", backgroundColor: "#fff", borderRadius: 6, paddingHorizontal: 8, color: "#0f172a" },
  shortageIssued: { color: "#166534", fontSize: 10 },
  cardSelected: { borderColor: "#0369a1", borderWidth: 2 },
  cardHead: { justifyContent: "flex-start", alignItems: "center", gap: 8 },
  checkbox: {},
  ref: { color: "#0f172a", fontWeight: "900" },
  badge: { backgroundColor: "#fef3c7", color: "#92400e", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: "800" },
  customer: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  meta: { color: "#64748b", fontSize: 11 },
  overdueMeta: { color: "#b91c1c", fontWeight: "900" },
  items: { backgroundColor: "#f8fafc", padding: 8, gap: 3 },
  item: { color: "#334155", fontSize: 11 },
  notes: { minHeight: 50, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 8, color: "#0f172a" },
  actions: { gap: 7 },
  execute: { flex: 1, backgroundColor: "#15803d", padding: 10, borderRadius: 8, alignItems: "center" },
  partial: { flex: 1, backgroundColor: "#d97706", padding: 10, borderRadius: 8, alignItems: "center" },
  notExecuted: { flex: 1, backgroundColor: "#b91c1c", padding: 10, borderRadius: 8, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  done: { color: "#15803d", fontWeight: "800" },
  notExecutedText: { color: "#b91c1c", fontWeight: "800" },
  partialText: { color: "#b45309", fontWeight: "800" },
  detail: { color: "#0369a1", fontWeight: "800", paddingTop: 3, fontSize: 11 },
  empty: { color: "#64748b", padding: 40 },
});
