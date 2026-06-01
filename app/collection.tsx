import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
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
import { FormInput, FormNumberInput } from "@/components/form-input";
import { collectionService, CollectionData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";


export default function CollectionScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<CollectionData>({
    collectorName: "",
    customerName: "",
    amount: 0,
  });

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const data = await collectionService.getAll();
      setCollections(data);
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل تحميل بيانات التحصيل" : "Failed to load collection data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.collectorName || !formData.customerName || formData.amount <= 0) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "يرجى ملء جميع الحقول بشكل صحيح" : "Please fill all fields correctly");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await collectionService.update(editingId, formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث البيانات بنجاح" : "Data updated successfully");
      } else {
        await collectionService.create(formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة البيانات بنجاح" : "Data added successfully");
      }
      setShowForm(false);
      resetForm();
      loadCollections();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Deletion",
      isAr ? "هل أنت متأكد من حذف هذا السجل؟" : "Are you sure you want to delete this record?",
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "حذف" : "Delete",
          onPress: async () => {
            try {
              setIsLoading(true);
              await collectionService.delete(id);
              Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف البيانات بنجاح" : "Data deleted successfully");
              loadCollections();
            } catch (error) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حذف البيانات" : "Failed to delete data");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (collection: CollectionData) => {
    setFormData(collection);
    setEditingId(collection.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      collectorName: "",
      customerName: "",
      amount: 0,
    });
    setEditingId(null);
  };

  const getTotalCollected = () => {
    return collections.reduce((sum, item) => sum + item.amount, 0);
  };

  const renderCollectionItem = ({ item }: { item: CollectionData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.customerName}</Text>
          <Text className="text-muted text-sm mt-1">{isAr ? `المحصل: ${item.collectorName}` : `Collector: ${item.collectorName}`}</Text>
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

      <View className="bg-success/10 rounded p-2">
        <Text className="text-success font-semibold text-sm">{isAr ? `المبلغ: ${item.amount} ريال` : `Amount: ${item.amount} SAR`}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-4 flex-row justify-between items-center">
        <View>
          <BackButton />
        </View>
        <Text className="text-white font-bold text-lg">{isAr ? "التحصيل" : "Collection"}</Text>
        <View style={{ marginRight: 8 }}>
          <AdminBadgeIcon />
        </View>
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

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {/* ملخص التحصيلات */}
      <View className="bg-success/10 border-b border-border p-4">
        <Text className="text-muted text-xs mb-1">{isAr ? "إجمالي التحصيلات" : "Total Collections"}</Text>
        <Text className="text-success font-bold text-2xl">{isAr ? `${getTotalCollected()} ريال` : `${getTotalCollected()} SAR`}</Text>
      </View>

      {/* قائمة التحصيلات */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderCollectionItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">{isAr ? "لا توجد بيانات تحصيل" : "No collection data"}</Text>
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
                <Text className="text-primary font-semibold">{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text className="text-foreground font-bold text-lg">
                {editingId ? (isAr ? "تعديل التحصيل" : "Edit Collection") : (isAr ? "إضافة تحصيل جديد" : "Add New Collection")}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text className={`font-semibold ${isLoading ? "text-muted" : "text-primary"}`}>
                  {isLoading ? (isAr ? "جاري..." : "Loading...") : (isAr ? "حفظ" : "Save")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView className="flex-1 p-6">
              <FormInput
                label={isAr ? "اسم المحصل" : "Collector Name"}
                value={formData.collectorName}
                onChangeText={(text) => setFormData({ ...formData, collectorName: text })}
                placeholder={isAr ? "أدخل اسم المحصل" : "Enter collector name"}
                required
              />

              <FormInput
                label={isAr ? "اسم العميل" : "Customer Name"}
                value={formData.customerName}
                onChangeText={(text) => setFormData({ ...formData, customerName: text })}
                placeholder={isAr ? "أدخل اسم العميل" : "Enter customer name"}
                required
              />

              <FormNumberInput
                label={isAr ? "المبلغ المحصل" : "Collected Amount"}
                value={formData.amount.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, amount: parseInt(text) || 0 })
                }
                unit={isAr ? "ريال" : "SAR"}
                required
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
