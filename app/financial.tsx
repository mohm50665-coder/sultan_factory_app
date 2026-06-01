import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";


const STORAGE_KEY = "sultan_expenses";
const REPORT_STORAGE_KEY = "sultan_financial_reports";

interface ExpenseEntry {
  id: string;
  date: string;
  amount: string;
  description: string;
}

interface FinancialReport {
  id: string;
  date: string;
  title: string;
  content: string;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FinancialScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();

  const [activeTab, setActiveTab] = useState<"expenses" | "report">("expenses");

  // حقول المصروفات
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  const [date, setDate] = useState(formatDate(new Date()));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // حقول التقرير المالي
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [editingReport, setEditingReport] = useState<FinancialReport | null>(null);
  const [reportDate, setReportDate] = useState(formatDate(new Date()));
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");

  useEffect(() => {
    loadEntries();
    loadReports();
  }, []);

  // ===== المصروفات =====
  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
    } catch (e) {}
  };

  const saveEntries = async (newEntries: ExpenseEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) {}
  };

  const resetForm = () => {
    setDate(formatDate(new Date()));
    setAmount("");
    setDescription("");
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleSave = () => {
    if (!amount || !description) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }
    const entry: ExpenseEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date,
      amount,
      description,
    };
    let newEntries: ExpenseEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }
    saveEntries(newEntries);
    resetForm();
  };

  const handleEdit = (entry: ExpenseEntry) => {
    setDate(entry.date);
    setAmount(entry.amount);
    setDescription(entry.description);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?", [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: () => saveEntries(entries.filter((e) => e.id !== id)) },
    ]);
  };

  const getTotalExpenses = () => {
    return entries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };

  // ===== التقرير المالي =====
  const loadReports = async () => {
    try {
      const data = await AsyncStorage.getItem(REPORT_STORAGE_KEY);
      if (data) setReports(JSON.parse(data));
    } catch (e) {}
  };

  const saveReports = async (newReports: FinancialReport[]) => {
    try {
      await AsyncStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(newReports));
      setReports(newReports);
    } catch (e) {}
  };

  const resetReportForm = () => {
    setReportDate(formatDate(new Date()));
    setReportTitle("");
    setReportContent("");
    setEditingReport(null);
    setShowReportForm(false);
  };

  const handleSaveReport = () => {
    if (!reportTitle || !reportContent) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }
    const report: FinancialReport = {
      id: editingReport?.id || Date.now().toString(),
      date: reportDate,
      title: reportTitle,
      content: reportContent,
    };
    let newReports: FinancialReport[];
    if (editingReport) {
      newReports = reports.map((r) => (r.id === editingReport.id ? report : r));
    } else {
      newReports = [report, ...reports];
    }
    saveReports(newReports);
    resetReportForm();
  };

  const handleEditReport = (report: FinancialReport) => {
    setReportDate(report.date);
    setReportTitle(report.title);
    setReportContent(report.content);
    setEditingReport(report);
    setShowReportForm(true);
  };

  const handleDeleteReport = (id: string) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? "هل أنت متأكد من حذف هذا التقرير؟" : "Are you sure you want to delete this report?", [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: () => saveReports(reports.filter((r) => r.id !== id)) },
    ]);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "المصروفات" : "Expenses"}</Text>
        <AdminBadgeIcon />
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {/* التبويبات */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("expenses")}
          style={[styles.tab, activeTab === "expenses" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
        >
          <MaterialIcons name="payments" size={20} color={activeTab === "expenses" ? colors.primary : colors.muted} />
          <Text style={[styles.tabText, { color: activeTab === "expenses" ? colors.primary : colors.muted }]}>{isAr ? "المصروفات" : "Expenses"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("report")}
          style={[styles.tab, activeTab === "report" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
        >
          <MaterialIcons name="description" size={20} color={activeTab === "report" ? colors.primary : colors.muted} />
          <Text style={[styles.tabText, { color: activeTab === "report" ? colors.primary : colors.muted }]}>{isAr ? "التقرير المالي" : "Financial Report"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === "expenses" ? (
          <>
            {/* ملخص المصروفات */}
            <View style={[styles.summaryCard, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Text style={{ color: "#6b7280", fontSize: 12 }}>{isAr ? "إجمالي المصروفات" : "Total Expenses"}</Text>
              <Text style={{ color: "#dc2626", fontSize: 22, fontWeight: "bold", marginTop: 4 }}>{getTotalExpenses().toLocaleString()} {isAr ? "ريال" : "SAR"}</Text>
            </View>

            {/* زر إضافة */}
            {!showForm && (
              <TouchableOpacity onPress={() => setShowForm(true)} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>{isAr ? "إضافة مصروف" : "Add Expense"}</Text>
              </TouchableOpacity>
            )}

            {/* نموذج الإدخال */}
            {showForm && (
              <View style={[styles.formCard, { borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>
                  {editingEntry ? (isAr ? "تعديل المصروف" : "Edit Expense") : (isAr ? "إضافة مصروف جديد" : "Add New Expense")}
                </Text>

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "التاريخ" : "Date"}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                  value={date}
                  onChangeText={setDate}
                  placeholder={isAr ? "YYYY-MM-DD" : "YYYY-MM-DD"}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "مبلغ الصرف (ريال)" : "Amount (SAR)"}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder={isAr ? "أدخل المبلغ" : "Enter amount"}
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                />

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "بيان الصرف" : "Description"}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={isAr ? "أدخل بيان الصرف" : "Enter description"}
                  placeholderTextColor={colors.muted}
                  multiline
                />

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                    <MaterialIcons name="save" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
                  </TouchableOpacity>
                  {editingEntry && (
                    <TouchableOpacity onPress={handleSave} style={[styles.editBtn, { backgroundColor: "#0891b2" }]}>
                      <MaterialIcons name="edit" size={18} color="#fff" />
                      <Text style={styles.saveBtnText}>{isAr ? "تعديل" : "Edit"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={resetForm} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.cancelBtnText, { color: colors.muted }]}>{isAr ? "إلغاء" : "Cancel"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* عرض السجلات */}
            {entries.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionHeader, { color: colors.foreground }]}>{isAr ? `السجلات (${entries.length})` : `Records (${entries.length})`}</Text>
                {entries.map((entry) => (
                  <View key={entry.id} style={[styles.entryCard, { borderColor: colors.border }]}>
                    <View style={styles.entryHeader}>
                      <Text style={[styles.entryDate, { color: colors.primary }]}>{entry.date}</Text>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.actionBtn}>
                          <MaterialIcons name="edit" size={18} color="#0891b2" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.actionBtn}>
                          <MaterialIcons name="delete" size={18} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.entryField, { color: colors.muted }]}>{isAr ? "مبلغ الصرف: " : "Amount: "}<Text style={{ color: "#dc2626", fontWeight: "bold" }}>{parseFloat(entry.amount).toLocaleString()} {isAr ? "ريال" : "SAR"}</Text></Text>
                    <Text style={[styles.entryField, { color: colors.muted }]}>{isAr ? "بيان الصرف: " : "Description: "}<Text style={{ color: colors.foreground }}>{entry.description}</Text></Text>
                  </View>
                ))}
              </View>
            )}

            {entries.length === 0 && !showForm && (
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>{isAr ? "لا توجد مصروفات مسجلة" : "No expenses recorded"}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* قسم التقرير المالي */}
            {!showReportForm && (
              <TouchableOpacity onPress={() => setShowReportForm(true)} style={[styles.addBtn, { backgroundColor: "#6366f1" }]}>
                <MaterialIcons name="note-add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>{isAr ? "إدراج تقرير مالي" : "Add Financial Report"}</Text>
              </TouchableOpacity>
            )}

            {showReportForm && (
              <View style={[styles.formCard, { borderColor: colors.border }]}>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>
                  {editingReport ? (isAr ? "تعديل التقرير" : "Edit Report") : (isAr ? "إدراج تقرير مالي جديد" : "Add New Financial Report")}
                </Text>

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "التاريخ" : "Date"}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                  value={reportDate}
                  onChangeText={setReportDate}
                  placeholder={isAr ? "YYYY-MM-DD" : "YYYY-MM-DD"}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "عنوان التقرير" : "Report Title"}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                  value={reportTitle}
                  onChangeText={setReportTitle}
                  placeholder={isAr ? "أدخل عنوان التقرير" : "Enter report title"}
                  placeholderTextColor={colors.muted}
                />

                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "محتوى التقرير" : "Report Content"}</Text>
                <TextInput
                  style={[styles.input, styles.largeTextArea, { borderColor: colors.border, color: colors.foreground }]}
                  value={reportContent}
                  onChangeText={setReportContent}
                  placeholder={isAr ? "أدخل محتوى التقرير المالي" : "Enter financial report content"}
                  placeholderTextColor={colors.muted}
                  multiline
                />

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={handleSaveReport} style={[styles.saveBtn, { backgroundColor: "#6366f1" }]}>
                    <MaterialIcons name="save" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={resetReportForm} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.cancelBtnText, { color: colors.muted }]}>{isAr ? "إلغاء" : "Cancel"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* عرض التقارير */}
            {reports.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionHeader, { color: colors.foreground }]}>{isAr ? `التقارير (${reports.length})` : `Reports (${reports.length})`}</Text>
                {reports.map((report) => (
                  <View key={report.id} style={[styles.entryCard, { borderColor: colors.border }]}>
                    <View style={styles.entryHeader}>
                      <Text style={[styles.entryDate, { color: "#6366f1" }]}>{report.date}</Text>
                      <View style={styles.entryActions}>
                        <TouchableOpacity onPress={() => handleEditReport(report)} style={styles.actionBtn}>
                          <MaterialIcons name="edit" size={18} color="#0891b2" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteReport(report.id)} style={styles.actionBtn}>
                          <MaterialIcons name="delete" size={18} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[{ color: colors.foreground, fontWeight: "bold", fontSize: 14, textAlign: "right" }]}>{report.title}</Text>
                    <Text style={[styles.entryField, { color: colors.foreground, marginTop: 6 }]}>{report.content}</Text>
                  </View>
                ))}
              </View>
            )}

            {reports.length === 0 && !showReportForm && (
              <View style={styles.emptyState}>
                <MaterialIcons name="description" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>{isAr ? "لا توجد تقارير مالية" : "No financial reports"}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, backgroundColor: "#fff" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 6 },
  tabText: { fontSize: 13, fontWeight: "600" },
  content: { flex: 1, padding: 16 },
  summaryCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 16 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 10, gap: 6, marginBottom: 16 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  formCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 12, textAlign: "right" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 10, textAlign: "right" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right" },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  largeTextArea: { minHeight: 120, textAlignVertical: "top" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, gap: 6 },
  editBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, gap: 6 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, borderWidth: 1 },
  cancelBtnText: { fontSize: 14 },
  sectionHeader: { fontSize: 15, fontWeight: "bold", marginBottom: 10, textAlign: "right" },
  entryCard: { backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  entryDate: { fontSize: 12, fontWeight: "bold" },
  entryActions: { flexDirection: "row", gap: 8 },
  actionBtn: { padding: 4 },
  entryField: { fontSize: 12, marginTop: 3, textAlign: "right" },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },
});
