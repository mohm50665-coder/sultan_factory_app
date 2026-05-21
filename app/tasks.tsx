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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { FormInput, FormSelect } from "@/components/form-input";
import { taskService, TaskData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const STATUSES = [
  { label: "قيد الانتظار", value: "pending" },
  { label: "قيد التنفيذ", value: "inProgress" },
  { label: "مكتملة", value: "completed" },
];

export default function TasksScreen() {
  const router = useRouter();
  const colors = useColors();

  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<TaskData>({
    employeeName: "",
    taskDescription: "",
    dueDate: new Date().toISOString(),
    status: "pending",
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
      Alert.alert("خطأ", "فشل تحميل بيانات المهام");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.employeeName || !formData.taskDescription) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await taskService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث المهمة بنجاح");
      } else {
        await taskService.create(formData);
        Alert.alert("نجاح", "تم إضافة المهمة بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadTasks();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "تأكيد الحذف",
      "هل أنت متأكد من حذف هذه المهمة؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              setIsLoading(true);
              await taskService.delete(id);
              Alert.alert("نجاح", "تم حذف المهمة بنجاح");
              loadTasks();
            } catch (error) {
              Alert.alert("خطأ", "فشل حذف البيانات");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (task: TaskData) => {
    setFormData(task);
    setEditingId(task.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      employeeName: "",
      taskDescription: "",
      dueDate: new Date().toISOString(),
      status: "pending",
    });
    setEditingId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "inProgress":
        return colors.primary;
      case "completed":
        return colors.success;
      default:
        return colors.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "قيد الانتظار";
      case "inProgress":
        return "قيد التنفيذ";
      case "completed":
        return "مكتملة";
      default:
        return status;
    }
  };

  const renderTaskItem = ({ item }: { item: TaskData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.employeeName}</Text>
          <Text className="text-muted text-sm mt-1 leading-5">{item.taskDescription}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            className="bg-primary/10 rounded-lg p-2"
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            className="bg-error/10 rounded-lg p-2"
          >
            <MaterialIcons name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row justify-between items-center bg-surface rounded p-2">
        <Text className="text-muted text-xs">
          {new Date(item.dueDate).toLocaleDateString("ar-SA")}
        </Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-4 flex-row justify-between items-center">
        <View>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text className="text-white font-bold text-lg">المهام</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-white/20 rounded-lg p-2"
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* قائمة المهام */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد مهام</Text>
            </View>
          }
        />
      )}

      {/* نموذج الإضافة/التعديل */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background rounded-t-3xl mt-12">
            {/* رأس النموذج */}
            <View className="flex-row justify-between items-center p-6 border-b border-border">
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text className="text-primary font-semibold">إلغاء</Text>
              </TouchableOpacity>
              <Text className="text-foreground font-bold text-lg">
                {editingId ? "تعديل المهمة" : "إضافة مهمة جديدة"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text className={`font-semibold ${isLoading ? "text-muted" : "text-primary"}`}>
                  {isLoading ? "جاري..." : "حفظ"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView className="flex-1 p-6">
              <FormInput
                label="اسم الموظف"
                value={formData.employeeName}
                onChangeText={(text) => setFormData({ ...formData, employeeName: text })}
                placeholder="أدخل اسم الموظف"
                required
              />

              <FormInput
                label="وصف المهمة"
                value={formData.taskDescription}
                onChangeText={(text) => setFormData({ ...formData, taskDescription: text })}
                placeholder="أدخل وصف المهمة"
                multiline
                numberOfLines={4}
                required
              />

              <FormSelect
                label="حالة المهمة"
                value={formData.status}
                options={STATUSES}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as "pending" | "inProgress" | "completed" })
                }
                required
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
