import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import type { Language } from "@/lib/i18n";
import { finishedWarehouseService } from "@/lib/services/api.service";

type StockRow = {
  id: number;
  barcode: string;
  productName: string;
  productSize?: string;
  productColor?: string;
  quantityDozen: number;
  minimumDozen: number;
  lastMovementAt?: string | Date | null;
  isLow?: boolean;
  ageDays?: number | null;
  activityStatus?: "active" | "stagnant";
};

export default function FinishedWarehouseInventoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const direction = writingDirection(language);
  const textAlign = textAlignFor(language);
  const rowDirection = english ? "row" : "row-reverse";
  const copy = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [lowOnly, setLowOnly] = useState(false);
  const [stagnantOnly, setStagnantOnly] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "quantity" | "age">("name");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result: any = query.trim()
        ? await finishedWarehouseService.search(query.trim())
        : await finishedWarehouseService.summary();
      setRows((result?.items || result || []) as StockRow[]);
    } catch (error: any) {
      Alert.alert(
        localize(language, "تعذر تحميل المخزون", "Unable to load inventory"),
        localize(language, error?.message || "حدث خطأ", "An error occurred"),
      );
    } finally {
      setLoading(false);
    }
  }, [english, language, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const visibleRows = useMemo(
    () => rows.filter(
      (row) =>
        (!lowOnly || Number(row.quantityDozen) < Number(row.minimumDozen)) &&
        (!stagnantOnly || row.activityStatus === "stagnant"),
    ),
    [rows, lowOnly, stagnantOnly],
  );

  const sortedRows = useMemo(
    () => [...visibleRows].sort((a, b) => {
      if (sortKey === "quantity") return Number(b.quantityDozen) - Number(a.quantityDozen);
      if (sortKey === "age") return Number(b.ageDays || 0) - Number(a.ageDays || 0);
      return String(a.productName).localeCompare(String(b.productName), english ? "en" : "ar");
    }),
    [english, visibleRows, sortKey],
  );

  const total = sortedRows.reduce((sum, row) => sum + Number(row.quantityDozen || 0), 0);
  const lowCount = rows.filter((row) => Number(row.quantityDozen) < Number(row.minimumDozen || 50)).length;
  const stagnantCount = rows.filter((row) => row.activityStatus === "stagnant").length;
  const activePercent = rows.length ? Math.round(((rows.length - stagnantCount) / rows.length) * 100) : 0;
  const stagnantPercent = rows.length ? Math.round((stagnantCount / rows.length) * 100) : 0;

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { textAlign, writingDirection: direction }]}>
            {copy("التخزين والمستودعات — إنتاج تام", "Storage & Warehouses — Finished Goods")}
          </Text>
          <Text style={[styles.subtitle, { textAlign, writingDirection: direction }]}>
            {copy(
              "الرصيد المعتمد فقط؛ استلام عهدة التخزين لا يجعلها متاحة حتى اعتماد إدخال المخزون النهائي",
              "Only approved stock is shown. Receiving storage custody does not make it available until final inventory entry is approved.",
            )}
          </Text>
        </View>
        <BackButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.stats, { flexDirection: rowDirection }]}>
          <Stat label={copy("إجمالي الأصناف", "Total items")} value={String(rows.length)} color="#0a7ea4" language={language} />
          <Stat label={copy("إجمالي الرصيد (درزن)", "Total balance (dozens)")} value={String(total)} color="#16a34a" language={language} />
          <Stat label={copy("تحت حد 50 درزن", "Below 50 dozen")} value={String(lowCount)} color="#dc2626" language={language} />
          <Stat label={copy("نشاط المنتجات", "Product activity")} value={`${activePercent}%`} color="#16a34a" language={language} />
          <Stat label={copy("ركود المنتجات", "Stagnant products")} value={`${stagnantPercent}%`} color="#d97706" language={language} />
        </View>

        <View style={[styles.toolbar, { flexDirection: rowDirection }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={copy("اكتب اسم المنتج أو المقاس أو اللون للبحث فقط", "Search by product name, size, or color only")}
            placeholderTextColor="#94a3b8"
            style={[styles.search, { textAlign, writingDirection: direction }]}
          />
          <TouchableOpacity onPress={() => router.push("/product-manufacturing-request")} style={[styles.requestButton, { flexDirection: rowDirection }]}>
            <MaterialIcons name="add-task" size={18} color="white" />
            <Text style={[styles.buttonText, { writingDirection: direction }]}>
              {copy("طلب تصنيع منتج", "Request product manufacturing")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.filters, { flexDirection: rowDirection }]}>
          <Filter label={copy("الأصناف تحت الحد", "Items below minimum")} active={lowOnly} onPress={() => setLowOnly(!lowOnly)} language={language} />
          <Filter label={copy("الأصناف الراكدة", "Stagnant items")} active={stagnantOnly} onPress={() => setStagnantOnly(!stagnantOnly)} language={language} />
        </View>
        <View style={[styles.filters, { flexDirection: rowDirection }]}>
          <Filter label={copy("ترتيب الاسم", "Sort by name")} active={sortKey === "name"} onPress={() => setSortKey("name")} language={language} />
          <Filter label={copy("الأعلى رصيداً", "Highest balance")} active={sortKey === "quantity"} onPress={() => setSortKey("quantity")} language={language} />
          <Filter label={copy("الأقدم حركة", "Oldest movement")} active={sortKey === "age"} onPress={() => setSortKey("age")} language={language} />
        </View>

        <View style={[styles.exportBar, { flexDirection: rowDirection }]}>
          <TouchableOpacity onPress={() => exportReport("word", sortedRows, language)} style={[styles.exportWord, { flexDirection: rowDirection }]}>
            <MaterialIcons name="description" size={17} color="white" />
            <Text style={[styles.buttonText, { writingDirection: direction }]}>Word</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => exportReport("excel", sortedRows, language)} style={[styles.exportExcel, { flexDirection: rowDirection }]}>
            <MaterialIcons name="grid-on" size={17} color="white" />
            <Text style={[styles.buttonText, { writingDirection: direction }]}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => printReport(sortedRows, language)} style={[styles.exportPrint, { flexDirection: rowDirection }]}>
            <MaterialIcons name="print" size={17} color="white" />
            <Text style={[styles.buttonText, { writingDirection: direction }]}>{copy("طباعة", "Print")}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.note, { flexDirection: rowDirection }]}>
          <MaterialIcons name="info-outline" size={18} color="#92400e" />
          <Text style={[styles.noteText, { textAlign, writingDirection: direction }]}>
            {copy(
              "الحد الأدنى الافتراضي لكل صنف هو 50 درزناً. عند انخفاض الرصيد يظهر تنبيه لمسؤول المستودعات والأدمن، ولا يسمح النظام بإخراج كمية أكبر من الرصيد الفعلي.",
              "The default minimum for each item is 50 dozen. When stock falls below this level, the warehouse manager and admin are alerted, and the system does not allow issuing more than the actual balance.",
            )}
          </Text>
        </View>

        {loading ? (
          <Text style={styles.empty}>{copy("جارٍ تحميل الرصيد...", "Loading inventory...")}</Text>
        ) : sortedRows.length === 0 ? (
          <Text style={styles.empty}>
            {query ? copy("لا توجد نتيجة مطابقة للبحث", "No matching search result") : copy("لا توجد أصناف في العرض الحالي", "No items in the current view")}
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={[styles.tableHeader, { flexDirection: rowDirection }]}>
              <Text style={[styles.cell, styles.headerCell, { flex: 2, textAlign, writingDirection: direction }]}>{copy("اسم المنتج", "Product name")}</Text>
              <Text style={[styles.cell, styles.headerCell, { textAlign, writingDirection: direction }]}>{copy("الباركود", "Barcode")}</Text>
              <Text style={[styles.cell, styles.headerCell, { textAlign, writingDirection: direction }]}>{copy("المقاس", "Size")}</Text>
              <Text style={[styles.cell, styles.headerCell, { textAlign, writingDirection: direction }]}>{copy("اللون", "Color")}</Text>
              <Text style={[styles.cell, styles.headerCell, { textAlign, writingDirection: direction }]}>{copy("الرصيد (درزن)", "Balance (dozens)")}</Text>
              <Text style={[styles.cell, styles.headerCell, { textAlign, writingDirection: direction }]}>{copy("الحالة", "Status")}</Text>
            </View>
            {sortedRows.map((row) => (
              <View key={row.id} style={[styles.tableRow, { flexDirection: rowDirection }, Number(row.quantityDozen) < Number(row.minimumDozen || 50) && styles.lowRow]}>
                <Text style={[styles.cell, { flex: 2, fontWeight: "700", textAlign, writingDirection: direction }]}>{row.productName}</Text>
                <Text style={[styles.cell, { fontFamily: "monospace", fontSize: 10, textAlign, writingDirection: direction }]}>{row.barcode || "-"}</Text>
                <Text style={[styles.cell, { textAlign, writingDirection: direction }]}>{row.productSize || "-"}</Text>
                <Text style={[styles.cell, { textAlign, writingDirection: direction }]}>{row.productColor || "-"}</Text>
                <Text style={[styles.cell, { color: Number(row.quantityDozen) < Number(row.minimumDozen || 50) ? "#dc2626" : "#166534", fontWeight: "800", textAlign, writingDirection: direction }]}>
                  {Number(row.quantityDozen).toLocaleString(english ? "en-US" : "ar-SA")}
                </Text>
                <Text style={[styles.cell, { color: row.activityStatus === "stagnant" ? "#b45309" : "#166534", textAlign, writingDirection: direction }]}>
                  {row.activityStatus === "stagnant" ? copy("راكد", "Stagnant") : copy("نشط", "Active")}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function exportReport(format: "word" | "excel", rows: StockRow[], language: Language) {
  const english = isEnglish(language);
  const copy = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  if (Platform.OS !== "web" || typeof document === "undefined") {
    Alert.alert(copy("التصدير متاح من الويب", "Export is available on the web"), copy("افتح النظام من نسخة الويب للتصدير", "Open the web version of the system to export."));
    return;
  }

  const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" } as Record<string, string>)[character] || character);
  const status = (row: StockRow) => row.activityStatus === "stagnant" ? copy("راكد", "Stagnant") : copy("نشط", "Active");
  const body = rows.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.productName)}</td><td>${esc(row.barcode || "-")}</td><td>${esc(row.productSize || "-")}</td><td>${esc(row.productColor || "-")}</td><td>${row.quantityDozen}</td><td>${row.minimumDozen || 50}</td><td>${status(row)}</td><td>${row.ageDays ?? "-"}</td></tr>`).join("");
  const html = `<!doctype html><html dir="${writingDirection(language)}"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial;color:#17202a;direction:${writingDirection(language)}}h1{color:#166534;text-align:${textAlignFor(language)}}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #9fb5bd;padding:6px;text-align:${textAlignFor(language)}}th{background:#166534;color:#fff}tr:nth-child(even){background:#f3f8f4}</style></head><body><h1>${copy("تقرير مستودع الإنتاج التام", "Finished Goods Warehouse Report")}</h1><p>${copy("تاريخ التصدير", "Export date")}: ${new Date().toLocaleString(english ? "en-US" : "ar-SA")}</p><table><thead><tr><th>#</th><th>${copy("اسم المنتج", "Product name")}</th><th>${copy("الباركود", "Barcode")}</th><th>${copy("المقاس", "Size")}</th><th>${copy("اللون", "Color")}</th><th>${copy("الرصيد بالدرزن", "Balance in dozens")}</th><th>${copy("الحد الأدنى", "Minimum")}</th><th>${copy("الحالة", "Status")}</th><th>${copy("أيام منذ آخر حركة", "Days since last movement")}</th></tr></thead><tbody>${body || `<tr><td colspan="9">${copy("لا توجد بيانات", "No data")}</td></tr>`}</tbody></table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${copy("تقرير-مستودع-الإنتاج", "finished-goods-warehouse-report")}-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function printReport(rows: StockRow[], language: Language) {
  const english = isEnglish(language);
  const copy = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  if (Platform.OS !== "web" || typeof window === "undefined") {
    Alert.alert(copy("الطباعة متاحة من الويب", "Printing is available on the web"), copy("افتح النظام من نسخة الويب للطباعة", "Open the web version of the system to print."));
    return;
  }

  const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" } as Record<string, string>)[character] || character);
  const status = (row: StockRow) => row.activityStatus === "stagnant" ? copy("راكد", "Stagnant") : copy("نشط", "Active");
  const body = rows.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.productName)}</td><td>${esc(row.barcode || "-")}</td><td>${esc(row.productSize || "-")}</td><td>${esc(row.productColor || "-")}</td><td>${row.quantityDozen}</td><td>${row.minimumDozen || 50}</td><td>${status(row)}</td><td>${row.ageDays ?? "-"}</td></tr>`).join("");
  const win = window.open("", "_blank", "width=1200,height=800");
  if (!win) return;
  win.document.write(`<!doctype html><html dir="${writingDirection(language)}"><head><meta charset="utf-8"><title>${copy("تقرير مستودع الإنتاج التام", "Finished Goods Warehouse Report")}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial;color:#17202a;direction:${writingDirection(language)}}h1{text-align:${textAlignFor(language)};color:#166534}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #9fb5bd;padding:6px;text-align:${textAlignFor(language)}}th{background:#166534;color:#fff}tr:nth-child(even){background:#f3f8f4}@media print{button{display:none}}</style></head><body><h1>${copy("تقرير مستودع الإنتاج التام", "Finished Goods Warehouse Report")}</h1><p>${copy("تاريخ ووقت الطباعة", "Print date and time")}: ${new Date().toLocaleString(english ? "en-US" : "ar-SA")}</p><table><thead><tr><th>#</th><th>${copy("اسم المنتج", "Product name")}</th><th>${copy("الباركود", "Barcode")}</th><th>${copy("المقاس", "Size")}</th><th>${copy("اللون", "Color")}</th><th>${copy("الرصيد بالدرزن", "Balance in dozens")}</th><th>${copy("الحد الأدنى", "Minimum")}</th><th>${copy("الحالة", "Status")}</th><th>${copy("أيام منذ آخر حركة", "Days since last movement")}</th></tr></thead><tbody>${body || `<tr><td colspan="9">${copy("لا توجد بيانات", "No data")}</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}

function Stat({ label, value, color, language }: { label: string; value: string; color: string; language: Language }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color, writingDirection: writingDirection(language) }]}>{value}</Text>
      <Text style={[styles.statLabel, { writingDirection: writingDirection(language) }]}>{label}</Text>
    </View>
  );
}

