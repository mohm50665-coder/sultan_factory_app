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
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";


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
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

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
    setReceiptNumber("");
    setReceiptDate("");
    setAttachments([]);
  };

  const getTotalCollected = () => {
    return collections.reduce((sum, item) => sum + item.amount, 0);
  };

  const renderCollectionItem = ({ item }: { item: CollectionData }) => (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.customerName}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>{isAr ? `المحصل: ${item.collectorName}` : `Collector: ${item.collectorName}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={{ backgroundColor: colors.primary + '19', borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            style={{ backgroundColor: colors.error + '19', borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ backgroundColor: colors.success + '19', borderRadius: 4, padding: 8 }}>
        <Text style={{ color: colors.success, fontWeight: '600', fontSize: 14 }}>{isAr ? `المبلغ: ${item.amount} ريال` : `Amount: ${item.amount} SAR`}</Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <BackButton />
        </View>
        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>{isAr ? "التحصيل" : "Collection"}</Text>
        <View style={{ marginRight: 8 }}>
          <AdminBadgeIcon />
        </View>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={{ borderRadius: 8, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {/* ملخص التحصيلات */}
      <View style={{ backgroundColor: colors.success + '19', borderBottomWidth: 1, borderColor: colors.border, padding: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{isAr ? "إجمالي التحصيلات" : "Total Collections"}</Text>
        <Text style={{ color: colors.success, fontWeight: 'bold', fontSize: 24 }}>{isAr ? `${getTotalCollected()} ريال` : `${getTotalCollected()} SAR`}</Text>
      </View>

      {/* قائمة التحصيلات */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderCollectionItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 16 }}>{isAr ? "لا توجد بيانات تحصيل" : "No collection data"}</Text>
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
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 48 }}>
            {/* رأس النموذج */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18 }}>
                {editingId ? (isAr ? "تعديل التحصيل" : "Edit Collection") : (isAr ? "إضافة تحصيل جديد" : "Add New Collection")}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text style={{ fontWeight: '600' }}>
                  {isLoading ? (isAr ? "جاري..." : "Loading...") : (isAr ? "حفظ" : "Save")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView style={{ flex: 1, padding: 24 }}>
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

              <FormInput
                label={isAr ? "رقم السند" : "Receipt Number"}
                value={receiptNumber}
                onChangeText={setReceiptNumber}
                placeholder={isAr ? "أدخل رقم السند" : "Enter receipt number"}
              />

              <FormInput
                label={isAr ? "تاريخ السند" : "Receipt Date"}
                value={receiptDate}
                onChangeText={setReceiptDate}
                placeholder={isAr ? "مثال: 2024-01-15" : "e.g. 2024-01-15"}
              />

              {/* المرفقات */}
              <AttachmentPicker
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                language={language}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
