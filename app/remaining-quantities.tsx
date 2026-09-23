import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { productTrackingService } from "@/lib/services/api.service";

const numberValue = (value: unknown) => Number(value || 0) || 0;
const pairs = (row: any) => numberValue(row.shortageDozen) * 12 + numberValue(row.shortagePairs);
const formatDateTime = (value: unknown, isAr: boolean) => {
  if (!value) return isAr ? "غير مسجل" : "Not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(isAr ? "ar-SA" : "en-US", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Riyadh" });
};

export default function RemainingQuantitiesScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await productTrackingService.list();
      const remaining = (Array.isArray(result) ? result : []).filter((row: any) => pairs(row) > 0 && row.handoverStatus === "delivered");
      setRows(remaining);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalPairs = useMemo(() => rows.reduce((sum, row) => sum + pairs(row), 0), [rows]);
  const stageTotals = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(String(row.currentStage || (isAr ? "مرحلة غير محددة" : "Unspecified stage")), (map.get(String(row.currentStage || "")) || 0) + pairs(row)));
    return Array.from(map.entries());
  }, [rows, isAr]);

  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" } as Record<string, string>)[character] || character);
  const exportReport = (format: "word" | "excel") => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      Alert.alert(isAr ? "التصدير متاح من الويب" : "Web export", isAr ? "افتح نسخة الويب لتصدير التقرير" : "Open the web version to export the report");
      return;
    }
    const rowsHtml = rows.map((row, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.productName || "غير محدد")}</strong></td><td>${escapeHtml(row.productSize || "غير محدد")}</td><td>${escapeHtml(row.productColor || "غير محدد")}</td><td>${escapeHtml(row.currentStage || "غير محددة")}</td><td>${escapeHtml(row.receiverStage || "غير محددة")}</td><td>${numberValue(row.shortageDozen)}</td><td>${numberValue(row.shortagePairs)}</td><td>${pairs(row)}</td><td>${escapeHtml(row.deliveredBy || "غير محدد")}</td><td>${escapeHtml(row.expectedReceiver || "بانتظار الاستلام")}</td><td>${escapeHtml(formatDateTime(row.deliveredAt, true))}</td></tr>`).join("");
    const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير الكمية المتبقية</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#17202a}h1{color:#9a3412;font-size:20px}.meta{background:#fff7ed;border:1px solid #fdba74;padding:9px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #9fb5bd;padding:5px;text-align:right;vertical-align:top}th{background:#9a3412;color:#fff}tr:nth-child(even){background:#fffaf5}</style></head><body><h1>تقرير جرد الكمية المتبقية</h1><div class="meta"><strong>إجمالي السجلات:</strong> ${rows.length}؛ <strong>إجمالي الأزواج المتبقية:</strong> ${totalPairs}؛ <strong>تاريخ ووقت التصدير:</strong> ${escapeHtml(formatDateTime(new Date(), true))}</div><table><thead><tr><th>#</th><th>اسم المنتج</th><th>المقاس</th><th>اللون</th><th>المرحلة الحالية</th><th>المرحلة التالية</th><th>درزن متبقٍ</th><th>أزواج متبقية</th><th>الإجمالي بالأزواج</th><th>المسلّم</th><th>المستلم المتوقع</th><th>يوم وتاريخ ووقت التسليم</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="12">لا توجد كميات متبقية حالياً</td></tr>'}</tbody></table></body></html>`;
    const blob = new Blob(["\ufeff", html], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `تقرير-الكمية-المتبقية-${new Date().toISOString().slice(0, 10)}.${format === "word" ? "doc" : "xls"}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: "flex-end", marginRight: 10 }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>{isAr ? "الكمية المتبقية" : "Remaining Quantities"}</Text>
          <Text style={{ color: "#e0f2fe", fontSize: 11, marginTop: 3 }}>{isAr ? "جرد آلي للكميات التي بقيت في كل مرحلة" : "Automatic inventory of quantities left at each stage"}</Text>
        </View>
        <MaterialIcons name="inventory" size={27} color="#fff" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 35 }}>
        <View style={{ backgroundColor: "#fff7ed", borderColor: "#fdba74", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <Text style={{ color: "#9a3412", textAlign: "right", fontWeight: "900", fontSize: 14 }}>{isAr ? "جرد المتبقي الحالي" : "Current remaining inventory"}</Text>
          <Text style={{ color: "#c2410c", textAlign: "right", fontSize: 12, marginTop: 5 }}>{isAr ? `${rows.length} سجل · ${totalPairs} زوج متبقٍ` : `${rows.length} record(s) · ${totalPairs} pair(s) remaining`}</Text>
          {stageTotals.length > 0 && <Text style={{ color: "#9a3412", textAlign: "right", fontSize: 11, marginTop: 7 }}>{stageTotals.map(([stage, amount]) => `${stage}: ${amount} ${isAr ? "زوج" : "pairs"}`).join("  |  ")}</Text>}
        </View>
        <TouchableOpacity onPress={() => void load()} style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 12 }}>
          <MaterialIcons name="refresh" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "تحديث الجرد" : "Refresh inventory"}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => exportReport("word")} style={{ flex: 1, backgroundColor: "#2563eb", borderRadius: 10, paddingVertical: 11, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <MaterialIcons name="description" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{isAr ? "تصدير Word" : "Export Word"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => exportReport("excel")} style={{ flex: 1, backgroundColor: "#15803d", borderRadius: 10, paddingVertical: 11, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <MaterialIcons name="table-chart" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{isAr ? "تصدير Excel" : "Export Excel"}</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} /> : rows.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 24, alignItems: "center" }}>
            <MaterialIcons name="check-circle" size={42} color="#16a34a" />
            <Text style={{ color: colors.foreground, fontWeight: "800", marginTop: 9, textAlign: "center" }}>{isAr ? "لا توجد كميات متبقية حالياً" : "No remaining quantities"}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 5, textAlign: "center" }}>{isAr ? "تظهر هنا تلقائياً عند تسليم كمية أقل من الكمية المستلمة." : "Entries appear automatically when less than the received quantity is delivered."}</Text>
          </View>
        ) : rows.map((row) => (
          <View key={String(row.id)} style={{ backgroundColor: colors.surface, borderColor: "#fdba74", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ backgroundColor: "#ffedd5", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }}><Text style={{ color: "#9a3412", fontWeight: "900", fontSize: 11 }}>{pairs(row)} {isAr ? "زوج" : "pairs"}</Text></View>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 15, flex: 1, textAlign: "right", marginRight: 8 }}>{row.productName || (isAr ? "منتج غير محدد" : "Unspecified product")}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? `المقاس: ${row.productSize || "غير محدد"}` : `Size: ${row.productSize || "—"}`}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? `اللون: ${row.productColor || "غير محدد"}` : `Color: ${row.productColor || "—"}`}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? `المتبقي: ${row.shortageDozen || 0} درزن + ${row.shortagePairs || 0} زوج` : `Remaining: ${row.shortageDozen || 0} dozen + ${row.shortagePairs || 0} pairs`}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 10, paddingTop: 9 }}>
              <Text style={{ color: "#b45309", fontWeight: "800", textAlign: "right", fontSize: 12 }}>{isAr ? `المرحلة: ${row.currentStage || "غير محددة"} ← المرحلة التالية: ${row.receiverStage || "غير محددة"}` : `Stage: ${row.currentStage || "—"} → Next: ${row.receiverStage || "—"}`}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 5 }}>{isAr ? `المسلّم: ${row.deliveredBy || "غير محدد"} · المستلم: ${row.expectedReceiver || "بانتظار الاستلام"}` : `Delivered by: ${row.deliveredBy || "—"} · Receiver: ${row.expectedReceiver || "Awaiting receipt"}`}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{isAr ? `وقت التسليم: ${formatDateTime(row.deliveredAt, true)}` : `Delivery time: ${formatDateTime(row.deliveredAt, false)}`}</Text>
              {row.notes && <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{isAr ? `ملاحظات: ${row.notes}` : `Notes: ${row.notes}`}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
