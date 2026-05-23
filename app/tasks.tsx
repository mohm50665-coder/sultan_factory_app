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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { taskService, TaskData } from "@/lib/services/data.service";

const STATUSES = [
  { label: "قيد الانتظار", labelEn: "Pending", value: "pending" },
  { label: "قيد التنفيذ", labelEn: "In Progress", value: "inProgress" },
  { label: "مكتملة", labelEn: "Completed", value: "completed" },
];

export default function TasksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<TaskData>({
    employeeName: "",
    taskDescription: "",
    dueDate: new Date().toISOString().split("T")[0],
    status: "pending",
    reward: 0,
    rewardReason: "",
    deduction: 0,
    deductionReason: "",
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const data = await taskService.getAll();
      setTasks(data);
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل تحميل بيانات المهام" : "Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.employeeName || !formData.taskDescription) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await taskService.update(editingId, formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث المهمة بنجاح" : "Task updated successfully");
      } else {
        await taskService.create(formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة المهمة بنجاح" : "Task added successfully");
      }
      setShowForm(false);
      resetForm();
      loadTasks();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل أنت متأكد من حذف هذه المهمة؟" : "Are you sure you want to delete this task?",
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await taskService.delete(id);
              Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف المهمة بنجاح" : "Task deleted successfully");
              loadTasks();
            } catch (error) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حذف البيانات" : "Failed to delete");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (task: TaskData) => {
    setFormData({
      ...task,
      reward: task.reward || 0,
      rewardReason: task.rewardReason || "",
      deduction: task.deduction || 0,
      deductionReason: task.deductionReason || "",
    });
    setEditingId(task.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      employeeName: "",
      taskDescription: "",
      dueDate: new Date().toISOString().split("T")[0],
      status: "pending",
      reward: 0,
      rewardReason: "",
      deduction: 0,
      deductionReason: "",
    });
    setEditingId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "inProgress": return "#3b82f6";
      case "completed": return "#10b981";
      default: return "#6b7280";
    }
  };

  const getStatusLabel = (status: string) => {
    const s = STATUSES.find((st) => st.value === status);
    return isAr ? (s?.label || status) : (s?.labelEn || status);
  };

  const renderTaskItem = ({ item }: { item: TaskData }) => (
    <View style={styles.taskCard}>
      {/* Header */}
      <View style={styles.taskHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskEmployee}>{item.employeeName}</Text>
          <Text style={styles.taskDesc}>{item.taskDescription}</Text>
        </View>
        <View style={styles.taskActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.actionBtn, { backgroundColor: "#eff6ff" }]}>
            <MaterialIcons name="edit" size={18} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => item.id && handleDelete(item.id)} style={[styles.actionBtn, { backgroundColor: "#fef2f2" }]}>
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status & Date */}
      <View style={styles.taskMeta}>
        <View style={styles.taskDate}>
          <MaterialIcons name="event" size={14} color="#6b7280" />
          <Text style={styles.taskDateText}>{item.dueDate}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}15` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      {/* Reward & Deduction */}
      {((item.reward && item.reward > 0) || (item.deduction && item.deduction > 0)) && (
        <View style={styles.financialRow}>
          {item.reward && item.reward > 0 ? (
            <View style={styles.rewardBadge}>
              <MaterialIcons name="star" size={14} color="#10b981" />
              <Text style={styles.rewardText}>
                {isAr ? "مكافأة" : "Reward"}: {item.reward} {isAr ? "ريال" : "SAR"}
              </Text>
              {item.rewardReason ? (
                <Text style={styles.reasonText}>({item.rewardReason})</Text>
              ) : null}
            </View>
          ) : null}
          {item.deduction && item.deduction > 0 ? (
            <View style={styles.deductionBadge}>
              <MaterialIcons name="remove-circle" size={14} color="#ef4444" />
              <Text style={styles.deductionText}>
                {isAr ? "حسم" : "Deduction"}: {item.deduction} {isAr ? "ريال" : "SAR"}
              </Text>
              {item.deductionReason ? (
                <Text style={styles.reasonText}>({item.deductionReason})</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAr ? "المهام" : "Tasks"}</Text>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={styles.addBtn}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: "#f59e0b" }]}>
          <Text style={styles.summaryValue}>{tasks.filter((t) => t.status === "pending").length}</Text>
          <Text style={styles.summaryLabel}>{isAr ? "معلقة" : "Pending"}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#3b82f6" }]}>
          <Text style={styles.summaryValue}>{tasks.filter((t) => t.status === "inProgress").length}</Text>
          <Text style={styles.summaryLabel}>{isAr ? "قيد التنفيذ" : "In Progress"}</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#10b981" }]}>
          <Text style={styles.summaryValue}>{tasks.filter((t) => t.status === "completed").length}</Text>
          <Text style={styles.summaryLabel}>{isAr ? "مكتملة" : "Done"}</Text>
        </View>
      </View>

      {/* Tasks List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment" size={56} color="#d1d5db" />
              <Text style={styles.emptyText}>{isAr ? "لا توجد مهام" : "No tasks yet"}</Text>
              <Text style={styles.emptySubtext}>{isAr ? "اضغط + لإضافة مهمة جديدة" : "Tap + to add a new task"}</Text>
            </View>
          }
        />
      )}

      {/* Form Modal */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={[styles.modalAction, { color: "#ef4444" }]}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingId ? (isAr ? "تعديل المهمة" : "Edit Task") : (isAr ? "إضافة مهمة جديدة" : "New Task")}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text style={[styles.modalAction, { color: isLoading ? "#9ca3af" : colors.primary }]}>
                  {isLoading ? (isAr ? "جاري..." : "Saving...") : (isAr ? "حفظ" : "Save")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Employee Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "اسم الموظف *" : "Employee Name *"}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.employeeName}
                  onChangeText={(text) => setFormData({ ...formData, employeeName: text })}
                  placeholder={isAr ? "أدخل اسم الموظف" : "Enter employee name"}
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              {/* Task Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "وصف المهمة *" : "Task Description *"}</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 80, textAlignVertical: "top" }]}
                  value={formData.taskDescription}
                  onChangeText={(text) => setFormData({ ...formData, taskDescription: text })}
                  placeholder={isAr ? "أدخل وصف المهمة" : "Enter task description"}
                  multiline
                  numberOfLines={3}
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              {/* Due Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "تاريخ الاستحقاق" : "Due Date"}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.dueDate}
                  onChangeText={(text) => setFormData({ ...formData, dueDate: text })}
                  placeholder="YYYY-MM-DD"
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              {/* Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "حالة المهمة" : "Status"}</Text>
                <View style={styles.statusOptions}>
                  {STATUSES.map((s) => (
                    <TouchableOpacity
                      key={s.value}
                      onPress={() => setFormData({ ...formData, status: s.value as any })}
                      style={[
                        styles.statusOption,
                        formData.status === s.value && { backgroundColor: getStatusColor(s.value), borderColor: getStatusColor(s.value) },
                      ]}
                    >
                      <Text style={[styles.statusOptionText, formData.status === s.value && { color: "white" }]}>
                        {isAr ? s.label : s.labelEn}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <Text style={styles.dividerText}>{isAr ? "المكافآت والحسومات" : "Rewards & Deductions"}</Text>
              </View>

              {/* Reward */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: "#10b981" }]}>
                  <MaterialIcons name="star" size={14} color="#10b981" /> {isAr ? "المكافأة (ريال)" : "Reward (SAR)"}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.reward?.toString() || "0"}
                  onChangeText={(text) => setFormData({ ...formData, reward: parseFloat(text) || 0 })}
                  placeholder="0"
                  keyboardType="numeric"
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "سبب المكافأة" : "Reward Reason"}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.rewardReason}
                  onChangeText={(text) => setFormData({ ...formData, rewardReason: text })}
                  placeholder={isAr ? "أدخل سبب المكافأة" : "Enter reward reason"}
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              {/* Deduction */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: "#ef4444" }]}>
                  <MaterialIcons name="remove-circle" size={14} color="#ef4444" /> {isAr ? "الحسم (ريال)" : "Deduction (SAR)"}
                </Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.deduction?.toString() || "0"}
                  onChangeText={(text) => setFormData({ ...formData, deduction: parseFloat(text) || 0 })}
                  placeholder="0"
                  keyboardType="numeric"
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{isAr ? "سبب الحسم" : "Deduction Reason"}</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.deductionReason}
                  onChangeText={(text) => setFormData({ ...formData, deductionReason: text })}
                  placeholder={isAr ? "أدخل سبب الحسم" : "Enter deduction reason"}
                  textAlign={isRtl ? "right" : "left"}
                />
              </View>
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
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  addBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  summaryLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taskEmployee: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  taskDesc: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 18,
  },
  taskActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  taskMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  taskDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  taskDateText: {
    fontSize: 12,
    color: "#6b7280",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  financialRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 6,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },
  deductionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deductionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  reasonText: {
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 50,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalAction: {
    fontSize: 15,
    fontWeight: "600",
  },
  formScroll: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
  },
  statusOptions: {
    flexDirection: "row",
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    backgroundColor: "white",
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4b5563",
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginVertical: 16,
    paddingTop: 12,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
});
