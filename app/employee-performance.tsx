import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { adminService, taskService } from "@/lib/services/api.service";

const PERIODS = [
  { key: "daily", ar: "يومي", en: "Daily" },
  { key: "weekly", ar: "أسبوعي", en: "Weekly" },
  { key: "monthly", ar: "شهري", en: "Monthly" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

type User = any;
type Task = any;

const dateKey = (value: unknown) => {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || "";
};
const displayDate = (value: unknown, isAr: boolean) => value ? new Date(String(value)).toLocaleDateString(isAr ? "ar-SA" : "en-GB") : (isAr ? "غير مسجل" : "Not recorded");
const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const inPeriod = (task: Task, period: PeriodKey, today = new Date()) => {
  const raw = task.createdDate || task.startDate || task.endDate;
  const key = dateKey(raw);
  if (!key) return true;
  const date = new Date(`${key}T12:00:00`);
  const diff = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (period === "daily") return diff === 0;
  if (period === "weekly") return diff >= 0 && diff < 7;
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
};

export default function EmployeePerformanceScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [period, setPeriod] = useState<PeriodKey>("daily");
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [userRows, taskRows] = await Promise.all([adminService.getAllUsers(), taskService.getAll()]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setTasks(Array.isArray(taskRows) ? taskRows : []);
    } catch (e: any) { setError(e?.message || (isAr ? "تعذر تحميل بيانات الأداء" : "Unable to load performance data")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const employees = useMemo(() => {
    const filteredUsers = users.filter((u) => {
      const hay = `${u.name || ""} ${u.username || ""} ${u.phone || u.mobile || ""} ${u.department || ""} ${u.position || u.jobTitle || ""}`;
      return normalize(hay).includes(normalize(search));
    });
    return filteredUsers.filter((u) => selectedUserId === null || Number(u.id) === selectedUserId).map((user) => {
      const names = [user.name, user.username, user.id].filter(Boolean).map(normalize);
      const rows = tasks.filter((task) => names.includes(normalize(task.assignedEmployee)) && inPeriod(task, period));
      const completed = rows.filter((t) => t.result === "completed").length;
      const partial = rows.filter((t) => t.result === "partial").length;
      const pending = rows.filter((t) => t.result === "pending").length;
      const failed = rows.filter((t) => ["not_completed", "rejected"].includes(t.result)).length;
      const target = rows.length;
      const actual = rows.reduce((sum, t) => sum + Number(t.completionPercentage ?? (t.result === "completed" ? 100 : t.result === "partial" ? 50 : 0)), 0);
      const achievement = target ? Math.round(actual / target) : 0;
      const hours = rows.reduce((sum, t) => sum + Number(t.actualHours ?? t.hoursWorked ?? t.workHours ?? 0), 0);
      const rewards = rows.reduce((sum, t) => sum + Number(t.reward || 0), 0);
      const deductions = rows.reduce((sum, t) => sum + Number(t.deduction || 0), 0);
      const reasons = rows.map((t) => t.resultReason || t.warningText).filter(Boolean);
      return { user, rows, completed, partial, pending, failed, target, achievement, hours, rewards, deductions, reasons };
    });
  }, [users, tasks, period, search, selectedUserId]);

  const totalTasks = employees.reduce((sum, e) => sum + e.target, 0);
  const totalCompleted = employees.reduce((sum, e) => sum + e.completed, 0);
  const totalRewards = employees.reduce((sum, e) => sum + e.rewards, 0);
  const totalDeductions = employees.reduce((sum, e) => sum + e.deductions, 0);

  const printReport = () => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank", "width=1400,height=900");
    if (!win) return;
    const title = isAr ? "تقرير أداء الموظفين" : "Employee Performance Report";
    const rows = employees.map((item) => { const u = item.user; return `<tr><td>${u.name || u.username || "—"}</td><td>${u.username || "—"}</td><td>${u.phone || u.mobile || "—"}</td><td>${u.email || "—"}</td><td>${u.department || "—"}</td><td>${u.position || u.jobTitle || "—"}</td><td>${item.target}</td><td>${item.completed}</td><td>${item.achievement}%</td><td>${item.hours || "غير مسجل"}</td><td>${item.rewards}</td><td>${item.deductions}</td><td>${item.reasons.join(" | ") || "—"}</td></tr>`; }).join("");
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial;padding:18px;color:#17202a}h1{text-align:center;color:#0a7ea4}p{text-align:center;color:#64748b}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #b8c7cc;padding:6px;text-align:right;vertical-align:top}th{background:#0a7ea4;color:#fff}tr:nth-child(even){background:#f2f8fa}</style></head><body><h1>${title}</h1><p>${isAr ? "الفترة" : "Period"}: ${PERIODS.find((p) => p.key === period)?.[isAr ? "ar" : "en"]}</p><table><thead><tr><th>الموظف</th><th>اسم المستخدم</th><th>الجوال</th><th>البريد</th><th>القسم</th><th>الوظيفة</th><th>الهدف</th><th>النتيجة الفعلية</th><th>نسبة الإنجاز</th><th>ساعات العمل</th><th>الحوافز</th><th>الجزاء</th><th>أسباب عدم الإنجاز</th></tr></thead><tbody>${rows || `<tr><td colspan="13">${isAr ? "لا توجد بيانات" : "No data"}</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={[styles.header, { backgroundColor: colors.primary }]}><BackButton /><Text style={styles.headerTitle}>{isAr ? "تقييم أداء الموظفين" : "Employee Performance"}</Text><TouchableOpacity onPress={load} style={styles.iconButton}><MaterialIcons name="refresh" size={22} color="#fff" /></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{isAr ? "فترة التقرير" : "Report period"}</Text>
        <View style={styles.periodRow}>{PERIODS.map((item) => <TouchableOpacity key={item.key} onPress={() => setPeriod(item.key)} style={[styles.periodButton, { backgroundColor: period === item.key ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: period === item.key ? "#fff" : colors.foreground, fontWeight: "700" }}>{isAr ? item.ar : item.en}</Text></TouchableOpacity>)}</View>
        <TextInput value={search} onChangeText={setSearch} placeholder={isAr ? "بحث بالاسم أو اسم المستخدم أو القسم" : "Search by name, username or department"} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} /><TouchableOpacity onPress={printReport} style={[styles.printButton, { backgroundColor: colors.primary }]}><MaterialIcons name="print" size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "طباعة تقرير الأداء" : "Print performance report"}</Text></TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: isAr ? "row-reverse" : "row" }}><TouchableOpacity onPress={() => setSelectedUserId(null)} style={[styles.chip, { backgroundColor: selectedUserId === null ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: selectedUserId === null ? "#fff" : colors.foreground }}>{isAr ? "كل الموظفين" : "All employees"}</Text></TouchableOpacity>{users.map((u) => <TouchableOpacity key={u.id} onPress={() => setSelectedUserId(Number(u.id))} style={[styles.chip, { backgroundColor: selectedUserId === Number(u.id) ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: selectedUserId === Number(u.id) ? "#fff" : colors.foreground }}>{u.name || u.username}</Text></TouchableOpacity>)}</ScrollView>
      </View>
      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} /> : error ? <Text style={{ color: colors.error, textAlign: "right", padding: 16 }}>{error}</Text> : <>
        <View style={styles.summaryGrid}>{[[isAr ? "الموظفون" : "Employees", employees.length], [isAr ? "المهام المستهدفة" : "Target tasks", totalTasks], [isAr ? "النتائج المنجزة" : "Completed results", totalCompleted], [isAr ? "الحوافز" : "Rewards", `${totalRewards} ${isAr ? "ر.س" : "SAR"}`], [isAr ? "الجزاءات" : "Deductions", `${totalDeductions} ${isAr ? "ر.س" : "SAR"}`]].map(([label, value]) => <View key={String(label)} style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "800", marginTop: 5 }}>{value}</Text></View>)}</View>
        {employees.map((item) => { const u = item.user; const position = u.position || u.jobTitle || (isAr ? "غير محدد" : "Not specified"); const phone = u.phone || u.mobile || (isAr ? "غير مسجل" : "Not recorded"); return <View key={u.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}><View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground }]}>{u.name || u.username || (isAr ? "موظف غير مسمى" : "Unnamed employee")}</Text><Text style={[styles.meta, { color: colors.muted }]}>{isAr ? "اسم المستخدم: " : "Username: "}{u.username || "—"}</Text><Text style={[styles.meta, { color: colors.muted }]}>{isAr ? "الجوال: " : "Phone: "}{phone} · {isAr ? "البريد: " : "Email: "}{u.email || "—"}</Text><Text style={[styles.meta, { color: colors.muted }]}>{isAr ? "القسم: " : "Department: "}{u.department || "—"} · {isAr ? "الوظيفة: " : "Position: "}{position}</Text><Text style={[styles.meta, { color: colors.muted }]}>{isAr ? "تاريخ التسجيل: " : "Registered: "}{displayDate(u.createdAt, isAr)}</Text></View><View style={[styles.rateBadge, { backgroundColor: item.achievement >= 80 ? "#dcfce7" : item.achievement >= 50 ? "#fef3c7" : "#fee2e2" }]}><Text style={{ fontSize: 18, fontWeight: "800", color: item.achievement >= 80 ? "#15803d" : item.achievement >= 50 ? "#b45309" : "#b91c1c" }}>{item.achievement}%</Text><Text style={{ fontSize: 10, color: colors.muted }}>{isAr ? "الإنجاز" : "Achievement"}</Text></View></View>
          <View style={styles.dataGrid}>{[[isAr ? "الهدف المطلوب" : "Target", item.target], [isAr ? "النتائج الفعلية" : "Actual results", item.completed], [isAr ? "جزئي" : "Partial", item.partial], [isAr ? "لم ينجز" : "Not done", item.failed], [isAr ? "ساعات العمل" : "Work hours", item.hours || (isAr ? "غير مسجل" : "Not recorded")], [isAr ? "الحوافز" : "Rewards", `${item.rewards} ${isAr ? "ر.س" : "SAR"}`], [isAr ? "الجزاء" : "Deductions", `${item.deductions} ${isAr ? "ر.س" : "SAR"}`]].map(([label, value]) => <View key={String(label)} style={[styles.dataCell, { borderColor: colors.border }]}><Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text><Text style={{ color: colors.foreground, fontWeight: "800", marginTop: 3 }}>{value}</Text></View>)}</View>
          {item.reasons.length > 0 && <View style={[styles.reasonBox, { backgroundColor: colors.background }]}><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{isAr ? "أسباب عدم تحقيق الهدف" : "Reasons for missed target"}</Text><Text style={{ color: colors.muted, textAlign: "right", marginTop: 4 }}>{item.reasons.join(" · ")}</Text></View>}
        </View>; })}
        {employees.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", padding: 28 }}>{isAr ? "لا توجد بيانات موظفين أو نتائج ضمن الفترة" : "No employees or results in this period"}</Text>}
      </>}
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" }, iconButton: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,.18)" }, content: { padding: 14, paddingBottom: 40 }, panel: { borderRadius: 14, borderWidth: 1, padding: 13, marginBottom: 12 }, sectionTitle: { textAlign: "right", fontWeight: "800", marginBottom: 8 }, periodRow: { flexDirection: "row", gap: 8, marginBottom: 10 }, periodButton: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9, borderWidth: 1 }, input: { borderWidth: 1, borderRadius: 9, padding: 10, textAlign: "right", marginBottom: 10 }, chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }, metric: { minWidth: "30%", flex: 1, borderRadius: 11, borderWidth: 1, padding: 11, alignItems: "center" }, card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 }, cardHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, name: { fontSize: 16, fontWeight: "800", textAlign: "right" }, meta: { fontSize: 11, textAlign: "right", marginTop: 3 }, rateBadge: { minWidth: 66, alignItems: "center", paddingVertical: 7, borderRadius: 10 }, dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }, dataCell: { minWidth: "30%", flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center" },   reasonBox: { borderRadius: 9, padding: 10, marginTop: 10 }, printButton: { flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 9, marginBottom: 10 },
});

// تمت إضافة بيانات الموظف الشخصية والتواصل والهدف والنتيجة والإنجاز والساعات والأسباب والحوافز والجزاءات والملاحظات.
