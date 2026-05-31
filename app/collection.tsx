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
  const { t } = useLanguage();

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
      Alert.alert("خطأ", "فشل تحميل بيانات التحصيل");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.collectorName || !formData.customerName || formData.amount <= 0) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول بشكل صحيح");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await collectionService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث البيانات بنجاح");
      } else {
        await collectionService.create(formData);
        Alert.alert("نجاح", "تم إضافة البيانات بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadCollections();
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
              await collectionService.delete(id);
              Alert.alert("نجاح", "تم حذف البيانات بنجاح");
              loadCollections();
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
          <Text className="text-muted text-sm mt-1">المحصل: {item.collectorName}</Text>
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
        <Text className="text-success font-semibold text-sm">المبلغ: {item.amount} ريال</Text>
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
        <Text className="text-white font-bold text-lg">التحصيل</Text>
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
        <Text className="text-muted text-xs mb-1">إجمالي التحصيلات</Text>
        <Text className="text-success font-bold text-2xl">{getTotalCollected()} ريال</Text>
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
              <Text className="text-muted text-center mt-4">لا توجد بيانات تحصيل</Text>
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
                {editingId ? "تعديل التحصيل" : "إضافة تحصيل جديد"}
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
                label="اسم المحصل"
                value={formData.collectorName}
                onChangeText={(text) => setFormData({ ...formData, collectorName: text })}
                placeholder="أدخل اسم المحصل"
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
                label="المبلغ المحصل"
                value={formData.amount.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, amount: parseInt(text) || 0 })
                }
                unit={t("sar")}
                required
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
