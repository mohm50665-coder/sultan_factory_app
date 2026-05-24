import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { taskService, TaskData } from "@/lib/services/data.service";
import { simpleAuthService } from "@/lib/services/simple-auth";
import { notificationsService } from "@/lib/services/notifications.service";

// مصادر التكليف
const ASSIGNMENT_SOURCES = [
  { label: "ممثل مجلس الإدارة", labelEn: "Board Representative", value: "board_representative" },
  { label: "المدير العام", labelEn: "General Manager", value: "general_manager" },
];

// الموظفين المكلفين
const ASSIGNED_EMPLOYEES = [
  { label: "المدير العام", labelEn: "General Manager", value: "general_manager" },
  { label: "مدير التسويق والمبيعات", labelEn: "Marketing & Sales Manager", value: "marketing_sales_manager" },
  { label: "مدير الإنتاج", labelEn: "Production Manager", value: "production_manager" },
  { label: "مدير المستودعات", labelEn: "Warehouse Manager", value: "warehouse_manager" },
  { label: "مسئول الصيانة", labelEn: "Maintenance Officer", value: "maintenance_officer" },
  { label: "مدير الشؤون الإدارية والمالية", labelEn: "Admin & Finance Manager", value: "admin_finance_manager" },
];

// النتائج
const RESULTS = [
  { label: "معلقة", labelEn: "Pending", value: "pending" },
  { label: "أنجز", labelEn: "Completed", value: "completed" },
  { label: "لم ينجز", labelEn: "Not Completed", value: "not_completed" },
  { label: "إنجاز جزئي", labelEn: "Partial", value: "partial" },
  { label: "تمديد", labelEn: "Extended", value: "extended" },
  { label: "توصيات", labelEn: "Recommendations", value: "recommendations" },
];

