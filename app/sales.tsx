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
import { FormInput, FormNumberInput, FormSelect } from "@/components/form-input";
import { salesService, SalesData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const PAYMENT_METHODS = [
  { label: "نقداً", value: "cash" },
  { label: "بطاقة ائتمان", value: "credit" },
];

export default function SalesScreen() {
  const router = useRouter();
  const colors = useColors();

  const [sales, setSales] = useState<SalesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<SalesData>({
    sellerName: "",
    customerName: "",
    quantityDozen: 0,
    quantityPair: 0,
    paymentMethod: "cash",
  });

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setIsLoading(true);
      const data = await salesService.getAll();
      setSales(data);
    } catch (error) {
      Alert.alert("خطأ", "فشل تحميل بيانات المبيعات");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.sellerName || !formData.customerName) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await salesService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث البيانات بنجاح");
      } else {
        await salesService.create(formData);
        Alert.alert("نجاح", "تم إضافة البيانات بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadSales();
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
              await salesService.delete(id);
              Alert.alert("نجاح", "تم حذف البيانات بنجاح");
              loadSales();
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

  const handleEdit = (sale: SalesData) => {
    setFormData(sale);
    setEditingId(sale.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      sellerName: "",
      customerName: "",
      quantityDozen: 0,
      quantityPair: 0,
      paymentMethod: "cash",
    });
    setEditingId(null);
  };

  const renderSaleItem = ({ item }: { item: SalesData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.customerName}</Text>
          <Text className="text-muted text-sm mt-1">البائع: {item.sellerName}</Text>
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

      <View className="bg-surface rounded p-2 space-y-1">
        <Text className="text-muted text-xs">
          الكمية: {item.quantityDozen} درزن، {item.quantityPair} زوج
        </Text>
        <Text className="text-muted text-xs">
          طريقة الدفع: {item.paymentMethod === "cash" ? "نقداً" : "بطاقة ائتمان"}
        </Text>
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
        <Text className="text-white font-bold text-lg">المبيعات</Text>
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

      {/* قائمة المبيعات */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sales}
          renderItem={renderSaleItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد بيانات مبيعات</Text>
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
                {editingId ? "تعديل المبيعة" : "إضافة مبيعة جديدة"}
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
                label="اسم البائع"
                value={formData.sellerName}
                onChangeText={(text) => setFormData({ ...formData, sellerName: text })}
                placeholder="أدخل اسم البائع"
                required
              />

              <FormInput
                label="اسم العميل"
                value={formData.customerName}
                onChangeText={(text) => setFormData({ ...formData, customerName: text })}
                placeholder="أدخل اسم العميل"
                required
              />

              <FormNumberInput
                label="كمية المبيعة - درزن"
                value={formData.quantityDozen.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, quantityDozen: parseInt(text) || 0 })
                }
                unit="درزن"
              />

              <FormNumberInput
                label="كمية المبيعة - زوج"
                value={formData.quantityPair.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, quantityPair: parseInt(text) || 0 })
                }
                unit="زوج"
              />

              <FormSelect
                label="طريقة الدفع"
                value={formData.paymentMethod}
                options={PAYMENT_METHODS}
                onValueChange={(value) =>
                  setFormData({ ...formData, paymentMethod: value as "cash" | "credit" })
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
