import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ProductionEntry {
  id: string;
  machineNumber: string;
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradePairs: string;
  secondGradeGrams: string;
  date: string;
}

const STORAGE_KEY = "sultan_production_data";

export default function ProductionScreen() {
  const router = useRouter();
  const colors = useColors();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [form, setForm] = useState({
    machineNumber: "",
    productionDozen: "",
    productionPairs: "",
    wasteThreadGrams: "",
    wasteSocksGrams: "",
    secondGradePairs: "",
    secondGradeGrams: "",
  });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
    } catch (e) { console.log(e); }
  };

  const saveEntries = async (newEntries: ProductionEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) { console.log(e); }
  };

  const resetForm = () => {
    setForm({
      machineNumber: "",
      productionDozen: "",
      productionPairs: "",
      wasteThreadGrams: "",
      wasteSocksGrams: "",
      secondGradePairs: "",
      secondGradeGrams: "",
    });
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!form.machineNumber) {
      Alert.alert("خطأ", "يرجى إدخال رقم المكينة");
      return;
    }

    const entry: ProductionEntry = {
      id: editingEntry?.id || Date.now().toString(),
      machineNumber: form.machineNumber,
      productionDozen: form.productionDozen || "0",
      productionPairs: form.productionPairs || "0",
      wasteThreadGrams: form.wasteThreadGrams || "0",
      wasteSocksGrams: form.wasteSocksGrams || "0",
      secondGradePairs: form.secondGradePairs || "0",
      secondGradeGrams: form.secondGradeGrams || "0",
      date: new Date().toLocaleDateString("ar-SA"),
    };

    let newEntries: ProductionEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }

    await saveEntries(newEntries);
    resetForm();
    setShowForm(false);
    Alert.alert("نجاح", editingEntry ? "تم تعديل البيانات بنجاح" : "تم حفظ البيانات بنجاح");
  };

  const handleEdit = (entry: ProductionEntry) => {
    setForm({
      machineNumber: entry.machineNumber,
      productionDozen: entry.productionDozen,
      productionPairs: entry.productionPairs,
      wasteThreadGrams: entry.wasteThreadGrams,
      wasteSocksGrams: entry.wasteSocksGrams,
      secondGradePairs: entry.secondGradePairs,
      secondGradeGrams: entry.secondGradeGrams,
    });
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: ProductionEntry) => {
    Alert.alert("تأكيد الحذف", "هل أنت متأكد من حذف هذا السجل؟", [
      { text: "إلغاء" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const newEntries = entries.filter((e) => e.id !== entry.id);
          await saveEntries(newEntries);
          Alert.alert("نجاح", "تم حذف السجل بنجاح");
        },
      },
    ]);
  };

  const renderFormField = (label: string, key: keyof typeof form, placeholder: string) => (
    <View className="mb-4">
      <Text className="text-foreground font-semibold text-sm mb-2 text-right">{label}</Text>
      <TextInput
        className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={form[key]}
        onChangeText={(text) => setForm({ ...form, [key]: text })}
        keyboardType="numeric"
      />
    </View>
  );

  const renderEntry = ({ item }: { item: ProductionEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => handleEdit(item)} style={{ backgroundColor: `${colors.primary}20`, borderRadius: 20, padding: 6 }}>
            <MaterialIcons name="edit" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={{ backgroundColor: "#ef444420", borderRadius: 20, padding: 6 }}>
            <MaterialIcons name="delete" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-primary font-bold text-base">مكينة رقم {item.machineNumber}</Text>
          <MaterialIcons name="precision-manufacturing" size={20} color={colors.primary} />
        </View>
      </View>

      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between mb-2">
          <Text className="text-foreground font-semibold">{item.productionDozen} درزن / {item.productionPairs} زوج</Text>
          <Text className="text-muted text-sm">كمية الإنتاج</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-error font-semibold">{item.wasteThreadGrams} جرام</Text>
          <Text className="text-muted text-sm">هدر خيوط</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-error font-semibold">{item.wasteSocksGrams} جرام</Text>
          <Text className="text-muted text-sm">هدر جوارب تالفة</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-warning font-semibold">{item.secondGradePairs} زوج / {item.secondGradeGrams} جرام</Text>
          <Text className="text-muted text-sm">النخب الثاني</Text>
        </View>
      </View>

      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-5 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { setShowForm(true); resetForm(); }} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">الإنتاج</Text>
          <Text className="text-white/80 text-sm mt-1">رقم المكينة - كمية الإنتاج - الهدر - النخب الثاني</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {showForm ? (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="bg-surface rounded-xl p-5 border border-border">
            <Text className="text-foreground font-bold text-lg mb-4 text-right">
              {editingEntry ? "تعديل بيانات الإنتاج" : "إدخال بيانات إنتاج جديدة"}
            </Text>

            {renderFormField("رقم المكينة", "machineNumber", "أدخل رقم المكينة")}
            {renderFormField("كمية الإنتاج (درزن)", "productionDozen", "أدخل الكمية بالدرزن")}
            {renderFormField("كمية الإنتاج (زوج)", "productionPairs", "أدخل الكمية بالزوج")}
            {renderFormField("كمية الهدر خيوط (جرام)", "wasteThreadGrams", "أدخل وزن هدر الخيوط بالجرام")}
            {renderFormField("كمية الهدر جوارب تالفة (جرام)", "wasteSocksGrams", "أدخل وزن الجوارب التالفة بالجرام")}
            {renderFormField("النخب الثاني (زوج)", "secondGradePairs", "أدخل عدد أزواج النخب الثاني")}
            {renderFormField("النخب الثاني (جرام)", "secondGradeGrams", "أدخل وزن النخب الثاني بالجرام")}

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} className="flex-1 bg-border rounded-lg py-3 items-center">
                <Text className="text-foreground font-semibold">إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} className="flex-1 bg-primary rounded-lg py-3 items-center">
                <Text className="text-white font-semibold">{editingEntry ? "تعديل" : "حفظ"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <MaterialIcons name="inventory" size={56} color={colors.muted} />
              <Text className="text-muted text-lg mt-4 font-semibold">لا توجد بيانات إنتاج</Text>
              <Text className="text-muted text-sm mt-2">اضغط + لإضافة بيانات جديدة</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
