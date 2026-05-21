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
import { manufacturingStageService, ManufacturingStageData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const STAGES = [
  { label: "انتاج المكائن", value: "machine_production" },
  { label: "الروسو", value: "rosso" },
  { label: "القلب", value: "heart" },
  { label: "الكاوية", value: "ironing" },
  { label: "الفحص", value: "inspection" },
  { label: "التعبئة", value: "packaging" },
  { label: "التخزين", value: "storage" },
];

const WORKERS = {
  machine_production: [
    { label: "رنا", value: "rana" },
    { label: "شفيق", value: "shafiq" },
    { label: "محمد احمد", value: "mohammad_ahmad" },
    { label: "عطالله", value: "atallah" },
    { label: "الجميع", value: "all" },
  ],
  rosso: [
    { label: "فريدو", value: "frido" },
    { label: "قيوم", value: "qiyum" },
    { label: "الجميع", value: "all" },
  ],
  heart: [
    { label: "حسين السوري", value: "hussein_al_suri" },
    { label: "الجميع", value: "all" },
  ],
  ironing: [
    { label: "الجميع", value: "all" },
  ],
  inspection: [
    { label: "الجميع", value: "all" },
  ],
  packaging: [
    { label: "الجميع", value: "all" },
  ],
  storage: [
    { label: "الجميع", value: "all" },
  ],
};

export default function ManufacturingScreen() {
  const router = useRouter();
  const colors = useColors();

  const [stages, setStages] = useState<ManufacturingStageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("machine_production");

  const [formData, setFormData] = useState<ManufacturingStageData>({
    stageName: "machine_production",
    workerName: "",
    quantityDozen: 0,
    quantityPair: 0,
  });

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    try {
      setIsLoading(true);
      const data = await manufacturingStageService.getAll();
      setStages(data);
    } catch (error) {
      Alert.alert("خطأ", "فشل تحميل بيانات مراحل التصنيع");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.workerName) {
      Alert.alert("خطأ", "يرجى اختيار اسم العامل");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await manufacturingStageService.update(editingId, formData);
        Alert.alert("نجاح", "تم تحديث البيانات بنجاح");
      } else {
        await manufacturingStageService.create(formData);
        Alert.alert("نجاح", "تم إضافة البيانات بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadStages();
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
              await manufacturingStageService.delete(id);
              Alert.alert("نجاح", "تم حذف البيانات بنجاح");
              loadStages();
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

  const handleEdit = (stage: ManufacturingStageData) => {
    setFormData(stage);
    setSelectedStage(stage.stageName || "machine_production");
    setEditingId(stage.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      stageName: "machine_production",
      workerName: "",
      quantityDozen: 0,
      quantityPair: 0,
    });
    setSelectedStage("machine_production");
    setEditingId(null);
  };

  const getStageLabel = (stageName: string) => {
    return STAGES.find((s) => s.value === stageName)?.label || stageName;
  };

  const getWorkerLabel = (stageName: string, workerValue: string) => {
    const workers = WORKERS[stageName as keyof typeof WORKERS] || [];
    return workers.find((w) => w.value === workerValue)?.label || workerValue;
  };

  const renderStageItem = ({ item }: { item: ManufacturingStageData }) => (
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">
            {getStageLabel(item.stageName)}
          </Text>
          <Text className="text-muted text-sm mt-1">
            العامل: {getWorkerLabel(item.stageName, item.workerName)}
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

      <View className="bg-surface rounded p-2">
        <Text className="text-muted text-xs">
          الإنتاج: {item.quantityDozen} درزن، {item.quantityPair} زوج
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
        <Text className="text-white font-bold text-lg">مراحل التصنيع</Text>
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

      {/* قائمة المراحل */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={stages}
          renderItem={renderStageItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد بيانات مراحل تصنيع</Text>
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
                {editingId ? "تعديل المرحلة" : "إضافة مرحلة جديدة"}
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
                label="مرحلة التصنيع"
                value={selectedStage}
                options={STAGES}
                onValueChange={(value) => {
                  setSelectedStage(value);
                  setFormData({ ...formData, stageName: value, workerName: "" });
                }}
                required
              />

              <FormSelect
                label="اسم العامل"
                value={formData.workerName}
                options={WORKERS[selectedStage as keyof typeof WORKERS] || []}
                onValueChange={(value) =>
                  setFormData({ ...formData, workerName: value })
                }
                required
              />

              <FormNumberInput
                label="كمية الإنتاج - درزن"
                value={formData.quantityDozen.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, quantityDozen: parseInt(text) || 0 })
                }
                unit="درزن"
              />

              <FormNumberInput
                label="كمية الإنتاج - زوج"
                value={formData.quantityPair.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, quantityPair: parseInt(text) || 0 })
                }
                unit="زوج"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