function Filter({ label, active, onPress, language }: { label: string; active: boolean; onPress: () => void; language: Language }) {
  const rowDirection = isEnglish(language) ? "row" : "row-reverse";
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filter, { flexDirection: rowDirection }, active && styles.filterActive]}>
      <MaterialIcons name={active ? "check-box" : "check-box-outline-blank"} size={18} color={active ? "white" : "#475569"} />
      <Text style={[styles.filterText, { writingDirection: writingDirection(language) }, active && { color: "white" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#166534", padding: 18, alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1 },
  title: { color: "white", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#dcfce7", fontSize: 12, marginTop: 4 },
  content: { padding: 16, gap: 12 },
  stats: { flexWrap: "wrap", gap: 10 },
  stat: { flex: 1, minWidth: 150, backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" },
  toolbar: { alignItems: "center", gap: 10 },
  search: { flex: 1, minHeight: 44, backgroundColor: "white", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, color: "#0f172a" },
  requestButton: { backgroundColor: "#2563eb", borderRadius: 10, paddingHorizontal: 14, minHeight: 44, alignItems: "center", gap: 6 },
  buttonText: { color: "white", fontWeight: "700" },
  filters: { gap: 8, flexWrap: "wrap" },
  exportBar: { gap: 8 },
  exportWord: { backgroundColor: "#2563eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 5 },
  exportExcel: { backgroundColor: "#15803d", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 5 },
  exportPrint: { backgroundColor: "#475569", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 5 },
  filter: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 5 },
  filterActive: { backgroundColor: "#475569", borderColor: "#475569" },
  filterText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  note: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, alignItems: "flex-start" },
  noteText: { flex: 1, color: "#92400e", fontSize: 12, lineHeight: 20 },
  table: { backgroundColor: "white", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, overflow: "hidden", minWidth: 760 },
  tableHeader: { backgroundColor: "#e2e8f0", borderBottomWidth: 1, borderColor: "#94a3b8" },
  tableRow: { borderBottomWidth: 1, borderColor: "#e2e8f0", minHeight: 48, alignItems: "center" },
  lowRow: { backgroundColor: "#fff7ed" },
  cell: { flex: 1, paddingHorizontal: 8, color: "#1e293b", fontSize: 12 },
  headerCell: { fontWeight: "800", color: "#0f172a", paddingVertical: 10 },
  empty: { textAlign: "center", color: "#64748b", padding: 40 },
});
