import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { employeePerformanceService } from "@/lib/services/api.service";
import { collectionService, maintenanceEntriesService } from "@/lib/services/data.service";

const SALES_DEPARTMENTS = new Set(["sales", "marketing", "sales_manager", "المبيعات", "التسويق"]);
const ownerOf = (row: any) => String(row.userId ?? row.createdBy ?? row.salesRepName ?? row.collectorName ?? row.sellerName ?? row.workerName ?? "");
const matchesOwner = (row: any, employee: any) => ownerOf(row) === String(employee.id) || ownerOf(row).toLowerCase() === String(employee.name || employee.username || "").toLowerCase();

export default function RepresentativePerformanceScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [employees, setEmployees] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canView = user?.role === "admin" || SALES_DEPARTMENTS.has(String(user?.department || "").trim().toLowerCase());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, reportRows, ordersVisits, customManufacturing, collections] = await Promise.all([
        employeePerformanceService.listEmployees(),
        employeePerformanceService.list(),
        maintenanceEntriesService.getBySection("orders_visits"),
        maintenanceEntriesService.getBySection("custom_manufacturing"),
        collectionService.getAll(),
      ]);
      setEmployees((Array.isArray(employeeRows) ? employeeRows : []).filter((employee: any) => SALES_DEPARTMENTS.has(String(employee.department || "").trim().toLowerCase())));
      setReports(Array.isArray(reportRows) ? reportRows : []);
      const flatten = (rows: any[]) => rows.map((row: any) => ({ ...row, ...(row.data || {}) }));
      setActivities([...flatten(Array.isArray(ordersVisits) ? ordersVisits : []), ...flatten(Array.isArray(customManufacturing) ? customManufacturing : []), ...flatten(Array.isArray(collections) ? collections : [])]);
    } catch (cause: any) {
      setError(cause?.message || (isAr ? "تعذر تحميل أداء المندوبين" : "Unable to load representative performance"));
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => employees.map((employee) => {
    const sourceRows = activities.filter((row) => matchesOwner(row, employee));
    const reportRows = reports.filter((report) => Number(report.data?.employeeId) === Number(employee.id));
    const visits = sourceRows.filter((row) => row.customerStatus === "visit" || row.visitReport).length;
    const orders = sourceRows.filter((row) => row.customerStatus === "order" || row.orderItems || row.orderNumber).length;
    const custom = sourceRows.filter((row) => row.clientCommercialName || (row.productName && row.requestType)).length;
    const collections = sourceRows.filter((row) => row.receiptNumber || row.receiptDate || row.collectorName).length;
    const achievement = reportRows.reduce((max, report) => Math.max(max, Number(report.data?.achievementPercentage || 0)), 0);
    return { employee, visits, orders, custom, collections, achievement, reportCount: reportRows.length };
  }), [activities, employees, reports]);

  if (!canView) return <ScreenContainer><View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}><MaterialIcons name="lock" size={42} color={colors.muted} /><Text style={{ color: colors.foreground, fontWeight: "800", marginTop: 12, textAlign: "center" }}>{isAr ? "هذه الأيقونة مخصصة لإدارة التسويق والمبيعات" : "This feature is restricted to Marketing and Sales"}</Text></View></ScreenContainer>;

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={{ backgroundColor: colors.primary, padding: 14, flexDirection: "row", alignItems: "center" }}><BackButton /><Text style={{ color: "#fff", flex: 1, textAlign: "right", fontSize: 18, fontWeight: "900" }}>{isAr ? "أداء المندوب" : "Representative Performance"}</Text><TouchableOpacity onPress={() => void load()}><MaterialIcons name="refresh" size={23} color="#fff" /></TouchableOpacity></View><ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>{loading ? <ActivityIndicator color={colors.primary} size="large" /> : error ? <Text style={{ color: colors.error, textAlign: "right" }}>{error}</Text> : rows.length === 0 ? <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>{isAr ? "لا يوجد مندوبون مسجلون في التسويق والمبيعات" : "No representatives registered in Marketing and Sales"}</Text> : rows.map((row) => <View key={row.employee.id} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}><View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "900", textAlign: "right" }}>{row.employee.name || row.employee.username}</Text><Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 3 }}>{row.employee.department || "—"} · {row.employee.position || "—"}</Text></View><View style={{ backgroundColor: row.achievement >= 80 ? "#dcfce7" : "#fef3c7", borderRadius: 10, padding: 8, alignItems: "center" }}><Text style={{ color: row.achievement >= 80 ? "#15803d" : "#b45309", fontWeight: "900" }}>{row.achievement.toFixed(0)}%</Text><Text style={{ color: colors.muted, fontSize: 9 }}>{isAr ? "الإنجاز" : "Achievement"}</Text></View></View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>{[[isAr ? "الطلبات" : "Orders", row.orders], [isAr ? "الزيارات" : "Visits", row.visits], [isAr ? "التصنيع الخاص" : "Custom", row.custom], [isAr ? "التحصيل" : "Collections", row.collections]].map(([label, value]) => <View key={String(label)} style={{ flex: 1, minWidth: "22%", backgroundColor: colors.background, borderRadius: 9, borderWidth: 1, borderColor: colors.border, padding: 9, alignItems: "center" }}><Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text><Text style={{ color: colors.foreground, fontWeight: "900", marginTop: 3 }}>{String(value)}</Text></View>)}</View><Text style={{ color: colors.muted, textAlign: "right", fontSize: 10, marginTop: 10 }}>{isAr ? `تقارير التقييم المحفوظة: ${row.reportCount}` : `Saved evaluations: ${row.reportCount}`}</Text></View>)}</ScrollView></ScreenContainer>;
}
