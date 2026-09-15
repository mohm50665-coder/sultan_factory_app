import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { financialService } from "@/lib/services/api.service";
import { expensesService } from "@/lib/services/api.service";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
type Area = "finance" | "administration";
type FinanceTab = "bank" | "expenses" | "custody" | "report";
type AdminTab = "work" | "schedule" | "report";

function Field({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false, colors }: any) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} multiline={multiline} style={[styles.input, { borderColor: colors.border, color: colors.foreground }, multiline && styles.multiline]} /></View>;
}

function Choice({ label, active, onPress, colors }: any) {
  return <TouchableOpacity onPress={onPress} style={[styles.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}18` : colors.surface }]}><Text style={{ color: active ? colors.primary : colors.muted, fontWeight: "800", fontSize: 12 }}>{label}</Text></TouchableOpacity>;
}

export default function FinancialScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [area, setArea] = useState<Area>("finance");
  const [financeTab, setFinanceTab] = useState<FinanceTab>("bank");
  const [adminTab, setAdminTab] = useState<AdminTab>("work");
  const [bankRows, setBankRows] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [custodies, setCustodies] = useState<any[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [financialReports, setFinancialReports] = useState<any[]>([]);
  const [administrativeReports, setAdministrativeReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [expenseDetails, setExpenseDetails] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseNotes, setExpenseNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bankTransfer">("cash");
  const [recipientName, setRecipientName] = useState("");
  const [custodyDate, setCustodyDate] = useState(today());
  const [settlementDate, setSettlementDate] = useState("");
  const [shortageAmount, setShortageAmount] = useState("");
  const [shortageAction, setShortageAction] = useState("");
  const [custodyNotes, setCustodyNotes] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [procedureType, setProcedureType] = useState<"electronic" | "manual">("electronic");
  const [workStatus, setWorkStatus] = useState<"completed" | "not_completed" | "partial">("not_completed");
  const [workReason, setWorkReason] = useState("");
  const [targetDate, setTargetDate] = useState(today());
  const [assignedTo, setAssignedTo] = useState("");
  const [reportDate, setReportDate] = useState(today());
  const [reportSummary, setReportSummary] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";
  const totalExpenses = useMemo(() => expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0), [expenses]);
  const totalCustodies = useMemo(() => custodies.reduce((sum, row) => sum + Number(row.custodyAmount || 0), 0), [custodies]);
  const totalShortages = useMemo(() => custodies.reduce((sum, row) => sum + Number(row.shortageAmount || 0), 0), [custodies]);
  const latestBank = Number(bankRows[0]?.amount || 0);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bank, exp, custody, work, fr, ar] = await Promise.all([
        financialService.getBankBalance(), expensesService.getAll(), financialService.listCustodies(), financialService.listAdministrativeWork(), financialService.listFinancialDailyReports(), financialService.listAdministrativeDailyReports(),
      ]);
      setBankRows(Array.isArray(bank) ? bank : []); setExpenses(Array.isArray(exp) ? exp : []); setCustodies(Array.isArray(custody) ? custody : []); setWorkItems(Array.isArray(work) ? work : []); setFinancialReports(Array.isArray(fr) ? fr : []); setAdministrativeReports(Array.isArray(ar) ? ar : []);
    } catch (error: any) { Alert.alert(isAr ? "خطأ في التحميل" : "Loading error", error?.message || "تعذر تحميل البيانات"); } finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); }, []);

  const resetFinanceForm = () => { setAmount(""); setExpenseDetails(""); setExpenseNotes(""); setRecipientName(""); setShortageAmount(""); setShortageAction(""); setCustodyNotes(""); setSettlementDate(""); };
  const resetAdminForm = () => { setWorkDescription(""); setWorkReason(""); setAssignedTo(""); setTargetDate(today()); };

  const saveBank = async () => { if (!amount) return Alert.alert(isAr ? "أدخل رصيد البنك" : "Enter bank balance"); setSaving(true); try { await financialService.createBankBalance({ amount: Number(amount), userId: user?.id || 1 }); resetFinanceForm(); await loadAll(); Alert.alert(isAr ? "تم حفظ رصيد البنك" : "Bank balance saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };
  const saveExpense = async () => { if (!amount || !expenseDetails) return Alert.alert(isAr ? "أدخل المبلغ وبيان الصرف" : "Enter amount and description"); setSaving(true); try { await expensesService.create({ amount: Number(amount), expenseDetails, expenseDate, notes: expenseNotes, paymentMethod, requiresApproval: 0, userId: user?.id || 1 }); resetFinanceForm(); await loadAll(); Alert.alert(isAr ? "تم حفظ المصروف" : "Expense saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };
  const saveCustody = async () => { if (!amount || !recipientName) return Alert.alert(isAr ? "أدخل مبلغ العهدة واسم المستلم" : "Enter custody amount and recipient"); setSaving(true); try { await financialService.createCustody({ custodyAmount: Number(amount), recipientName, custodyDate, settlementDate: settlementDate || undefined, shortageAmount: Number(shortageAmount || 0), shortageAction, notes: custodyNotes }); resetFinanceForm(); await loadAll(); Alert.alert(isAr ? "تم حفظ العهدة" : "Custody saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };
  const saveWork = async () => { if (!workDescription) return Alert.alert(isAr ? "أدخل بيان العمل" : "Enter work description"); setSaving(true); try { await financialService.createAdministrativeWork({ workDescription, procedureType, status: workStatus, nonCompletionReason: workReason, targetDate, assignedTo, department: user?.department || "" }); resetAdminForm(); await loadAll(); Alert.alert(isAr ? "تم حفظ العمل الإداري" : "Administrative work saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };
  const saveFinancialReport = async () => { setSaving(true); try { await financialService.createFinancialDailyReport({ reportDate, bankBalance: latestBank, totalExpenses, totalCustodies, totalShortages, details: { expenses, custodies, bank: bankRows[0] || null } }); setReportSummary(""); await loadAll(); Alert.alert(isAr ? "تم حفظ التقرير المالي اليومي" : "Financial daily report saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };
  const saveAdministrativeReport = async () => { if (!reportSummary) return Alert.alert(isAr ? "أدخل ملخص التقرير" : "Enter report summary"); setSaving(true); try { await financialService.createAdministrativeDailyReport({ reportDate, summary: reportSummary, workItemsSnapshot: workItems }); setReportSummary(""); await loadAll(); Alert.alert(isAr ? "تم حفظ التقرير الإداري اليومي" : "Administrative daily report saved"); } catch (e: any) { Alert.alert(isAr ? "فشل الحفظ" : "Save failed", e?.message); } finally { setSaving(false); } };

  const tabItems = area === "finance" ? ([{ id: "bank", label: isAr ? "رصيد البنك" : "Bank balance", icon: "account-balance" }, { id: "expenses", label: isAr ? "المصروفات اليومية" : "Daily expenses", icon: "payments" }, { id: "custody", label: isAr ? "تقرير العهد" : "Custodies", icon: "account-box" }, { id: "report", label: isAr ? "التقرير المالي اليومي" : "Financial daily report", icon: "description" }] as any) : ([{ id: "work", label: isAr ? "الأعمال الإدارية" : "Administrative work", icon: "assignment" }, { id: "schedule", label: isAr ? "جدول الأعمال المطلوبة" : "Work schedule", icon: "event" }, { id: "report", label: isAr ? "التقرير الإداري اليومي" : "Administrative daily report", icon: "summarize" }] as any);
  const activeTab = area === "finance" ? financeTab : adminTab;
  const selectTab = (id: string) => area === "finance" ? setFinanceTab(id as FinanceTab) : setAdminTab(id as AdminTab);

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={[styles.header, { backgroundColor: colors.primary }]}><BackButton /><View style={{ flex: 1, alignItems: "center" }}><Text style={styles.headerTitle}>{isAr ? "الشؤون الإدارية والمالية" : "Administrative & Financial Affairs"}</Text><Text style={styles.headerSubtitle}>{isAr ? "إدارة الأرصدة والمصروفات والعهد والأعمال والتقارير اليومية" : "Balances, expenses, custodies, administration and daily reports"}</Text></View><MaterialIcons name="account-balance" size={28} color="#fff" /></View>
    <View style={styles.areaRow}><Choice label={isAr ? "المالية" : "Finance"} active={area === "finance"} onPress={() => setArea("finance")} colors={colors} /><Choice label={isAr ? "الشؤون الإدارية" : "Administration"} active={area === "administration"} onPress={() => setArea("administration")} colors={colors} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabItems.map((item: any) => <TouchableOpacity key={item.id} onPress={() => selectTab(item.id)} style={[styles.tab, { borderColor: activeTab === item.id ? colors.primary : colors.border, backgroundColor: activeTab === item.id ? `${colors.primary}15` : colors.surface }]}><MaterialIcons name={item.icon} size={19} color={activeTab === item.id ? colors.primary : colors.muted} /><Text style={{ color: activeTab === item.id ? colors.primary : colors.muted, fontSize: 11, fontWeight: "800" }}>{item.label}</Text></TouchableOpacity>)}</ScrollView>
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <Text style={{ color: colors.muted, textAlign: "center", padding: 30 }}>{isAr ? "جاري التحميل..." : "Loading..."}</Text> : <>
        {area === "finance" && financeTab === "bank" && <><View style={[styles.summary, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}><Text style={{ color: colors.muted }}>{isAr ? "آخر رصيد بنكي مسجل" : "Latest bank balance"}</Text><Text style={styles.summaryValue}>{latestBank.toLocaleString()} {isAr ? "ريال" : "SAR"}</Text></View><Field label={isAr ? "رصيد البنك نهاية اليوم" : "End-of-day bank balance"} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" colors={colors} /><Button title={isAr ? "حفظ رصيد البنك" : "Save bank balance"} onPress={saveBank} saving={saving} colors={colors} /><List rows={bankRows} empty={isAr ? "لا توجد أرصدة مسجلة" : "No balances"} render={(row: any) => <Text style={{ color: colors.foreground }}>{Number(row.amount || 0).toLocaleString()} {isAr ? "ريال" : "SAR"} — {new Date(row.createdAt).toLocaleDateString()}</Text>} colors={colors} /></>}
        {area === "finance" && financeTab === "expenses" && <><View style={[styles.summary, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}><Text style={{ color: colors.muted }}>{isAr ? "إجمالي المصروفات" : "Total expenses"}</Text><Text style={[styles.summaryValue, { color: "#dc2626" }]}>{totalExpenses.toLocaleString()} {isAr ? "ريال" : "SAR"}</Text></View><Field label={isAr ? "التاريخ" : "Date"} value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" colors={colors} /><Field label={isAr ? "المبلغ" : "Amount"} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" colors={colors} /><Field label={isAr ? "بيان الصرف" : "Expense statement"} value={expenseDetails} onChangeText={setExpenseDetails} placeholder={isAr ? "شرح الصرف" : "Description"} multiline colors={colors} /><Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "آلية الدفع" : "Payment method"}</Text><View style={styles.choiceRow}><Choice label={isAr ? "نقداً" : "Cash"} active={paymentMethod === "cash"} onPress={() => setPaymentMethod("cash")} colors={colors} /><Choice label={isAr ? "تحويل بنكي" : "Bank transfer"} active={paymentMethod === "bankTransfer"} onPress={() => setPaymentMethod("bankTransfer")} colors={colors} /></View><Field label={isAr ? "ملاحظات" : "Notes"} value={expenseNotes} onChangeText={setExpenseNotes} placeholder="" multiline colors={colors} /><Button title={isAr ? "حفظ المصروف" : "Save expense"} onPress={saveExpense} saving={saving} colors={colors} /><List rows={expenses} empty={isAr ? "لا توجد مصروفات" : "No expenses"} render={(row: any) => <View><Text style={{ color: colors.foreground, fontWeight: "800" }}>{Number(row.amount || 0).toLocaleString()} {isAr ? "ريال" : "SAR"} — {row.expenseDetails || row.description}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{row.expenseDate || row.createdAt?.slice?.(0, 10)} · {row.paymentMethod === "bankTransfer" ? (isAr ? "تحويل بنكي" : "Bank transfer") : (isAr ? "نقداً" : "Cash")}</Text>{row.notes ? <Text style={{ color: colors.muted, fontSize: 12 }}>{row.notes}</Text> : null}</View>} colors={colors} /></>}
        {area === "finance" && financeTab === "custody" && <><Field label={isAr ? "مبلغ العهدة" : "Custody amount"} value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" colors={colors} /><Field label={isAr ? "الشخص المستلم" : "Recipient"} value={recipientName} onChangeText={setRecipientName} placeholder={isAr ? "اسم الشخص" : "Name"} colors={colors} /><Field label={isAr ? "تاريخ العهدة" : "Custody date"} value={custodyDate} onChangeText={setCustodyDate} placeholder="YYYY-MM-DD" colors={colors} /><Field label={isAr ? "تاريخ تصفية العهدة" : "Settlement date"} value={settlementDate} onChangeText={setSettlementDate} placeholder="YYYY-MM-DD" colors={colors} /><Field label={isAr ? "العجز" : "Shortage"} value={shortageAmount} onChangeText={setShortageAmount} placeholder="0" keyboardType="numeric" colors={colors} /><Field label={isAr ? "إجراءات العجز" : "Shortage action"} value={shortageAction} onChangeText={setShortageAction} placeholder="" multiline colors={colors} /><Field label={isAr ? "الملاحظات" : "Notes"} value={custodyNotes} onChangeText={setCustodyNotes} placeholder="" multiline colors={colors} /><Button title={isAr ? "حفظ العهدة" : "Save custody"} onPress={saveCustody} saving={saving} colors={colors} /><View style={styles.summaryRow}><Stat label={isAr ? "إجمالي العهد" : "Custodies"} value={totalCustodies} colors={colors} /><Stat label={isAr ? "إجمالي العجز" : "Shortages"} value={totalShortages} colors={colors} /></View><List rows={custodies} empty={isAr ? "لا توجد عهد" : "No custodies"} render={(row: any) => <View><Text style={{ color: colors.foreground, fontWeight: "800" }}>{row.recipientName} — {Number(row.custodyAmount || 0).toLocaleString()} {isAr ? "ريال" : "SAR"}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{row.custodyDate} · {isAr ? "التصفية: " : "Settlement: "}{row.settlementDate || "—"} · {isAr ? "العجز: " : "Shortage: "}{Number(row.shortageAmount || 0).toLocaleString()}</Text></View>} colors={colors} /></>}
        {area === "finance" && financeTab === "report" && <><Field label={isAr ? "تاريخ التقرير" : "Report date"} value={reportDate} onChangeText={setReportDate} placeholder="YYYY-MM-DD" colors={colors} /><View style={styles.summaryRow}><Stat label={isAr ? "رصيد البنك" : "Bank"} value={latestBank} colors={colors} /><Stat label={isAr ? "المصروفات" : "Expenses"} value={totalExpenses} colors={colors} /><Stat label={isAr ? "العهد" : "Custodies"} value={totalCustodies} colors={colors} /><Stat label={isAr ? "العجز" : "Shortages"} value={totalShortages} colors={colors} /></View><Button title={isAr ? "حفظ التقرير المالي اليومي" : "Save financial daily report"} onPress={saveFinancialReport} saving={saving} colors={colors} /><List rows={financialReports} empty={isAr ? "لا توجد تقارير مالية محفوظة" : "No financial reports"} render={(row: any) => <View><Text style={{ color: colors.foreground, fontWeight: "800" }}>{row.reportDate}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "مصروفات: " : "Expenses: "}{row.totalExpenses} · {isAr ? "عهد: " : "Custodies: "}{row.totalCustodies} · {isAr ? "عجز: " : "Shortages: "}{row.totalShortages}</Text></View>} colors={colors} /></>}
        {area === "administration" && (adminTab === "work" || adminTab === "schedule") && <><Field label={isAr ? "البيان — شرح ووصف العمل" : "Work description"} value={workDescription} onChangeText={setWorkDescription} placeholder="" multiline colors={colors} /><Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "نوع الإجراء" : "Procedure type"}</Text><View style={styles.choiceRow}><Choice label={isAr ? "إلكتروني" : "Electronic"} active={procedureType === "electronic"} onPress={() => setProcedureType("electronic")} colors={colors} /><Choice label={isAr ? "يدوي" : "Manual"} active={procedureType === "manual"} onPress={() => setProcedureType("manual")} colors={colors} /></View><Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "الحالة" : "Status"}</Text><View style={styles.choiceRow}><Choice label={isAr ? "أنجز" : "Completed"} active={workStatus === "completed"} onPress={() => setWorkStatus("completed")} colors={colors} /><Choice label={isAr ? "لم ينجز" : "Not completed"} active={workStatus === "not_completed"} onPress={() => setWorkStatus("not_completed")} colors={colors} /><Choice label={isAr ? "أنجز جزئياً" : "Partial"} active={workStatus === "partial"} onPress={() => setWorkStatus("partial")} colors={colors} /></View><Field label={isAr ? "أسباب عدم الإنجاز أو الإنجاز الجزئي" : "Reason"} value={workReason} onChangeText={setWorkReason} placeholder="" multiline colors={colors} /><Field label={isAr ? "التاريخ المحدد للإنجاز" : "Target date"} value={targetDate} onChangeText={setTargetDate} placeholder="YYYY-MM-DD" colors={colors} /><Field label={isAr ? "الموظف أو الجهة" : "Assigned to"} value={assignedTo} onChangeText={setAssignedTo} placeholder="" colors={colors} /><Button title={isAr ? "حفظ العمل الإداري" : "Save administrative work"} onPress={saveWork} saving={saving} colors={colors} /><List rows={workItems.filter((row) => adminTab === "schedule" ? row.targetDate : true)} empty={isAr ? "لا توجد أعمال إدارية" : "No administrative work"} render={(row: any) => <View><Text style={{ color: colors.foreground, fontWeight: "800" }}>{row.workDescription}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{row.procedureType === "electronic" ? (isAr ? "إلكتروني" : "Electronic") : (isAr ? "يدوي" : "Manual")} · {row.status === "completed" ? (isAr ? "أنجز" : "Completed") : row.status === "partial" ? (isAr ? "جزئي" : "Partial") : (isAr ? "لم ينجز" : "Not completed")} · {row.targetDate || "—"}</Text>{row.nonCompletionReason ? <Text style={{ color: colors.muted, fontSize: 12 }}>{row.nonCompletionReason}</Text> : null}</View>} colors={colors} /></>}
        {area === "administration" && adminTab === "report" && <><Field label={isAr ? "تاريخ التقرير الإداري" : "Report date"} value={reportDate} onChangeText={setReportDate} placeholder="YYYY-MM-DD" colors={colors} /><Field label={isAr ? "ملخص التقرير الإداري اليومي" : "Daily administrative summary"} value={reportSummary} onChangeText={setReportSummary} placeholder={isAr ? "الأعمال المنجزة والمتأخرة والتوصيات" : "Completed and pending work"} multiline colors={colors} /><Button title={isAr ? "حفظ التقرير الإداري اليومي" : "Save administrative daily report"} onPress={saveAdministrativeReport} saving={saving} colors={colors} /><List rows={administrativeReports} empty={isAr ? "لا توجد تقارير إدارية محفوظة" : "No administrative reports"} render={(row: any) => <View><Text style={{ color: colors.foreground, fontWeight: "800" }}>{row.reportDate}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{row.summary}</Text></View>} colors={colors} /></>}
      </>}
    </ScrollView>
  </ScreenContainer>;
}

function Button({ title, onPress, saving, colors }: any) { return <TouchableOpacity disabled={saving} onPress={onPress} style={[styles.button, { backgroundColor: saving ? colors.muted : colors.primary }]}><MaterialIcons name="save" size={18} color="#fff" /><Text style={styles.buttonText}>{saving ? "..." : title}</Text></TouchableOpacity>; }
function Stat({ label, value, colors }: any) { return <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: colors.foreground, fontWeight: "900", marginTop: 4 }}>{Number(value || 0).toLocaleString()}</Text></View>; }
function List({ rows, empty, render, colors }: any) { return <View style={{ marginTop: 18 }}><Text style={{ color: colors.foreground, fontWeight: "900", marginBottom: 8 }}>{empty}</Text>{rows.map((row: any, index: number) => <View key={String(row.id || index)} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>{render(row)}</View>)}</View>; }

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  headerSubtitle: { color: "#e0f2fe", fontSize: 11, marginTop: 3, textAlign: "center" },
  areaRow: { flexDirection: "row", gap: 8, padding: 12 },
  tabs: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  tab: { minWidth: 112, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderRadius: 12, alignItems: "center", gap: 4 },
  content: { padding: 14, paddingBottom: 100 },
  summary: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  summaryValue: { color: "#1d4ed8", fontSize: 25, fontWeight: "900", marginTop: 5 },
  field: { marginTop: 10 },
  label: { fontSize: 12, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, textAlign: "right", backgroundColor: "transparent", minHeight: 44 },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  choice: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  button: { marginTop: 16, borderRadius: 11, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  stat: { flexGrow: 1, minWidth: "22%" as any, borderWidth: 1, borderRadius: 10, padding: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
});
