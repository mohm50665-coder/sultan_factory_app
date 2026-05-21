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
import { FormInput, FormNumberInput, FormSelect, FormCheckbox } from "@/components/form-input";
import { financialService, FinancialData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const EXPENSE_TYPES = [
  { label: "صرف نقدي عام", value: "general_cash" },
  { label: "صرف نقدي - عهدة حيدر", value: "cash_haider" },
  { label: "صرف نقدي - عهدة المدير العام", value: "cash_general_manager" },
  { label: "شراء بطاقة بنكية - عهدة حيدر", value: "card_haider" },
  { label: "شراء بطاقة بنكية - عهدة المدير العام", value: "card_general_manager" },
];

export default function FinancialScreen() {
  const router = useRouter();
  const colors = useColors();

  const [expenses, setExpenses] = useState<FinancialData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<FinancialData>({
    expenseType: "general_cash",
    description: "",
    amount: 0,
    approvedByBoardRep: false,
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      setIsLoading(true);
      const data = await financialService.getAll();
      setExpenses(data);
    } catch (error) {
      Alert.alert("خطأ", "فشل تحميل البيانات المالية");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description || formData.amount <= 0) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول بشكل صحيح");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await financialService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث البيانات بنجاح");
      } else {
        await financialService.create(formData);
        Alert.alert("نجاح", "تم إضافة البيانات بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadExpenses();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "تأكيد الحذف",
      "هل أنت متأكد من حذف هذا السجل؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              setIsLoading(true);
              await financialService.delete(id);
              Alert.alert("نجاح", "تم حذف البيانات بنجاح");
              loadExpenses();
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

  const handleEdit = (expense: FinancialData) => {
    setFormData(expense);
    setEditingId(expense.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      expenseType: "general_cash",
      description: "",
      amount: 0,
      approvedByBoardRep: false,
    });
    setEditingId(null);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, item) => sum + item.amount, 0);
  };

  const getExpenseTypeLabel = (type: string) => {
    return EXPENSE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const renderExpenseItem = ({ item }: { item: FinancialData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">
            {getExpenseTypeLabel(item.expenseType)}
          </Text>
          <Text className="text-muted text-sm mt-1 leading-4">{item.description}</Text>
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
        <View className="flex-row items-center gap-2">
          {item.approvedByBoardRep && (
            <View className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded">
              <MaterialIcons name="check-circle" size={14} color={colors.success} />
              <Text className="text-success text-xs font-semibold">موافق</Text>
            </View>
          )}
        </View>
        <Text className="text-error font-bold text-sm">{item.amount} ريال</Text>
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
        <Text className="text-white font-bold text-lg">الشؤون المالية</Text>
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

      {/* ملخص النفقات */}
      <View className="bg-error/10 border-b border-border p-4">
        <Text className="text-muted text-xs mb-1">إجمالي النفقات</Text>
        <Text className="text-error font-bold text-2xl">{getTotalExpenses()} ريال</Text>
      </View>

      {/* قائمة النفقات */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={expenses}
          renderItem={renderExpenseItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد نفقات مسجلة</Text>
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
                {editingId ? "تعديل النفقة" : "إضافة نفقة جديدة"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text className={`font-semibold ${isLoading ? "text-muted" : "text-primary"}`}>
                  {isLoading ? "جاري..." : "حفظ"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView className="flex-1 p-6">
              <FormSelect
                label="نوع النفقة"
                value={formData.expenseType}
                options={EXPENSE_TYPES}
                onValueChange={(value) =>
                  setFormData({ ...formData, expenseType: value })
                }
                required
              />

              <FormInput
                label="وصف النفقة"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="أدخل وصف النفقة"
                multiline
                numberOfLines={3}
                required
              />

              <FormNumberInput
                label="المبلغ"
                value={formData.amount.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, amount: parseInt(text) || 0 })
                }
                unit="ريال"
                required
              />

              <View className="mt-6 border-t border-border pt-6">
                <FormCheckbox
                  label="موافقة ممثل مجلس الإدارة"
                  value={formData.approvedByBoardRep}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approvedByBoardRep: value })
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
