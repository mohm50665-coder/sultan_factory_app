import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { sampleRequestsService } from "@/lib/services/data.service";

const levelLabels: Record<string, string> = { warning: "إنذار أول", salary_deduction: "خصم من الراتب", customer_compensation: "تحمل تعويضات العميل" };
const statusLabels: Record<string, string> = { open: "مفتوح", acknowledged: "تم الاطلاع", closed: "مغلق" };

export default function SampleComplianceScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<any>(null);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [employeeName, setEmployeeName] = useState(user?.name || "");
  const [employeeId, setEmployeeId] = useState(String(user?.id || ""));
  const [requestId, setRequestId] = useState("");
  const [level, setLevel] = useState<"warning" | "salary_deduction" | "customer_compensation">("warning");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const [nextReport, nextPenalties] = await Promise.all([sampleRequestsService.deadlineComplianceReport({ month }), sampleRequestsService.penalties.list()]);
      setReport(nextReport); setPenalties(Array.isArray(nextPenalties) ? nextPenalties : []);
    } catch (error: any) { Alert.alert("تعذر تحميل التقرير", error?.message || "حاول مرة أخرى"); }
  };
  useEffect(() => { load(); }, []);

  const savePenalty = async () => {
    if (!Number(requestId) || !Number(employeeId) || !employeeName.trim() || reason.trim().length < 3) return Alert.alert("بيانات ناقصة", "أدخل رقم الطلب، رقم الموظف، اسم الموظف، والسبب");
    try {
      const data = { sampleRequestId: Number(requestId), employeeId: Number(employeeId), employeeName: employeeName.trim(), level, amount: Number(amount) || 0, reason: reason.trim(), correctiveAction: correctiveAction.trim() };
      if (editingId) await sampleRequestsService.penalties.update({ id: editingId, data: { level: data.level, amount: data.amount, reason: data.reason, correctiveAction: data.correctiveAction } });
      else await sampleRequestsService.penalties.create(data);
      setEditingId(null); setReason(""); setCorrectiveAction(""); setAmount("0"); await load();
      Alert.alert("تم الحفظ", editingId ? "تم تعديل الإجراء" : "تم تسجيل الإجراء");
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حاول مرة أخرى"); }
  };
  const editPenalty = (item: any) => { setEditingId(item.id); setRequestId(String(item.sampleRequestId)); setEmployeeId(String(item.employeeId)); setEmployeeName(item.employeeName || ""); setLevel(item.level); setAmount(String(item.amount || 0)); setReason(item.reason || ""); setCorrectiveAction(item.correctiveAction || ""); };
  const deletePenalty = (id: number) => Alert.alert("تأكيد الحذف", "سيتم حذف سجل الإجراء الجزائي", [{ text: "إلغاء" }, { text: "حذف", style: "destructive", onPress: async () => { try { await sampleRequestsService.penalties.delete({ id }); await load(); } catch (error: any) { Alert.alert("تعذر الحذف", error?.message || ""); } } }]);
  const input = (label: string, value: string, setter: (value: string) => void, numeric = false) => <View style={{ flex: 1, minWidth: 160 }}><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "700", marginBottom: 4 }}>{label}</Text><TextInput value={value} onChangeText={setter} keyboardType={numeric ? "numeric" : "default"} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, backgroundColor: colors.background, textAlign: "right" }} /></View>;
  const pct = report?.summary?.total ? ((report.summary.onTime / report.summary.total) * 100).toFixed(1) : "0.0";
  return <ScreenContainer className="p-4"><ScrollView contentContainerStyle={{ paddingBottom: 40 }}><View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}><BackButton /><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900", textAlign: "right" }}>الالتزام الزمني والإجراءات</Text><Text style={{ color: colors.muted, textAlign: "right", fontSize: 12 }}>تنبيهات المهل، الالتزام حسب القسم والموظف، وسجل العقوبات</Text></View></View>
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}><View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>{input("الشهر YYYY-MM", month, setMonth)}<TouchableOpacity onPress={load} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 11 }}><Text style={{ color: "#fff", fontWeight: "900" }}>تحديث</Text></TouchableOpacity></View>{report && <><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "900", marginTop: 12 }}>ملخص الالتزام لشهر {report.month}</Text><Text style={{ color: "#15803d", textAlign: "right" }}>نسبة الالتزام: {pct}% — في الموعد: {report.summary.onTime}</Text><Text style={{ color: report.summary.overdue ? "#b91c1c" : colors.muted, textAlign: "right" }}>المتأخر: {report.summary.overdue} — الإجمالي: {report.summary.total}</Text><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "800", marginTop: 8 }}>حسب القسم</Text>{report.byDepartment?.map((item: any) => <Text key={item.name} style={{ color: colors.muted, textAlign: "right" }}>{item.name}: {item.compliancePercentage}% ({item.onTime}/{item.total})</Text>)}<Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "800", marginTop: 8 }}>حسب الموظف</Text>{report.byEmployee?.map((item: any) => <Text key={item.name} style={{ color: colors.muted, textAlign: "right" }}>{item.name}: {item.compliancePercentage}% ({item.onTime}/{item.total})</Text>)}</>}</View>
    {user?.role === "admin" && <View style={{ backgroundColor: colors.surface, borderColor: "#fca5a5", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 }}><Text style={{ color: "#991b1b", textAlign: "right", fontWeight: "900", fontSize: 16, marginBottom: 8 }}>{editingId ? "تعديل إجراء جزائي" : "تسجيل إجراء جزائي"}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{input("رقم طلب العينة", requestId, setRequestId, true)}{input("رقم الموظف", employeeId, setEmployeeId, true)}{input("اسم الموظف", employeeName, setEmployeeName)}{input("المبلغ", amount, setAmount, true)}</View><TextInput value={reason} onChangeText={setReason} placeholder="سبب الإجراء" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right", marginTop: 8 }} /><TextInput value={correctiveAction} onChangeText={setCorrectiveAction} placeholder="الإجراء التصحيحي" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right", marginTop: 8 }} /><View style={{ flexDirection: "row-reverse", gap: 6, marginTop: 8 }}>{(["warning", "salary_deduction", "customer_compensation"] as const).map((item) => <TouchableOpacity key={item} onPress={() => setLevel(item)} style={{ flex: 1, backgroundColor: level === item ? "#b91c1c" : "#fee2e2", padding: 9, borderRadius: 7 }}><Text style={{ color: level === item ? "#fff" : "#991b1b", textAlign: "center", fontSize: 11 }}>{levelLabels[item]}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={savePenalty} style={{ backgroundColor: "#b91c1c", padding: 11, borderRadius: 8, alignItems: "center", marginTop: 8 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{editingId ? "حفظ التعديل" : "حفظ الإجراء"}</Text></TouchableOpacity></View>}
    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "900", textAlign: "right", marginBottom: 8 }}>سجل الإجراءات ({penalties.length})</Text>{penalties.map((item) => <View key={item.id} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 8 }}><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "900" }}>{item.employeeName} — {levelLabels[item.level]}</Text><Text style={{ color: colors.muted, textAlign: "right" }}>طلب {item.sampleRequestId} — {item.amount} ريال — {statusLabels[item.status]}</Text><Text style={{ color: colors.muted, textAlign: "right" }}>السبب: {item.reason}</Text>{item.correctiveAction && <Text style={{ color: colors.muted, textAlign: "right" }}>التصحيح: {item.correctiveAction}</Text>}{user?.role === "admin" && <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}><TouchableOpacity onPress={() => editPenalty(item)} style={{ backgroundColor: "#2563eb", padding: 8, borderRadius: 7, flex: 1 }}><Text style={{ color: "#fff", textAlign: "center" }}>تعديل</Text></TouchableOpacity><TouchableOpacity onPress={() => deletePenalty(item.id)} style={{ backgroundColor: "#b91c1c", padding: 8, borderRadius: 7, flex: 1 }}><Text style={{ color: "#fff", textAlign: "center" }}>حذف</Text></TouchableOpacity></View>}</View>)}</ScrollView></ScreenContainer>;
}
