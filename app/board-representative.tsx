import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import { adminService, boardDataService, reportsService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";

interface BoardData {
  id: number;
  userId: number;
  dataType: string;
  value: string;
  description: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { id: "primary", label: "بيانات أساسية", labelEn: "Primary Data", icon: "folder", color: "#3B82F6" },
  { id: "secondary", label: "بيانات فرعية", labelEn: "Secondary Data", icon: "folder-open", color: "#10B981" },
  { id: "kpi", label: "مؤشرات الأداء", labelEn: "KPIs", icon: "trending-up", color: "#F59E0B" },
  { id: "report", label: "التقارير", labelEn: "Reports", icon: "assessment", color: "#8B5CF6" },
];

export default function BoardRepresentativeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"data" | "kpis" | "reports">("data");
  const [boardData, setBoardData] = useState<BoardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [reportUsers, setReportUsers] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [responseForm, setResponseForm] = useState({ response: "", notes: "", recommendations: "", requiredAction: "", assignedUserId: "", assignedDepartment: "" });
  const [isResponding, setIsResponding] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingData, setEditingData] = useState<BoardData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState({
    dataType: "primary",
    value: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Load data from server
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await boardDataService.getAll();
      if (result && Array.isArray(result)) {
        setBoardData(result);
      }
    } catch (e) {
      console.error("Error loading board data from server:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    reportsService.list().then((result) => setReports(Array.isArray(result) ? result : [])).catch(() => setReports([]));
    adminService.getAllUsers().then((result) => setReportUsers(Array.isArray(result) ? result : [])).catch(() => setReportUsers([]));
  }, [loadData]);

  const reportDepartments = Array.from(new Set(reportUsers.map((item) => item.department).filter(Boolean)));
  const openReportResponse = (report: any) => {
    setSelectedReport(report);
    const saved = report?.data?.boardResponse || {};
    setResponseForm({ response: saved.response || "", notes: saved.notes || "", recommendations: saved.recommendations || "", requiredAction: saved.requiredAction || "", assignedUserId: saved.assignedUserId ? String(saved.assignedUserId) : "", assignedDepartment: saved.assignedDepartment || "" });
  };
  const printReport = (report: any) => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert(isAr ? "الطباعة من الويب" : "Web printing", isAr ? "افتح نسخة الويب لطباعة التقرير." : "Open the web version to print the report.");
      return;
    }
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    const data = report?.data || {};
    const performanceHtml = report?.reportType === "performance" && data?.employeeId ? `<table><tr><th>الموظف</th><td>${data.employee?.name || "—"}</td><th>القسم / الوظيفة</th><td>${data.employee?.department || "—"} / ${data.employee?.position || "—"}</td></tr><tr><th>الهدف</th><td>${data.targetTitle || "—"}</td><th>المطلوب</th><td>${data.targetQuantity || 0} ${data.unit || ""}</td></tr><tr><th>الأعمال المنجزة</th><td>${data.completedWork || "—"}</td><th>المنجز</th><td>${data.achievedQuantity || 0} ${data.unit || ""}</td></tr><tr><th>نسبة الإنجاز</th><td>${Number(data.achievementPercentage || 0).toFixed(2)}%</td><th>ساعات العمل</th><td>${data.workHours || 0}</td></tr><tr><th>العقبات</th><td>${data.obstacles || "—"}</td><th>الملاحظات</th><td>${data.notes || "—"}</td></tr><tr><th>المكافأة</th><td>${data.rewardAmount || 0} ر.س — ${data.rewardReason || "—"}</td><th>الجزاء</th><td>${data.penaltyAmount || 0} ر.س — ${data.penaltyReason || "—"}</td></tr></table>` : `<pre>${JSON.stringify(data, null, 2).replace(/[&<>]/g, (char: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char))}</pre>`;
    popup.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${report.reportName || "Report"}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial;padding:24px;color:#17202a}h1{color:#6d28d9;text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:9px;text-align:right;vertical-align:top}th{background:#ede9fe;color:#5b21b6;width:14%}pre{white-space:pre-wrap;background:#f8fafc;padding:16px;border:1px solid #cbd5e1;border-radius:8px}</style></head><body><h1>${report.reportName || "Report"}</h1><p>${isAr ? "الفترة" : "Period"}: ${report.startDate} — ${report.endDate}</p><p>${isAr ? "المصدر" : "Source"}: ${data.createdByName || report.generatedBy}</p>${performanceHtml}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const saveReportResponse = async () => {
    if (!selectedReport || !user?.id || !responseForm.response.trim()) {
      Alert.alert(isAr ? "الرد مطلوب" : "Response required", isAr ? "اكتب الرد قبل الحفظ." : "Enter a response before saving.");
      return;
    }
    try {
      setIsResponding(true);
      await reportsService.updateResponse({ id: selectedReport.id, response: responseForm.response.trim(), notes: responseForm.notes.trim(), recommendations: responseForm.recommendations.trim(), requiredAction: responseForm.requiredAction.trim(), assignedUserId: responseForm.assignedUserId ? Number(responseForm.assignedUserId) : undefined, assignedDepartment: responseForm.assignedDepartment || undefined, respondedBy: user.id });
      const refreshed = await reportsService.list();
      setReports(Array.isArray(refreshed) ? refreshed : []);
      setSelectedReport(null);
      Alert.alert(isAr ? "تم حفظ الرد" : "Response saved", isAr ? "تم حفظ التوجيه وإرساله للجهة المحددة." : "The response was saved and directed to the selected recipient.");
    } catch (error) {
      Alert.alert(isAr ? "تعذر حفظ الرد" : "Could not save response", error instanceof Error ? error.message : "Unexpected error");
    } finally { setIsResponding(false); }
  };

  const handleAddData = () => {
    setEditingData(null);
    setFormData({
      dataType: "primary",
      value: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowModal(true);
  };

  const handleEditData = (data: BoardData) => {
    setEditingData(data);
    setFormData({
      dataType: data.dataType,
      value: data.value,
      description: data.description || "",
      date: data.date,
      notes: data.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveData = async () => {
    if (!formData.value) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء ملء البيانات المطلوبة" : "Please fill required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingData) {
        await boardDataService.update({
          id: editingData.id,
          value: formData.value,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
        });
      } else {
        await boardDataService.save({
          userId: 1,
          dataType: formData.dataType,
          value: formData.value,
          description: formData.description || undefined,
          date: formData.date,
          notes: formData.notes || undefined,
        });
      }
      setShowModal(false);
      await loadData();
      Alert.alert(isAr ? "نجح" : "Success", isAr ? "تم حفظ البيانات" : "Data saved successfully");
    } catch (e) {
      console.error("Error saving board data:", e);
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteData = (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل أنت متأكد من حذف هذه البيانات؟" : "Are you sure?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await boardDataService.delete(id);
              await loadData();
              Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف البيانات" : "Data deleted");
            } catch (e) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل الحذف" : "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const filteredData = boardData.filter(d => {
    const matchesCategory = !selectedCategory || d.dataType === selectedCategory;
    const matchesSearch = d.value.includes(searchText) || (d.description || "").includes(searchText);
    return matchesCategory && matchesSearch;
  });

  const renderDataCard = ({ item }: { item: BoardData }) => {
    const category = CATEGORIES.find(c => c.id === item.dataType);
    return (
      <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {category && <MaterialIcons name={category.icon as any} size={20} color={category.color} />}
            <Text style={[styles.dataTitle, { color: colors.foreground }]}>
              {isAr ? category?.label : category?.labelEn}
            </Text>
          </View>
          <Text style={[styles.dataContent, { color: colors.foreground }]}>{item.value}</Text>
          {item.description && (
            <Text style={[styles.dataDesc, { color: colors.muted }]}>{item.description}</Text>
          )}
          <Text style={[styles.dataDate, { color: colors.muted, marginTop: 8 }]}>{item.date}</Text>
          {item.notes && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{item.notes}</Text>
          )}
        </View>
        <View style={{ gap: 8, marginLeft: 12 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleEditData(item)}
          >
            <MaterialIcons name="edit" size={18} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#EF4444" }]}
            onPress={() => handleDeleteData(item.id)}
          >
            <MaterialIcons name="delete" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <BackButton />
          <Text style={styles.headerTitle}>{isAr ? "ممثل مجلس الإدارة" : "Board Representative"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>{isAr ? "جاري التحميل..." : "Loading..."}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "ممثل مجلس الإدارة" : "Board Representative"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { id: "data", label: isAr ? "البيانات" : "Data" },
          { id: "kpis", label: isAr ? "مؤشرات الأداء" : "KPIs" },
          { id: "reports", label: isAr ? "التقارير" : "Reports" },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                borderBottomColor: activeTab === tab.id ? colors.primary : "transparent",
                borderBottomWidth: activeTab === tab.id ? 3 : 0,
              },
            ]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <Text
              style={{
                color: activeTab === tab.id ? colors.primary : colors.muted,
                fontWeight: activeTab === tab.id ? "700" : "600",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data Tab */}
      {activeTab === "data" && (
        <>
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={isAr ? "ابحث..." : "Search..."}
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={colors.muted}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: !selectedCategory ? colors.primary : colors.surface, borderColor: colors.border }]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={{ color: !selectedCategory ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {isAr ? "الكل" : "All"}
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryBtn, { backgroundColor: selectedCategory === cat.id ? cat.color : colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={{ color: selectedCategory === cat.id ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {isAr ? cat.label : cat.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddData}>
              <MaterialIcons name="add" size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
                {isAr ? "إضافة بيانات" : "Add Data"}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredData}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="folder-open" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد بيانات - أضف بيانات جديدة" : "No data - add new data"}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* KPIs Tab */}
      {activeTab === "kpis" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={boardData.filter(d => d.dataType === "kpi")}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="trending-up" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد مؤشرات - أضف من تبويب البيانات" : "No KPIs - add from Data tab"}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => router.push("/board-monthly-report" as any)}
            style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#ede9fe", borderWidth: 1, borderColor: "#8B5CF6", borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            accessibilityLabel={isAr ? "فتح التقرير الشامل لمجلس الإدارة" : "Open comprehensive board report"}
          >
            <MaterialIcons name="chevron-left" size={22} color="#8B5CF6" />
            <View style={{ flex: 1, alignItems: "flex-end", marginHorizontal: 8 }}>
              <Text style={{ color: "#6D28D9", fontSize: 14, fontWeight: "700" }}>{isAr ? "التقرير الشامل لممثل مجلس الإدارة" : "Comprehensive Board Report"}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2, textAlign: "right" }}>{isAr ? "الإنتاج والمبيعات والمصروفات والصيانة والمهام والتحصيل" : "Production, sales, expenses, maintenance, tasks, and collection"}</Text>
            </View>
            <MaterialIcons name="assessment" size={24} color="#8B5CF6" />
          </TouchableOpacity>
          <ScrollView horizontal={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
            {reports.length === 0 ? <Text style={{ color: colors.muted, textAlign: "right" }}>{isAr ? "لا توجد تقارير محفوظة بعد" : "No saved reports yet"}</Text> : reports.map((report) => {
              const hasResponse = Boolean(report?.data?.boardResponse?.response);
              return <View key={`server-report-${report.id}`} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: hasResponse ? "#22c55e" : "#8B5CF6", borderRadius: 12, padding: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right" }}>{report.reportName}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{isAr ? `التاريخ: ${report.startDate} إلى ${report.endDate} | المصدر: ${report.data?.createdByName || report.generatedBy}` : `Date: ${report.startDate} to ${report.endDate} | Source: ${report.data?.createdByName || report.generatedBy}`}</Text>
                {report.reportType === "performance" && report.data?.employeeId && <View style={{ backgroundColor: "#f8fafc", borderRadius: 8, padding: 8, marginTop: 7 }}><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{isAr ? `الموظف: ${report.data?.employee?.name || "—"}` : `Employee: ${report.data?.employee?.name || "—"}`}</Text><Text style={{ color: "#0f766e", fontWeight: "800", textAlign: "right", marginTop: 3 }}>{isAr ? `الإنجاز: ${Number(report.data?.achievementPercentage || 0).toFixed(2)}% — الهدف: ${report.data?.targetTitle || "—"}` : `Achievement: ${Number(report.data?.achievementPercentage || 0).toFixed(2)}% — Target: ${report.data?.targetTitle || "—"}`}</Text></View>}
                <Text style={{ color: hasResponse ? "#16a34a" : "#d97706", fontSize: 11, textAlign: "right", marginTop: 4 }}>{hasResponse ? (isAr ? "تمت الإجابة" : "Answered") : (isAr ? "بانتظار رد ممثل المجلس" : "Awaiting board response")}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}>
                  <TouchableOpacity onPress={() => printReport(report)} style={{ flex: 1, backgroundColor: "#e0e7ff", borderRadius: 8, padding: 9, alignItems: "center" }}><Text style={{ color: "#3730a3", fontWeight: "800" }}>{isAr ? "طباعة" : "Print"}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => openReportResponse(report)} style={{ flex: 1, backgroundColor: "#6d28d9", borderRadius: 8, padding: 9, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "عرض والرد" : "View & reply"}</Text></TouchableOpacity>
                </View>
              </View>;
            })}
          </ScrollView>
          <FlatList
            data={boardData.filter(d => d.dataType === "report")}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="assessment" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد تقارير - أضف من تبويب البيانات" : "No reports - add from Data tab"}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Report response modal */}
      <Modal visible={Boolean(selectedReport)} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}> 
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", flex: 1, textAlign: "right" }}>{isAr ? "الرد على التقرير" : "Respond to report"}</Text>
            <TouchableOpacity onPress={() => setSelectedReport(null)}><MaterialIcons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>
          {selectedReport && <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right" }}>{selectedReport.reportName}</Text>
            <Text style={{ color: colors.muted, textAlign: "right" }}>{isAr ? `الفترة: ${selectedReport.startDate} إلى ${selectedReport.endDate}` : `Period: ${selectedReport.startDate} to ${selectedReport.endDate}`}</Text>
            {selectedReport.reportType === "performance" && selectedReport.data?.employeeId && <View style={{ backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, padding: 10 }}><Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right" }}>{selectedReport.data.employee?.name || "—"}</Text><Text style={{ color: colors.foreground, textAlign: "right", marginTop: 5 }}>{isAr ? "الهدف: " : "Target: "}{selectedReport.data.targetTitle} — {selectedReport.data.targetQuantity} {selectedReport.data.unit}</Text><Text style={{ color: colors.foreground, textAlign: "right", marginTop: 5 }}>{isAr ? "الأعمال المنجزة: " : "Completed work: "}{selectedReport.data.completedWork}</Text><Text style={{ color: "#0f766e", fontWeight: "900", textAlign: "right", marginTop: 5 }}>{isAr ? "نسبة الإنجاز: " : "Achievement: "}{Number(selectedReport.data.achievementPercentage || 0).toFixed(2)}%</Text><Text style={{ color: "#b45309", textAlign: "right", marginTop: 5 }}>{isAr ? "العقبات: " : "Obstacles: "}{selectedReport.data.obstacles || "—"}</Text><Text style={{ color: "#15803d", textAlign: "right", marginTop: 5 }}>{isAr ? "المكافأة: " : "Reward: "}{selectedReport.data.rewardAmount || 0} — {selectedReport.data.rewardReason || "—"}</Text><Text style={{ color: "#b91c1c", textAlign: "right", marginTop: 5 }}>{isAr ? "الجزاء: " : "Penalty: "}{selectedReport.data.penaltyAmount || 0} — {selectedReport.data.penaltyReason || "—"}</Text></View>}
            <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{isAr ? "الرد" : "Response"}</Text>
            <TextInput value={responseForm.response} onChangeText={(value) => setResponseForm((current) => ({ ...current, response: value }))} placeholder={isAr ? "اكتب الرد" : "Write the response"} placeholderTextColor={colors.muted} multiline style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, minHeight: 84 }]} />
            <TextInput value={responseForm.notes} onChangeText={(value) => setResponseForm((current) => ({ ...current, notes: value }))} placeholder={isAr ? "الملاحظات" : "Notes"} placeholderTextColor={colors.muted} multiline style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]} />
            <TextInput value={responseForm.recommendations} onChangeText={(value) => setResponseForm((current) => ({ ...current, recommendations: value }))} placeholder={isAr ? "التوصيات" : "Recommendations"} placeholderTextColor={colors.muted} multiline style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]} />
            <TextInput value={responseForm.requiredAction} onChangeText={(value) => setResponseForm((current) => ({ ...current, requiredAction: value }))} placeholder={isAr ? "المطلوب" : "Required action"} placeholderTextColor={colors.muted} multiline style={[styles.textInput, { color: colors.foreground, borderColor: colors.border }]} />
            <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{isAr ? "إرسال إلى موظف" : "Assign to employee"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}><TouchableOpacity onPress={() => setResponseForm((current) => ({ ...current, assignedUserId: "" }))} style={{ padding: 8, borderRadius: 7, borderWidth: 1, borderColor: !responseForm.assignedUserId ? colors.primary : colors.border }}><Text style={{ color: colors.foreground }}>{isAr ? "بدون تحديد" : "None"}</Text></TouchableOpacity>{reportUsers.map((item) => <TouchableOpacity key={item.id} onPress={() => setResponseForm((current) => ({ ...current, assignedUserId: String(item.id) }))} style={{ padding: 8, borderRadius: 7, borderWidth: 1, borderColor: responseForm.assignedUserId === String(item.id) ? colors.primary : colors.border }}><Text style={{ color: colors.foreground, fontSize: 11 }}>{item.name}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{isAr ? "إرسال إلى إدارة" : "Assign to department"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{reportDepartments.map((department) => <TouchableOpacity key={department} onPress={() => setResponseForm((current) => ({ ...current, assignedDepartment: department }))} style={{ padding: 8, borderRadius: 7, borderWidth: 1, borderColor: responseForm.assignedDepartment === department ? colors.primary : colors.border }}><Text style={{ color: colors.foreground, fontSize: 11 }}>{department}</Text></TouchableOpacity>)}</ScrollView>
            <TouchableOpacity disabled={isResponding} onPress={saveReportResponse} style={{ backgroundColor: "#16a34a", borderRadius: 9, padding: 12, alignItems: "center", marginTop: 4 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isResponding ? (isAr ? "جارٍ الحفظ..." : "Saving...") : (isAr ? "حفظ وإرسال الرد" : "Save and send response")}</Text></TouchableOpacity>
          </ScrollView>}
        </View>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold" }}>
              {editingData ? (isAr ? "تعديل البيانات" : "Edit Data") : (isAr ? "إضافة بيانات جديدة" : "Add New Data")}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* Category */}
            {!editingData && (
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                  {isAr ? "الفئة" : "Category"}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categorySelectBtn, { backgroundColor: formData.dataType === cat.id ? cat.color : colors.surface, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, dataType: cat.id })}
                    >
                      <Text style={{ color: formData.dataType === cat.id ? "white" : colors.foreground, fontSize: 12 }}>
                        {isAr ? cat.label : cat.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Value */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "القيمة / المحتوى" : "Value / Content"} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }]}
                placeholder={isAr ? "أدخل القيمة أو المحتوى" : "Enter value or content"}
                value={formData.value}
                onChangeText={(text) => setFormData({ ...formData, value: text })}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            {/* Description */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "الوصف" : "Description"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={isAr ? "وصف مختصر (اختياري)" : "Brief description (optional)"}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Date */}
            {!editingData && (
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                  {isAr ? "التاريخ" : "Date"}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="YYYY-MM-DD"
                  value={formData.date}
                  onChangeText={(text) => setFormData({ ...formData, date: text })}
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}

            {/* Notes */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "ملاحظات" : "Notes"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 60, textAlignVertical: "top" }]}
                placeholder={isAr ? "ملاحظات إضافية (اختياري)" : "Additional notes (optional)"}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1, opacity: isSaving ? 0.6 : 1 }]}
                onPress={handleSaveData}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
                    {isAr ? "حفظ" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", textAlign: "center" }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  dataCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
  },
  dataContent: {
    fontSize: 15,
    fontWeight: "600",
  },
  dataDesc: {
    fontSize: 13,
    marginTop: 4,
  },
  dataDate: {
    fontSize: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: { borderWidth: 1, borderRadius: 8, padding: 10, textAlign: "right", minHeight: 48 },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  categorySelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
