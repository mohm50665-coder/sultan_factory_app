import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { employeePerformanceService } from "@/lib/services/api.service";
import { calculateAchievementPercentage, getPerformanceRating, getPerformanceRatingLabel } from "@/shared/performance";

const PERIODS = [
  { key: "daily", ar: "يومي", en: "Daily" },
  { key: "weekly", ar: "أسبوعي", en: "Weekly" },
  { key: "monthly", ar: "شهري", en: "Monthly" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

type Employee = {
  id: number;
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  role?: string;
  createdAt?: string;
};

type EvaluationData = {
  employeeId: number;
  period: PeriodKey;
  startDate: string;
  endDate: string;
  targetTitle: string;
  targetDescription?: string;
  targetQuantity: number;
  unit: string;
  completedWork: string;
  achievedQuantity: number;
  achievementPercentage: number;
  evaluation: ReturnType<typeof getPerformanceRating>;
  remainingQuantity: number;
  workHours?: number;
  obstacles?: string;
  notes?: string;
  rewardAmount?: number;
  rewardReason?: string;
  penaltyAmount?: number;
  penaltyReason?: string;
  employee?: Employee;
  createdBy?: number;
  createdByName?: string;
};

type EvaluationReport = {
  id: number;
  reportName: string;
  startDate: string;
  endDate: string;
  data: EvaluationData;
  createdAt?: string;
};

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const periodRange = (period: PeriodKey, anchor = todayKey()) => {
  const value = new Date(`${anchor}T12:00:00`);
  if (period === "daily") return { startDate: anchor, endDate: anchor };
  if (period === "weekly") {
    const offsetFromSaturday = (value.getDay() + 1) % 7;
    const start = new Date(value);
    start.setDate(value.getDate() - offsetFromSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { startDate: dateKey(start), endDate: dateKey(end) };
  }
  const start = new Date(value.getFullYear(), value.getMonth(), 1, 12);
  const end = new Date(value.getFullYear(), value.getMonth() + 1, 0, 12);
  return { startDate: dateKey(start), endDate: dateKey(end) };
};

const emptyForm = (period: PeriodKey = "daily") => ({
  employeeId: 0,
  period,
  ...periodRange(period),
  targetTitle: "",
  targetDescription: "",
  targetQuantity: "",
  unit: "مهمة",
  completedWork: "",
  achievedQuantity: "",
  workHours: "",
  obstacles: "",
  notes: "",
  rewardAmount: "",
  rewardReason: "",
  penaltyAmount: "",
  penaltyReason: "",
});

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();
const numeric = (value: unknown) => Number(value || 0) || 0;
const ratingColor = (percentage: number) => percentage >= 100 ? "#15803d" : percentage >= 75 ? "#0369a1" : percentage >= 60 ? "#b45309" : "#b91c1c";

export default function EmployeePerformanceScreen() {
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const canManage = ["admin", "manager", "supervisor"].includes(user?.role || "");
  const [period, setPeriod] = useState<PeriodKey>("daily");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reports, setReports] = useState<EvaluationReport[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [employeeRows, reportRows] = await Promise.all([
        employeePerformanceService.listEmployees(),
        employeePerformanceService.list(),
      ]);
      const safeEmployees = Array.isArray(employeeRows) ? employeeRows : [];
      setEmployees(safeEmployees);
      setReports(Array.isArray(reportRows) ? reportRows : []);
      if (!selectedUserId && !canManage && safeEmployees[0]?.id) setSelectedUserId(Number(safeEmployees[0].id));
    } catch (cause: any) {
      setError(cause?.message || (isAr ? "تعذر تحميل بيانات الأداء" : "Unable to load performance data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleEmployees = useMemo(() => employees.filter((employee) => {
    if (selectedUserId !== null && Number(employee.id) !== selectedUserId) return false;
    const haystack = `${employee.name || ""} ${employee.username || ""} ${employee.department || ""} ${employee.position || ""}`;
    return normalize(haystack).includes(normalize(search));
  }), [employees, search, selectedUserId]);

  const periodReports = useMemo(() => reports.filter((report) => report.data?.period === period), [reports, period]);
  const summaries = useMemo(() => visibleEmployees.map((employee) => {
    const rows = periodReports.filter((report) => Number(report.data?.employeeId) === Number(employee.id));
    const goalCount = rows.length;
    const completedGoals = rows.filter((report) => numeric(report.data.achievementPercentage) >= 100).length;
    const achievement = goalCount ? Math.round((rows.reduce((sum, report) => sum + numeric(report.data.achievementPercentage), 0) / goalCount) * 100) / 100 : 0;
    return {
      employee,
      rows,
      goalCount,
      completedGoals,
      achievement,
      pendingGoals: Math.max(0, goalCount - completedGoals),
      hours: rows.reduce((sum, report) => sum + numeric(report.data.workHours), 0),
      rewards: rows.reduce((sum, report) => sum + numeric(report.data.rewardAmount), 0),
      penalties: rows.reduce((sum, report) => sum + numeric(report.data.penaltyAmount), 0),
    };
  }), [visibleEmployees, periodReports]);

  const previewPercentage = calculateAchievementPercentage(numeric(form.targetQuantity), numeric(form.achievedQuantity));
  const previewRating = getPerformanceRating(previewPercentage);

  const openForm = () => {
    const next = emptyForm(period);
    next.employeeId = selectedUserId || Number(employees[0]?.id || 0);
    setForm(next);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (report: EvaluationReport) => {
    const data = report.data;
    setForm({
      employeeId: Number(data.employeeId), period: data.period, startDate: data.startDate, endDate: data.endDate,
      targetTitle: data.targetTitle || "", targetDescription: data.targetDescription || "", targetQuantity: String(data.targetQuantity ?? ""), unit: data.unit || "مهمة",
      completedWork: data.completedWork || "", achievedQuantity: String(data.achievedQuantity ?? ""), workHours: String(data.workHours ?? ""),
      obstacles: data.obstacles || "", notes: data.notes || "", rewardAmount: String(data.rewardAmount ?? ""), rewardReason: data.rewardReason || "",
      penaltyAmount: String(data.penaltyAmount ?? ""), penaltyReason: data.penaltyReason || "",
    });
    setEditingId(report.id);
    setShowForm(true);
  };

  const changeFormPeriod = (nextPeriod: PeriodKey) => {
    setForm((current) => ({ ...current, period: nextPeriod, ...periodRange(nextPeriod) }));
  };

  const saveEvaluation = async () => {
    if (!form.employeeId || !form.targetTitle.trim() || numeric(form.targetQuantity) <= 0 || !form.completedWork.trim()) {
      Alert.alert(isAr ? "بيانات ناقصة" : "Missing information", isAr ? "اختر الموظف وأدخل اسم الهدف وكميته والأعمال المنجزة." : "Select an employee and enter the target, quantity, and completed work.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        period: form.period,
        startDate: form.startDate,
        endDate: form.endDate,
        targetTitle: form.targetTitle.trim(),
        targetDescription: form.targetDescription.trim(),
        targetQuantity: numeric(form.targetQuantity),
        unit: form.unit.trim() || (isAr ? "مهمة" : "task"),
        completedWork: form.completedWork.trim(),
        achievedQuantity: numeric(form.achievedQuantity),
        workHours: numeric(form.workHours),
        obstacles: form.obstacles.trim(),
        notes: form.notes.trim(),
        rewardAmount: numeric(form.rewardAmount),
        rewardReason: form.rewardReason.trim(),
        penaltyAmount: numeric(form.penaltyAmount),
        penaltyReason: form.penaltyReason.trim(),
      };
      if (editingId) await employeePerformanceService.update(editingId, payload);
      else await employeePerformanceService.create(payload);
      setShowForm(false);
      setEditingId(null);
      await load();
      Alert.alert(isAr ? "تم حفظ التقييم" : "Evaluation saved", isAr ? "حُسبت نسبة الإنجاز وأُرسل إشعار للموظف." : "Achievement was calculated and the employee was notified.");
    } catch (cause: any) {
      Alert.alert(isAr ? "تعذر الحفظ" : "Save failed", cause?.message || (isAr ? "حدث خطأ أثناء حفظ التقييم" : "An error occurred while saving the evaluation"));
    } finally {
      setSaving(false);
    }
  };

  const deleteEvaluation = async (id: number) => {
    const performDelete = async () => {
      try { await employeePerformanceService.delete(id); await load(); }
      catch (cause: any) { Alert.alert(isAr ? "تعذر الحذف" : "Delete failed", cause?.message || ""); }
    };
    if (Platform.OS === "web") {
      if (window.confirm(isAr ? "هل تريد حذف هذا التقييم؟" : "Delete this evaluation?")) await performDelete();
    } else {
      Alert.alert(isAr ? "تأكيد الحذف" : "Confirm deletion", isAr ? "هل تريد حذف هذا التقييم؟" : "Delete this evaluation?", [{ text: isAr ? "إلغاء" : "Cancel" }, { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: performDelete }]);
    }
  };

  const printReport = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert(isAr ? "الطباعة من الويب" : "Web printing", isAr ? "افتح نسخة الويب لطباعة التقرير." : "Open the web version to print the report.");
      return;
    }
    const rows = summaries.flatMap((summary) => summary.rows.map((report) => {
      const data = report.data;
      return `<tr><td>${summary.employee.name || summary.employee.username || "—"}</td><td>${data.startDate} — ${data.endDate}</td><td>${data.targetTitle}</td><td>${data.targetQuantity} ${data.unit}</td><td>${data.completedWork}</td><td>${data.achievedQuantity} ${data.unit}</td><td>${numeric(data.achievementPercentage).toFixed(2)}%</td><td>${getPerformanceRatingLabel(data.evaluation, isAr ? "ar" : "en")}</td><td>${data.workHours || 0}</td><td>${data.obstacles || "—"}</td><td>${data.notes || "—"}</td><td>${data.rewardAmount || 0}<br>${data.rewardReason || "—"}</td><td>${data.penaltyAmount || 0}<br>${data.penaltyReason || "—"}</td></tr>`;
    })).join("");
    const win = window.open("", "_blank", "width=1500,height=900");
    if (!win) return;
    win.document.write(`<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${isAr ? "تقرير أداء الموظفين" : "Employee Performance Report"}</title><style>@page{size:landscape;margin:8mm}body{font-family:Arial;padding:14px;color:#17202a}h1{text-align:center;color:#0a7ea4}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #b8c7cc;padding:5px;vertical-align:top}th{background:#0a7ea4;color:white}</style></head><body><h1>${isAr ? "تقرير أداء الموظفين" : "Employee Performance Report"}</h1><table><thead><tr><th>${isAr ? "الموظف" : "Employee"}</th><th>${isAr ? "الفترة" : "Period"}</th><th>${isAr ? "الهدف" : "Target"}</th><th>${isAr ? "الكمية المطلوبة" : "Target quantity"}</th><th>${isAr ? "الأعمال المنجزة" : "Completed work"}</th><th>${isAr ? "المنجز" : "Achieved"}</th><th>${isAr ? "نسبة الإنجاز" : "Achievement"}</th><th>${isAr ? "التقييم" : "Rating"}</th><th>${isAr ? "الساعات" : "Hours"}</th><th>${isAr ? "العقبات" : "Obstacles"}</th><th>${isAr ? "الملاحظات" : "Notes"}</th><th>${isAr ? "المكافأة" : "Reward"}</th><th>${isAr ? "الجزاء" : "Penalty"}</th></tr></thead><tbody>${rows || `<tr><td colspan="13">${isAr ? "لا توجد تقييمات محفوظة" : "No saved evaluations"}</td></tr>`}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const setField = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const inputStyle = [styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: isRtl ? "right" : "left" }] as any;

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={[styles.header, { backgroundColor: colors.primary }]}>
      <BackButton />
      <Text style={styles.headerTitle}>{isAr ? "تقييم أداء الموظفين" : "Employee Performance"}</Text>
      <TouchableOpacity onPress={load} style={styles.iconButton}><MaterialIcons name="refresh" size={22} color="#fff" /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRtl ? "right" : "left" }]}>{isAr ? "تقارير الأداء المحفوظة" : "Saved Performance Reports"}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: isRtl ? "right" : "left" }}>{isAr ? "تُحسب النسبة من المنجز ÷ الهدف × 100" : "Achievement = completed ÷ target × 100"}</Text></View>
          {canManage && <TouchableOpacity onPress={openForm} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><MaterialIcons name="add-chart" size={18} color="#fff" /><Text style={styles.primaryButtonText}>{isAr ? "تقييم جديد" : "New Evaluation"}</Text></TouchableOpacity>}
        </View>
        <View style={styles.periodRow}>{PERIODS.map((item) => <TouchableOpacity key={item.key} onPress={() => setPeriod(item.key)} style={[styles.periodButton, { backgroundColor: period === item.key ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: period === item.key ? "#fff" : colors.foreground, fontWeight: "700" }}>{isAr ? item.ar : item.en}</Text></TouchableOpacity>)}</View>
        <TextInput value={search} onChangeText={setSearch} placeholder={isAr ? "بحث بالاسم أو اسم المستخدم أو القسم" : "Search by name, username or department"} placeholderTextColor={colors.muted} style={inputStyle} />
        <TouchableOpacity onPress={printReport} style={[styles.printButton, { backgroundColor: colors.primary }]}><MaterialIcons name="print" size={18} color="#fff" /><Text style={styles.primaryButtonText}>{isAr ? "طباعة تقرير الأداء" : "Print Performance Report"}</Text></TouchableOpacity>
        {canManage && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: isRtl ? "row-reverse" : "row" }}><TouchableOpacity onPress={() => setSelectedUserId(null)} style={[styles.chip, { backgroundColor: selectedUserId === null ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: selectedUserId === null ? "#fff" : colors.foreground }}>{isAr ? "كل الموظفين" : "All Employees"}</Text></TouchableOpacity>{employees.map((employee) => <TouchableOpacity key={employee.id} onPress={() => setSelectedUserId(Number(employee.id))} style={[styles.chip, { backgroundColor: selectedUserId === Number(employee.id) ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: selectedUserId === Number(employee.id) ? "#fff" : colors.foreground }}>{employee.name || employee.username}</Text></TouchableOpacity>)}</ScrollView>}
      </View>

      {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 30 }} /> : error ? <Text style={{ color: colors.error, textAlign: "right", padding: 16 }}>{error}</Text> : summaries.map((summary) => {
        const employee = summary.employee;
        const rating = getPerformanceRating(summary.achievement);
        return <View key={employee.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.cardHeader, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
            <View style={{ flex: 1 }}><Text style={[styles.name, { color: colors.foreground, textAlign: isRtl ? "right" : "left" }]}>{employee.name || employee.username}</Text><Text style={[styles.meta, { color: colors.muted, textAlign: isRtl ? "right" : "left" }]}>{isAr ? "اسم المستخدم: " : "Username: "}{employee.username || "—"}</Text><Text style={[styles.meta, { color: colors.muted, textAlign: isRtl ? "right" : "left" }]}>{employee.phone || "—"} · {employee.email || "—"}</Text><Text style={[styles.meta, { color: colors.muted, textAlign: isRtl ? "right" : "left" }]}>{employee.department || "—"} · {employee.position || "—"}</Text></View>
            <View style={[styles.rateBadge, { backgroundColor: `${ratingColor(summary.achievement)}18` }]}><Text style={{ fontSize: 18, fontWeight: "800", color: ratingColor(summary.achievement) }}>{summary.achievement.toFixed(2)}%</Text><Text style={{ fontSize: 10, color: ratingColor(summary.achievement), fontWeight: "700" }}>{getPerformanceRatingLabel(rating, isAr ? "ar" : "en")}</Text></View>
          </View>
          <View style={styles.dataGrid}>{[[isAr ? "عدد الأهداف" : "Goals", summary.goalCount], [isAr ? "أهداف مكتملة" : "Completed Goals", summary.completedGoals], [isAr ? "أهداف غير مكتملة" : "Pending Goals", summary.pendingGoals], [isAr ? "ساعات العمل" : "Work Hours", summary.hours]].map(([label, value]) => <View key={String(label)} style={[styles.dataCell, { borderColor: colors.border }]}><Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text><Text style={{ color: colors.foreground, fontWeight: "800", marginTop: 3 }}>{value}</Text></View>)}</View>
          <View style={styles.separateCards}>
            <View style={[styles.rewardCard, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}><MaterialIcons name="workspace-premium" size={24} color="#15803d" /><Text style={styles.rewardTitle}>{isAr ? "المكافآت" : "Rewards"}</Text><Text style={styles.rewardValue}>{summary.rewards} {isAr ? "ر.س" : "SAR"}</Text></View>
            <View style={[styles.rewardCard, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}><MaterialIcons name="gavel" size={24} color="#b91c1c" /><Text style={[styles.rewardTitle, { color: "#991b1b" }]}>{isAr ? "الجزاءات" : "Penalties"}</Text><Text style={[styles.rewardValue, { color: "#b91c1c" }]}>{summary.penalties} {isAr ? "ر.س" : "SAR"}</Text></View>
          </View>
          {summary.rows.map((report) => { const data = report.data; return <View key={report.id} style={[styles.evaluationRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={{ color: colors.foreground, fontWeight: "800", flex: 1, textAlign: isRtl ? "right" : "left" }}>{data.targetTitle}</Text><Text style={{ color: ratingColor(numeric(data.achievementPercentage)), fontWeight: "800" }}>{numeric(data.achievementPercentage).toFixed(2)}%</Text>{canManage && <TouchableOpacity onPress={() => openEditForm(report)}><MaterialIcons name="edit" size={19} color={colors.primary} /></TouchableOpacity>}{user?.role === "admin" && <TouchableOpacity onPress={() => deleteEvaluation(report.id)}><MaterialIcons name="delete-outline" size={19} color="#dc2626" /></TouchableOpacity>}</View>
            <Text style={[styles.detailText, { color: colors.muted, textAlign: isRtl ? "right" : "left" }]}>{data.startDate} — {data.endDate} · {data.achievedQuantity}/{data.targetQuantity} {data.unit}</Text>
            <Text style={[styles.detailText, { color: colors.foreground, textAlign: isRtl ? "right" : "left" }]}>{isAr ? "الأعمال المنجزة: " : "Completed work: "}{data.completedWork}</Text>
            {!!data.obstacles && <Text style={[styles.detailText, { color: "#b45309", textAlign: isRtl ? "right" : "left" }]}>{isAr ? "العقبات: " : "Obstacles: "}{data.obstacles}</Text>}
            {!!data.notes && <Text style={[styles.detailText, { color: colors.muted, textAlign: isRtl ? "right" : "left" }]}>{isAr ? "الملاحظات: " : "Notes: "}{data.notes}</Text>}
            {!!numeric(data.rewardAmount) && <View style={[styles.inlineResult, { backgroundColor: "#f0fdf4" }]}><MaterialIcons name="workspace-premium" size={17} color="#15803d" /><Text style={{ color: "#166534", flex: 1 }}>{isAr ? "مكافأة" : "Reward"}: {data.rewardAmount} {isAr ? "ر.س" : "SAR"} — {data.rewardReason || "—"}</Text></View>}
            {!!numeric(data.penaltyAmount) && <View style={[styles.inlineResult, { backgroundColor: "#fef2f2" }]}><MaterialIcons name="gavel" size={17} color="#b91c1c" /><Text style={{ color: "#991b1b", flex: 1 }}>{isAr ? "جزاء" : "Penalty"}: {data.penaltyAmount} {isAr ? "ر.س" : "SAR"} — {data.penaltyReason || "—"}</Text></View>}
          </View>; })}
          {summary.rows.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", paddingVertical: 14 }}>{isAr ? "لا توجد تقييمات محفوظة في هذه الفترة" : "No saved evaluations in this period"}</Text>}
        </View>;
      })}
    </ScrollView>

    <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
      <View style={styles.modalOverlay}><View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.modalHeader, { flexDirection: isRtl ? "row-reverse" : "row" }]}><View style={{ flex: 1 }}><Text style={[styles.modalTitle, { color: colors.foreground, textAlign: isRtl ? "right" : "left" }]}>{editingId ? (isAr ? "تعديل تقييم الموظف" : "Edit Employee Evaluation") : (isAr ? "تقييم موظف جديد" : "New Employee Evaluation")}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: isRtl ? "right" : "left" }}>{isAr ? "أدخل الهدف والمنجز وسيحسب النظام النسبة والتقييم" : "Enter target and achieved work; the system calculates the result"}</Text></View><TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); }}><MaterialIcons name="close" size={24} color={colors.foreground} /></TouchableOpacity></View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الموظف" : "Employee"}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginBottom: 12 }}>{employees.map((employee) => <TouchableOpacity key={employee.id} onPress={() => setField("employeeId", Number(employee.id))} style={[styles.chip, { backgroundColor: form.employeeId === Number(employee.id) ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: form.employeeId === Number(employee.id) ? "#fff" : colors.foreground }}>{employee.name || employee.username}</Text></TouchableOpacity>)}</ScrollView>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "نوع الفترة" : "Period Type"}</Text><View style={styles.periodRow}>{PERIODS.map((item) => <TouchableOpacity key={item.key} onPress={() => changeFormPeriod(item.key)} style={[styles.periodButton, { backgroundColor: form.period === item.key ? colors.primary : colors.background, borderColor: colors.border }]}><Text style={{ color: form.period === item.key ? "#fff" : colors.foreground, fontWeight: "700" }}>{isAr ? item.ar : item.en}</Text></TouchableOpacity>)}</View>
          <View style={styles.twoColumns}><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "من تاريخ" : "From"}</Text><TextInput value={form.startDate} onChangeText={(value) => setField("startDate", value)} style={inputStyle} /></View><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "إلى تاريخ" : "To"}</Text><TextInput value={form.endDate} onChangeText={(value) => setField("endDate", value)} style={inputStyle} /></View></View>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "اسم الهدف" : "Target Title"}</Text><TextInput value={form.targetTitle} onChangeText={(value) => setField("targetTitle", value)} placeholder={isAr ? "مثال: إنتاج الصنف المطلوب" : "Example: Produce required product"} placeholderTextColor={colors.muted} style={inputStyle} />
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "تفاصيل الهدف" : "Target Details"}</Text><TextInput value={form.targetDescription} onChangeText={(value) => setField("targetDescription", value)} multiline style={[inputStyle, styles.multiline]} />
          <View style={styles.twoColumns}><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الكمية المطلوبة" : "Target Quantity"}</Text><TextInput value={form.targetQuantity} onChangeText={(value) => setField("targetQuantity", value)} keyboardType="decimal-pad" style={inputStyle} /></View><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الوحدة" : "Unit"}</Text><TextInput value={form.unit} onChangeText={(value) => setField("unit", value)} style={inputStyle} /></View></View>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الأعمال المنجزة فعلياً" : "Completed Work"}</Text><TextInput value={form.completedWork} onChangeText={(value) => setField("completedWork", value)} multiline placeholder={isAr ? "اكتب الأعمال التي أنجزها الموظف" : "Describe completed work"} placeholderTextColor={colors.muted} style={[inputStyle, styles.multiline]} />
          <View style={styles.twoColumns}><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الكمية المنجزة" : "Achieved Quantity"}</Text><TextInput value={form.achievedQuantity} onChangeText={(value) => setField("achievedQuantity", value)} keyboardType="decimal-pad" style={inputStyle} /></View><View style={{ flex: 1 }}><Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "ساعات العمل الفعلية" : "Actual Work Hours"}</Text><TextInput value={form.workHours} onChangeText={(value) => setField("workHours", value)} keyboardType="decimal-pad" style={inputStyle} /></View></View>
          <View style={[styles.calculationBox, { backgroundColor: `${ratingColor(previewPercentage)}12`, borderColor: ratingColor(previewPercentage) }]}><MaterialIcons name="analytics" size={25} color={ratingColor(previewPercentage)} /><View style={{ flex: 1 }}><Text style={{ color: ratingColor(previewPercentage), fontWeight: "900", fontSize: 22 }}>{previewPercentage.toFixed(2)}%</Text><Text style={{ color: ratingColor(previewPercentage), fontWeight: "700" }}>{getPerformanceRatingLabel(previewRating, isAr ? "ar" : "en")} · {isAr ? "المتبقي" : "Remaining"}: {Math.max(0, numeric(form.targetQuantity) - numeric(form.achievedQuantity))} {form.unit}</Text></View></View>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "عقبات تحقيق الهدف" : "Obstacles"}</Text><TextInput value={form.obstacles} onChangeText={(value) => setField("obstacles", value)} multiline style={[inputStyle, styles.multiline]} />
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{isAr ? "الملاحظات" : "Notes"}</Text><TextInput value={form.notes} onChangeText={(value) => setField("notes", value)} multiline style={[inputStyle, styles.multiline]} />
          <View style={[styles.formSection, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}><View style={styles.formSectionTitle}><MaterialIcons name="workspace-premium" size={23} color="#15803d" /><Text style={{ color: "#166534", fontWeight: "900" }}>{isAr ? "المكافأة" : "Reward"}</Text></View><Text style={[styles.formLabel, { color: "#166534" }]}>{isAr ? "قيمة المكافأة" : "Reward Amount"}</Text><TextInput value={form.rewardAmount} onChangeText={(value) => setField("rewardAmount", value)} keyboardType="decimal-pad" style={[inputStyle, { borderColor: "#86efac" }]} /><Text style={[styles.formLabel, { color: "#166534" }]}>{isAr ? "سبب المكافأة" : "Reward Reason"}</Text><TextInput value={form.rewardReason} onChangeText={(value) => setField("rewardReason", value)} multiline style={[inputStyle, styles.multiline, { borderColor: "#86efac" }]} /></View>
          <View style={[styles.formSection, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}><View style={styles.formSectionTitle}><MaterialIcons name="gavel" size={23} color="#b91c1c" /><Text style={{ color: "#991b1b", fontWeight: "900" }}>{isAr ? "الجزاء" : "Penalty"}</Text></View><Text style={[styles.formLabel, { color: "#991b1b" }]}>{isAr ? "قيمة الجزاء" : "Penalty Amount"}</Text><TextInput value={form.penaltyAmount} onChangeText={(value) => setField("penaltyAmount", value)} keyboardType="decimal-pad" style={[inputStyle, { borderColor: "#fca5a5" }]} /><Text style={[styles.formLabel, { color: "#991b1b" }]}>{isAr ? "سبب الجزاء" : "Penalty Reason"}</Text><TextInput value={form.penaltyReason} onChangeText={(value) => setField("penaltyReason", value)} multiline style={[inputStyle, styles.multiline, { borderColor: "#fca5a5" }]} /></View>
          <TouchableOpacity onPress={saveEvaluation} disabled={saving} style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>{saving ? <ActivityIndicator color="#fff" /> : <><MaterialIcons name="save" size={20} color="#fff" /><Text style={styles.primaryButtonText}>{editingId ? (isAr ? "حفظ التعديل وإشعار الموظف" : "Save Changes & Notify") : (isAr ? "حفظ التقييم وإشعار الموظف" : "Save & Notify Employee")}</Text></>}</TouchableOpacity>
        </ScrollView>
      </View></View>
    </Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 15 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  iconButton: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,.18)" },
  content: { padding: 14, paddingBottom: 40 },
  panel: { borderRadius: 14, borderWidth: 1, padding: 13, marginBottom: 12 },
  sectionTitle: { fontWeight: "800", marginBottom: 3 },
  periodRow: { flexDirection: "row", gap: 8, marginVertical: 10 },
  periodButton: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 9, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 10 },
  multiline: { minHeight: 74, textAlignVertical: "top" },
  primaryButton: { flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 11, paddingVertical: 9, borderRadius: 9 },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  printButton: { flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 9, marginBottom: 10 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardHeader: { gap: 10, alignItems: "flex-start" },
  name: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 11, marginTop: 3 },
  rateBadge: { minWidth: 82, alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  dataGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  dataCell: { minWidth: "22%", flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  separateCards: { flexDirection: "row", gap: 8, marginTop: 10 },
  rewardCard: { flex: 1, borderWidth: 1, borderRadius: 11, padding: 11, alignItems: "center" },
  rewardTitle: { color: "#166534", fontWeight: "800", marginTop: 4 },
  rewardValue: { color: "#15803d", fontSize: 18, fontWeight: "900", marginTop: 3 },
  evaluationRow: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10 },
  detailText: { fontSize: 11, marginTop: 5, lineHeight: 17 },
  inlineResult: { flexDirection: "row", gap: 6, alignItems: "center", borderRadius: 8, padding: 8, marginTop: 7 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "flex-end" },
  modalCard: { maxHeight: "94%", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  modalHeader: { alignItems: "center", gap: 10, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  formLabel: { fontSize: 12, fontWeight: "700", marginBottom: 5, textAlign: "right" },
  twoColumns: { flexDirection: "row", gap: 9 },
  calculationBox: { flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1, borderRadius: 11, padding: 12, marginBottom: 12 },
  formSection: { borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 8 },
  formSectionTitle: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
  saveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, paddingVertical: 13, marginTop: 14 },
});
