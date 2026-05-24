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
import { FormInput, FormSelect, FormCheckbox } from "@/components/form-input";
import { administrativeService, AdministrativeData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const APPROVAL_TYPES = [
  { label: "طلب إجازة", value: "leave_request" },
  { label: "طلب تقدم راتب", value: "advance_salary" },
  { label: "طلب تدريب", value: "training_request" },
  { label: "طلب نقل", value: "transfer_request" },
];

export default function AdministrativeScreen() {
  const router = useRouter();
  const colors = useColors();

  const [requests, setRequests] = useState<AdministrativeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<AdministrativeData>({
    employeeName: "",
    requestType: "leave_request",
    requestDetails: "",
    approvedByHR: false,
    approvedByManager: false,
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await administrativeService.getAll();
      setRequests(data);
    } catch (error) {
      Alert.alert("خطأ", "فشل تحميل الطلبات الإدارية");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.employeeName || !formData.requestDetails) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await administrativeService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث الطلب بنجاح");
      } else {
        await administrativeService.create(formData);
        Alert.alert("نجاح", "تم إضافة الطلب بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadRequests();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "تأكيد الحذف",
      "هل أنت متأكد من حذف هذا الطلب؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              setIsLoading(true);
              await administrativeService.delete(id);
              Alert.alert("نجاح", "تم حذف الطلب بنجاح");
              loadRequests();
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

  const handleEdit = (request: AdministrativeData) => {
    setFormData(request);
    setEditingId(request.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      employeeName: "",
      requestType: "leave_request",
      requestDetails: "",
      approvedByHR: false,
      approvedByManager: false,
    });
    setEditingId(null);
  };

  const getRequestTypeLabel = (type: string) => {
    return APPROVAL_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getApprovalStatus = (request: AdministrativeData) => {
    if (request.approvedByHR && request.approvedByManager) return "موافق";
    if (request.approvedByHR || request.approvedByManager) return "قيد المراجعة";
    return "قيد الانتظار";
  };

  const getApprovalColor = (request: AdministrativeData) => {
    if (request.approvedByHR && request.approvedByManager) return colors.success;
    if (request.approvedByHR || request.approvedByManager) return colors.warning;
    return colors.muted;
  };

  const renderRequestItem = ({ item }: { item: AdministrativeData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.employeeName}</Text>
          <Text className="text-muted text-sm mt-1">
            {getRequestTypeLabel(item.requestType)}
          </Text>
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

      <Text className="text-muted text-xs mb-2 leading-4">{item.requestDetails}</Text>

      <View className="flex-row justify-between items-center bg-surface rounded p-2">
        <View className="flex-row gap-2">
          {item.approvedByHR && (
            <View className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded">
              <MaterialIcons name="check-circle" size={14} color={colors.success} />
              <Text className="text-success text-xs font-semibold">HR</Text>
            </View>
          )}
          {item.approvedByManager && (
            <View className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded">
              <MaterialIcons name="check-circle" size={14} color={colors.success} />
              <Text className="text-success text-xs font-semibold">مدير</Text>
            </View>
          )}
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getApprovalColor(item)}20` }}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: getApprovalColor(item) }}
          >
            {getApprovalStatus(item)}
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
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text className="text-white font-bold text-lg">الإجراءات الإدارية</Text>
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

      {/* قائمة الطلبات */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد طلبات إدارية</Text>
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
                {editingId ? "تعديل الطلب" : "إضافة طلب جديد"}
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

              <FormSelect
                label="نوع الطلب"
                value={formData.requestType}
                options={APPROVAL_TYPES}
                onValueChange={(value) =>
                  setFormData({ ...formData, requestType: value })
                }
                required
              />

              <FormInput
                label="تفاصيل الطلب"
                value={formData.requestDetails}
                onChangeText={(text) => setFormData({ ...formData, requestDetails: text })}
                placeholder="أدخل تفاصيل الطلب"
                multiline
                numberOfLines={4}
                required
              />

              <View className="mt-6 border-t border-border pt-6">
                <Text className="text-foreground font-semibold text-sm mb-4">الموافقات</Text>
                <FormCheckbox
                  label="موافقة قسم الموارد البشرية"
                  value={formData.approvedByHR}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approvedByHR: value })
                  }
                />
                <FormCheckbox
                  label="موافقة المدير"
                  value={formData.approvedByManager}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approvedByManager: value })
                  }
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