export default function TasksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [evaluationText, setEvaluationText] = useState("");
  const [warningText, setWarningText] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [showDecision, setShowDecision] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");

  const [formData, setFormData] = useState<TaskData>({
    assignmentSource: "general_manager",
    assignedEmployee: "production_manager",
    taskDescription: "",
    createdDate: today,
    startDate: today,
    endDate: today,
    result: "pending",
    reward: 0,
    rewardReason: "",
    deduction: 0,
    deductionReason: "",
  });

  useEffect(() => {
    loadTasks();
    loadUser();
  }, []);

  const loadUser = async () => {
    const user = await simpleAuthService.getCurrentUser();
    setCurrentUser(user);
  };

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await taskService.getAll();
      setTasks(data);
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل تحميل المهام" : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const handleSave = async () => {
    if (!formData.taskDescription || !formData.assignedEmployee) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await taskService.update(editingId, formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث المهمة" : "Task updated");
      } else {
        await taskService.create(formData);
        // إشعار تلقائي عند إسناد مهمة
        await notificationsService.add({
          type: "task",
          title: isAr ? "مهمة جديدة" : "New Task",
          message: isAr ? `تم تكليف ${getEmployeeLabel(formData.assignedEmployee)} بمهمة جديدة: ${formData.taskDescription.substring(0, 50)}` : `New task assigned to ${getEmployeeLabel(formData.assignedEmployee)}: ${formData.taskDescription.substring(0, 50)}`,
        });
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إنشاء المهمة" : "Task created");
      }
      setShowForm(false);
      resetForm();
      loadTasks();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل الحفظ" : "Failed to save");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل أنت متأكد من حذف هذه المهمة؟" : "Delete this task?",
      [
        { text: isAr ? "إلغاء" : "Cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await taskService.delete(id);
              loadTasks();
            } catch (e) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل الحذف" : "Failed");
            }
          },
        },
      ]
    );
  };

  const handleEdit = (task: TaskData) => {
    setFormData({ ...task });
    setEditingId(task.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      assignmentSource: "general_manager",
      assignedEmployee: "production_manager",
      taskDescription: "",
      createdDate: today,
      startDate: today,
      endDate: today,
      result: "pending",
      reward: 0,
      rewardReason: "",
      deduction: 0,
      deductionReason: "",
    });
    setEditingId(null);
  };

  const handleSaveEvaluation = async () => {
    if (!selectedTask?.id) return;
    if (evaluationText.length < 1500) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? `التقييم يجب أن لا يقل عن 1500 حرف (الحالي: ${evaluationText.length})` : `Evaluation must be at least 1500 chars (current: ${evaluationText.length})`);
      return;
    }
    await taskService.update(selectedTask.id, { ...selectedTask, adminEvaluation: evaluationText });
    await notificationsService.add({
      type: "task",
      title: isAr ? "تقييم جديد" : "New Evaluation",
      message: isAr ? `تم إضافة تقييم لمهمة: ${selectedTask.taskDescription?.substring(0, 40)}` : `Evaluation added for task: ${selectedTask.taskDescription?.substring(0, 40)}`,
    });
    setShowEvaluation(false);
    loadTasks();
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حفظ التقييم" : "Evaluation saved");
  };

  const handleSaveWarning = async () => {
    if (!selectedTask?.id) return;
    await taskService.update(selectedTask.id, { ...selectedTask, hasWarning: true, warningText });
    setShowWarning(false);
    loadTasks();
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إرفاق الإنذار" : "Warning attached");
  };

  const handleSaveDecision = async () => {
    if (!selectedTask?.id) return;
    await taskService.update(selectedTask.id, { ...selectedTask, attachedDecisions: decisionText });
    setShowDecision(false);
    loadTasks();
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إرفاق القرار" : "Decision attached");
  };

  const getSourceLabel = (val: string) => {
    const s = ASSIGNMENT_SOURCES.find((x) => x.value === val);
    return isAr ? s?.label || val : s?.labelEn || val;
  };

  const getEmployeeLabel = (val: string) => {
    const e = ASSIGNED_EMPLOYEES.find((x) => x.value === val);
    return isAr ? e?.label || val : e?.labelEn || val;
  };

  const getResultLabel = (val: string) => {
    const r = RESULTS.find((x) => x.value === val);
    return isAr ? r?.label || val : r?.labelEn || val;
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "completed": return "#10b981";
      case "not_completed": return "#ef4444";
      case "partial": return "#f59e0b";
      case "extended": return "#8b5cf6";
      case "recommendations": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  const renderTaskItem = ({ item }: { item: TaskData }) => {
    const canSeeEvaluation = isAdmin || (currentUser?.username && item.assignedEmployee === currentUser.role);

    return (
      <View style={styles.taskCard}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.employeeName}>{getEmployeeLabel(item.assignedEmployee)}</Text>
            <Text style={styles.sourceText}>
              {isAr ? "مصدر التكليف: " : "Source: "}{getSourceLabel(item.assignmentSource)}
            </Text>
          </View>
          {isAdmin && (
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.iconBtn, { backgroundColor: "#eff6ff" }]}>
                <MaterialIcons name="edit" size={16} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => item.id && handleDelete(item.id)} style={[styles.iconBtn, { backgroundColor: "#fef2f2" }]}>
                <MaterialIcons name="delete" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Task Description */}
        <Text style={styles.taskDesc}>{item.taskDescription}</Text>

        {/* Dates */}
        <View style={styles.datesRow}>
          <View style={styles.dateItem}>
            <MaterialIcons name="event" size={13} color="#6b7280" />
            <Text style={styles.dateText}>{isAr ? "البداية: " : "Start: "}{item.startDate}</Text>
          </View>
          <View style={styles.dateItem}>
            <MaterialIcons name="event-available" size={13} color="#6b7280" />
            <Text style={styles.dateText}>{isAr ? "النهاية: " : "End: "}{item.endDate}</Text>
          </View>
        </View>

        {/* Result */}
        <View style={styles.resultRow}>
          <View style={[styles.resultBadge, { backgroundColor: `${getResultColor(item.result)}15` }]}>
            <Text style={[styles.resultText, { color: getResultColor(item.result) }]}>
              {getResultLabel(item.result)}
            </Text>
          </View>
          {item.result === "partial" && item.completionPercentage && (
            <Text style={styles.percentText}>{item.completionPercentage}%</Text>
          )}
          {item.result === "extended" && item.extensionDate && (
            <Text style={styles.extDateText}>{isAr ? "حتى: " : "Until: "}{item.extensionDate}</Text>
          )}
        </View>

        {/* Reason / Recommendations */}
        {item.result === "not_completed" && item.resultReason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>{isAr ? "السبب:" : "Reason:"}</Text>
            <Text style={styles.reasonValue}>{item.resultReason}</Text>
          </View>
        )}
        {item.result === "recommendations" && item.recommendations && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>{isAr ? "التوصيات:" : "Recommendations:"}</Text>
            <Text style={styles.reasonValue}>{item.recommendations}</Text>
          </View>
        )}

        {/* Reward & Deduction */}
        {((item.reward && item.reward > 0) || (item.deduction && item.deduction > 0)) && (
          <View style={styles.financialSection}>
            {item.reward && item.reward > 0 ? (
              <View style={styles.rewardBadge}>
                <MaterialIcons name="star" size={14} color="#10b981" />
                <Text style={styles.rewardText}>{isAr ? "مكافأة" : "Reward"}: {item.reward} {isAr ? "ريال" : "SAR"}</Text>
                {item.rewardReason ? <Text style={styles.smallReason}>({item.rewardReason})</Text> : null}
              </View>
            ) : null}
            {item.deduction && item.deduction > 0 ? (
              <View style={styles.deductionBadge}>
                <MaterialIcons name="remove-circle" size={14} color="#ef4444" />
                <Text style={styles.deductionText}>{isAr ? "حسم" : "Deduction"}: {item.deduction} {isAr ? "ريال" : "SAR"}</Text>
                {item.deductionReason ? <Text style={styles.smallReason}>({item.deductionReason})</Text> : null}
              </View>
            ) : null}
          </View>
        )}

        {/* Warning Badge */}
        {item.hasWarning && (
          <View style={styles.warningBadge}>
            <MaterialIcons name="warning" size={14} color="#dc2626" />
            <Text style={styles.warningBadgeText}>{isAr ? "إنذار مرفق" : "Warning Attached"}</Text>
          </View>
        )}

        {/* Admin Evaluation (visible to assigned employee only) */}
        {item.adminEvaluation && canSeeEvaluation && (
          <View style={styles.evalBox}>
            <MaterialIcons name="rate-review" size={14} color="#7c3aed" />
            <Text style={styles.evalLabel}>{isAr ? "تقييم وتوجيه:" : "Evaluation:"}</Text>
            <Text style={styles.evalText} numberOfLines={3}>{item.adminEvaluation}</Text>
          </View>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <View style={styles.adminActions}>
            <TouchableOpacity
              onPress={() => { setSelectedTask(item); setEvaluationText(item.adminEvaluation || ""); setShowEvaluation(true); }}
              style={[styles.adminBtn, { backgroundColor: "#f5f3ff" }]}
            >
              <MaterialIcons name="rate-review" size={16} color="#7c3aed" />
              <Text style={[styles.adminBtnText, { color: "#7c3aed" }]}>{isAr ? "تقييم" : "Evaluate"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedTask(item); setWarningText(item.warningText || ""); setShowWarning(true); }}
              style={[styles.adminBtn, { backgroundColor: "#fef2f2" }]}
            >
              <MaterialIcons name="warning" size={16} color="#dc2626" />
              <Text style={[styles.adminBtnText, { color: "#dc2626" }]}>{isAr ? "إنذار" : "Warning"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedTask(item); setDecisionText(item.attachedDecisions || ""); setShowDecision(true); }}
              style={[styles.adminBtn, { backgroundColor: "#eff6ff" }]}
            >
              <MaterialIcons name="attach-file" size={16} color="#2563eb" />
              <Text style={[styles.adminBtnText, { color: "#2563eb" }]}>{isAr ? "قرارات" : "Decisions"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.headerBtn}>
          <MaterialIcons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAr ? "المهام" : "Tasks"}</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.headerBtn}>
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
        {!isAdmin && <View style={{ width: 40 }} />}
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: "#6b7280" }]}>
          <Text style={styles.summaryVal}>{tasks.length}</Text>
          <Text style={styles.summaryLbl}>{isAr ? "الكل" : "All"}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#10b981" }]}>
          <Text style={styles.summaryVal}>{tasks.filter((t) => t.result === "completed").length}</Text>
          <Text style={styles.summaryLbl}>{isAr ? "منجز" : "Done"}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#f59e0b" }]}>
          <Text style={styles.summaryVal}>{tasks.filter((t) => t.result === "pending").length}</Text>
          <Text style={styles.summaryLbl}>{isAr ? "معلق" : "Pending"}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#ef4444" }]}>
          <Text style={styles.summaryVal}>{tasks.filter((t) => t.result === "not_completed").length}</Text>
          <Text style={styles.summaryLbl}>{isAr ? "لم ينجز" : "Failed"}</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          <TouchableOpacity
            onPress={() => setFilterEmployee("all")}
            style={[styles.filterChip, filterEmployee === "all" && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.filterChipText, filterEmployee === "all" && { color: "white" }]}>{isAr ? "الكل" : "All"}</Text>
          </TouchableOpacity>
          {ASSIGNED_EMPLOYEES.map((emp) => (
            <TouchableOpacity
              key={emp.value}
              onPress={() => setFilterEmployee(emp.value)}
              style={[styles.filterChip, filterEmployee === emp.value && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.filterChipText, filterEmployee === emp.value && { color: "white" }]}>{isAr ? emp.label : emp.labelEn}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          <TouchableOpacity
            onPress={() => setFilterResult("all")}
            style={[styles.filterChip, filterResult === "all" && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.filterChipText, filterResult === "all" && { color: "white" }]}>{isAr ? "كل الحالات" : "All Status"}</Text>
          </TouchableOpacity>
          {RESULTS.map((r) => (
            <TouchableOpacity
              key={r.value}
              onPress={() => setFilterResult(r.value)}
              style={[styles.filterChip, filterResult === r.value && { backgroundColor: getResultColor(r.value) }]}
            >
              <Text style={[styles.filterChipText, filterResult === r.value && { color: "white" }]}>{isAr ? r.label : r.labelEn}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tasks List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tasks.filter((t) => {
            const empMatch = filterEmployee === "all" || t.assignedEmployee === filterEmployee;
            const resultMatch = filterResult === "all" || t.result === filterResult;
            return empMatch && resultMatch;
          })}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment" size={56} color="#d1d5db" />
              <Text style={styles.emptyText}>{isAr ? "لا توجد مهام" : "No tasks"}</Text>
            </View>
          }
        />
      )}

      {/* ============ FORM MODAL ============ */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowForm(false)}>
                  <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 15 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{editingId ? (isAr ? "تعديل المهمة" : "Edit Task") : (isAr ? "إنشاء مهمة" : "New Task")}</Text>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 15 }}>{isAr ? "حفظ" : "Save"}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* مصدر التكليف */}
                <Text style={styles.sectionTitle}>{isAr ? "مصدر التكليف *" : "Assignment Source *"}</Text>
                <View style={styles.optionsRow}>
                  {ASSIGNMENT_SOURCES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      onPress={() => setFormData({ ...formData, assignmentSource: s.value as any })}
                      style={[styles.optionBtn, formData.assignmentSource === s.value && styles.optionBtnActive]}
                    >
                      <Text style={[styles.optionText, formData.assignmentSource === s.value && styles.optionTextActive]}>
                        {isAr ? s.label : s.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* الموظف المكلف */}
                <Text style={styles.sectionTitle}>{isAr ? "الموظف المكلف *" : "Assigned Employee *"}</Text>
                <View style={styles.employeeGrid}>
                  {ASSIGNED_EMPLOYEES.map((e) => (
                    <TouchableOpacity
                      key={e.value}
                      onPress={() => setFormData({ ...formData, assignedEmployee: e.value })}
                      style={[styles.employeeBtn, formData.assignedEmployee === e.value && styles.employeeBtnActive]}
                    >
                      <Text style={[styles.employeeBtnText, formData.assignedEmployee === e.value && styles.employeeBtnTextActive]}>
                        {isAr ? e.label : e.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* وصف المهمة */}
                <Text style={styles.sectionTitle}>{isAr ? "وصف المهمة *" : "Task Description *"}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
                  value={formData.taskDescription}
                  onChangeText={(t) => setFormData({ ...formData, taskDescription: t })}
                  placeholder={isAr ? "أدخل وصف المهمة" : "Enter task description"}
                  multiline
                  textAlign={isRtl ? "right" : "left"}
                />

                {/* التواريخ */}
                <Text style={styles.sectionTitle}>{isAr ? "المدة الزمنية" : "Duration"}</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{isAr ? "البداية" : "Start"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.startDate}
                      onChangeText={(t) => setFormData({ ...formData, startDate: t })}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{isAr ? "النهاية" : "End"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.endDate}
                      onChangeText={(t) => setFormData({ ...formData, endDate: t })}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                </View>

                {/* النتائج */}
                <Text style={styles.sectionTitle}>{isAr ? "النتائج" : "Results"}</Text>
                <View style={styles.resultsGrid}>
                  {RESULTS.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setFormData({ ...formData, result: r.value as any })}
                      style={[styles.resultBtn, formData.result === r.value && { backgroundColor: getResultColor(r.value), borderColor: getResultColor(r.value) }]}
                    >
                      <Text style={[styles.resultBtnText, formData.result === r.value && { color: "white" }]}>
                        {isAr ? r.label : r.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* حقول إضافية حسب النتيجة */}
                {formData.result === "not_completed" && (
                  <View>
                    <Text style={styles.fieldLabel}>{isAr ? "سبب عدم الإنجاز" : "Reason"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.resultReason || ""}
                      onChangeText={(t) => setFormData({ ...formData, resultReason: t })}
                      placeholder={isAr ? "بيان السبب" : "Enter reason"}
                      textAlign={isRtl ? "right" : "left"}
                    />
                  </View>
                )}

                {formData.result === "partial" && (
                  <View>
                    <Text style={styles.fieldLabel}>{isAr ? "نسبة الإنجاز %" : "Completion %"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.completionPercentage?.toString() || ""}
                      onChangeText={(t) => setFormData({ ...formData, completionPercentage: parseInt(t) || 0 })}
                      keyboardType="numeric"
                      placeholder="0-100"
                    />
                  </View>
                )}

                {formData.result === "extended" && (
                  <View>
                    <Text style={styles.fieldLabel}>{isAr ? "التاريخ الجديد" : "New Date"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.extensionDate || ""}
                      onChangeText={(t) => setFormData({ ...formData, extensionDate: t })}
                      placeholder="YYYY-MM-DD"
                    />
                  </View>
                )}

                {formData.result === "recommendations" && (
                  <View>
                    <Text style={styles.fieldLabel}>{isAr ? "التوصيات" : "Recommendations"}</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
                      value={formData.recommendations || ""}
                      onChangeText={(t) => setFormData({ ...formData, recommendations: t })}
                      multiline
                      textAlign={isRtl ? "right" : "left"}
                    />
                  </View>
                )}

                {/* المكافأة والحسم */}
                <View style={styles.divider}>
                  <Text style={styles.dividerLabel}>{isAr ? "المكافآت والحسومات" : "Rewards & Deductions"}</Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: "#10b981" }]}>{isAr ? "المكافأة (ريال)" : "Reward (SAR)"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.reward?.toString() || "0"}
                      onChangeText={(t) => setFormData({ ...formData, reward: parseFloat(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: "#ef4444" }]}>{isAr ? "الحسم (ريال)" : "Deduction (SAR)"}</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.deduction?.toString() || "0"}
                      onChangeText={(t) => setFormData({ ...formData, deduction: parseFloat(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>{isAr ? "سبب المكافأة" : "Reward Reason"}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.rewardReason || ""}
                  onChangeText={(t) => setFormData({ ...formData, rewardReason: t })}
                  textAlign={isRtl ? "right" : "left"}
                />

                <Text style={styles.fieldLabel}>{isAr ? "سبب الحسم" : "Deduction Reason"}</Text>
                <TextInput
                  style={styles.input}
                  value={formData.deductionReason || ""}
                  onChangeText={(t) => setFormData({ ...formData, deductionReason: t })}
                  textAlign={isRtl ? "right" : "left"}
                />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ============ EVALUATION MODAL (Admin Only) ============ */}
      <Modal visible={showEvaluation} animationType="slide" transparent onRequestClose={() => setShowEvaluation(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEvaluation(false)}>
                <Text style={{ color: "#ef4444", fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isAr ? "تقييم وتوجيه المهمة" : "Task Evaluation"}</Text>
              <TouchableOpacity onPress={handleSaveEvaluation}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text style={styles.evalInfo}>
                {isAr
                  ? "هذا التقييم يظهر فقط للموظف المكلف بالمهمة لغرض المتابعة والإنجاز والتقييم. يجب أن لا يقل عن 1500 حرف."
                  : "This evaluation is visible only to the assigned employee. Minimum 1500 characters."}
              </Text>
              <Text style={styles.charCount}>
                {evaluationText.length} / 1500 {isAr ? "حرف" : "chars"}
                {evaluationText.length >= 1500 ? " ✓" : ""}
              </Text>
              <TextInput
                style={[styles.input, { minHeight: 300, textAlignVertical: "top" }]}
                value={evaluationText}
                onChangeText={setEvaluationText}
                multiline
                placeholder={isAr ? "أدخل التقييم والتوجيه هنا..." : "Enter evaluation here..."}
                textAlign={isRtl ? "right" : "left"}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============ WARNING MODAL ============ */}
      <Modal visible={showWarning} animationType="slide" transparent onRequestClose={() => setShowWarning(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowWarning(false)}>
                <Text style={{ color: "#ef4444", fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isAr ? "إرفاق إنذار" : "Attach Warning"}</Text>
              <TouchableOpacity onPress={handleSaveWarning}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text style={styles.fieldLabel}>{isAr ? "نص الإنذار" : "Warning Text"}</Text>
              <TextInput
                style={[styles.input, { minHeight: 150, textAlignVertical: "top" }]}
                value={warningText}
                onChangeText={setWarningText}
                multiline
                placeholder={isAr ? "أدخل نص الإنذار..." : "Enter warning text..."}
                textAlign={isRtl ? "right" : "left"}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============ DECISION MODAL ============ */}
      <Modal visible={showDecision} animationType="slide" transparent onRequestClose={() => setShowDecision(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDecision(false)}>
                <Text style={{ color: "#ef4444", fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isAr ? "قرارات المكافأة والحسم" : "Reward/Deduction Decisions"}</Text>
              <TouchableOpacity onPress={handleSaveDecision}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text style={styles.fieldLabel}>{isAr ? "نص القرار" : "Decision Text"}</Text>
              <TextInput
                style={[styles.input, { minHeight: 150, textAlignVertical: "top" }]}
                value={decisionText}
                onChangeText={setDecisionText}
                multiline
                placeholder={isAr ? "أدخل نص القرار..." : "Enter decision text..."}
                textAlign={isRtl ? "right" : "left"}
              />
            </ScrollView>
          </View>
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
    paddingVertical: 14,
  },
  headerBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "white" },
  summaryRow: { flexDirection: "row", padding: 12, gap: 6 },
  summaryCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    alignItems: "center",
    elevation: 1,
  },
  summaryVal: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  summaryLbl: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  taskCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  employeeName: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  sourceText: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 6, borderRadius: 6 },
  taskDesc: { fontSize: 13, color: "#374151", marginTop: 8, lineHeight: 20 },
  datesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  dateItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  dateText: { fontSize: 11, color: "#6b7280" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  resultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  resultText: { fontSize: 11, fontWeight: "600" },
  percentText: { fontSize: 12, fontWeight: "bold", color: "#f59e0b" },
  extDateText: { fontSize: 11, color: "#8b5cf6" },
  reasonBox: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 8, marginTop: 6 },
  reasonLabel: { fontSize: 11, fontWeight: "600", color: "#374151" },
  reasonValue: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  financialSection: { marginTop: 8, gap: 4 },
  rewardBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ecfdf5", padding: 6, borderRadius: 6 },
  rewardText: { fontSize: 11, fontWeight: "600", color: "#10b981" },
  deductionBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef2f2", padding: 6, borderRadius: 6 },
  deductionText: { fontSize: 11, fontWeight: "600", color: "#ef4444" },
  smallReason: { fontSize: 10, color: "#6b7280" },
  warningBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fef2f2", padding: 6, borderRadius: 6, marginTop: 6 },
  warningBadgeText: { fontSize: 11, fontWeight: "600", color: "#dc2626" },
  evalBox: { backgroundColor: "#f5f3ff", borderRadius: 8, padding: 8, marginTop: 6 },
  evalLabel: { fontSize: 11, fontWeight: "600", color: "#7c3aed", marginTop: 2 },
  evalText: { fontSize: 11, color: "#4b5563", marginTop: 2 },
  adminActions: { flexDirection: "row", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  adminBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 8 },
  adminBtnText: { fontSize: 11, fontWeight: "600" },
  filterRow: { paddingVertical: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  filterChipText: { fontSize: 11, fontWeight: "600", color: "#4b5563" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, color: "#6b7280", marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { flex: 1, backgroundColor: "#f9fafb", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 15, fontWeight: "bold", color: "#1f2937" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937", marginTop: 16, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#374151", marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#1f2937" },
  optionsRow: { flexDirection: "row", gap: 8 },
  optionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", backgroundColor: "white" },
  optionBtnActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  optionText: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  optionTextActive: { color: "white" },
  employeeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  employeeBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "white" },
  employeeBtnActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  employeeBtnText: { fontSize: 11, fontWeight: "600", color: "#4b5563" },
  employeeBtnTextActive: { color: "white" },
  resultsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  resultBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "white" },
  resultBtnText: { fontSize: 11, fontWeight: "600", color: "#4b5563" },
  divider: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 20, paddingTop: 12 },
  dividerLabel: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  evalInfo: { fontSize: 12, color: "#6b7280", lineHeight: 18, marginBottom: 8 },
  charCount: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 8 },
});
