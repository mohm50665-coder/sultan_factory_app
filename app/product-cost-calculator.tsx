import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ColorEntry {
  color: string;
  code: string;
}

interface ThreadData {
  type: string;
  weight: number;
  colors: ColorEntry[];
}

interface ProductCostData {
  id: string;
  date: string;
  productName: string;
  productColor: string;
  threads: {
    cotton: ThreadData;
    bamboo: ThreadData;
    nylon: ThreadData;
    span: ThreadData;
    spandex: ThreadData;
    rubber: ThreadData;
  };
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = "product_cost_calculations";

const createEmptyColors = (): ColorEntry[] => [
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
];

export default function ProductCostCalculatorScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<ProductCostData, "id" | "createdAt">>({
    date: new Date().toISOString().split("T")[0],
    productName: "",
    productColor: "",
    threads: {
      cotton: { type: "قطن", weight: 0, colors: createEmptyColors() },
      bamboo: { type: "بامبو", weight: 0, colors: createEmptyColors() },
      nylon: { type: "نايلون", weight: 0, colors: createEmptyColors() },
      span: { type: "إسبان", weight: 0, colors: createEmptyColors() },
      spandex: { type: "إسباندكس", weight: 0, colors: createEmptyColors() },
      rubber: { type: "مطاط", weight: 0, colors: createEmptyColors() },
    },
    notes: "",
  });

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSave = async () => {
    if (!formData.productName.trim()) {
      showAlert(
        isAr ? "تنبيه" : "Alert",
        isAr ? "الرجاء إدخال اسم المنتج" : "Please enter product name"
      );
      return;
    }

    setIsLoading(true);
    try {
      // Get existing data
      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const calculations: ProductCostData[] = existingData ? JSON.parse(existingData) : [];

      // Create new entry
      const newEntry: ProductCostData = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString(),
      };

      calculations.push(newEntry);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(calculations));

      showAlert(
        isAr ? "نجاح" : "Success",
        isAr ? "تم حفظ بيانات تكاليف المنتج بنجاح" : "Product cost data saved successfully"
      );
      router.back();
    } catch (error) {
      console.error("Error saving:", error);
      showAlert(
        isAr ? "خطأ" : "Error",
        isAr ? "حدث خطأ في حفظ البيانات" : "Error saving data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateThreadWeight = (threadKey: keyof typeof formData.threads, weight: number) => {
    setFormData((prev) => ({
      ...prev,
      threads: {
        ...prev.threads,
        [threadKey]: { ...prev.threads[threadKey], weight },
      },
    }));
  };

  const updateThreadColor = (
    threadKey: keyof typeof formData.threads,
    colorIndex: number,
    field: "color" | "code",
    value: string
  ) => {
    setFormData((prev) => {
      const newColors = [...prev.threads[threadKey].colors];
      newColors[colorIndex] = { ...newColors[colorIndex], [field]: value };
      return {
        ...prev,
        threads: {
          ...prev.threads,
          [threadKey]: { ...prev.threads[threadKey], colors: newColors },
        },
      };
    });
  };

  const renderThreadSection = (
    threadKey: keyof typeof formData.threads,
    threadLabel: string,
    threadArabic: string,
    iconColor: string
  ) => {
    const thread = formData.threads[threadKey];

    return (
      <View
        key={threadKey}
        style={[
          styles.threadSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Thread Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={[styles.threadIcon, { backgroundColor: iconColor + "20" }]}>
            <MaterialIcons name="texture" size={18} color={iconColor} />
          </View>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginLeft: 8 }}>
            {isAr ? threadArabic : threadLabel}
          </Text>
        </View>

        {/* Weight */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
            {isAr ? "الوزن (جرام)" : "Weight (grams)"}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
            ]}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            value={thread.weight === 0 ? "" : thread.weight.toString()}
            onChangeText={(text) => updateThreadWeight(threadKey, parseInt(text) || 0)}
          />
        </View>

        {/* Colors Table Header */}
        <View style={[styles.colorTableHeader, { backgroundColor: colors.primary + "10", borderColor: colors.border }]}>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 0.5 }]}>#</Text>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 2 }]}>
            {isAr ? "اللون" : "Color"}
          </Text>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 2 }]}>
            {isAr ? "كود الخيط" : "Thread Code"}
          </Text>
        </View>

        {/* 5 Color Rows */}
        {thread.colors.map((colorEntry, index) => (
          <View
            key={index}
            style={[styles.colorRow, { borderColor: colors.border }]}
          >
            <Text style={[styles.colorRowNum, { color: colors.muted }]}>{index + 1}</Text>
            <TextInput
              style={[
                styles.colorInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? `لون ${index + 1}` : `Color ${index + 1}`}
              placeholderTextColor={colors.muted + "80"}
              value={colorEntry.color}
              onChangeText={(text) => updateThreadColor(threadKey, index, "color", text)}
            />
            <TextInput
              style={[
                styles.colorInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? `كود ${index + 1}` : `Code ${index + 1}`}
              placeholderTextColor={colors.muted + "80"}
              value={colorEntry.code}
              onChangeText={(text) => updateThreadColor(threadKey, index, "code", text)}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ marginRight: 12, opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons
              name={isRtl ? "chevron-right" : "chevron-left"}
              size={28}
              color="white"
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
              {isAr ? "حساب تكاليف منتج جديد" : "New Product Cost"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
              {isAr ? "أدخل بيانات الخيوط والألوان" : "Enter thread and color data"}
            </Text>
          </View>
        </View>
      </View>

      {/* Form */}
      <ScrollView style={styles.form} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Basic Info Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 16 }}>
            {isAr ? "البيانات الأساسية" : "Basic Information"}
          </Text>

          {/* Date */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "التاريخ" : "Date"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              value={formData.date}
              onChangeText={(text) => setFormData({ ...formData, date: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Product Name */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "اسم المنتج *" : "Product Name *"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? "أدخل اسم المنتج" : "Enter product name"}
              placeholderTextColor={colors.muted}
              value={formData.productName}
              onChangeText={(text) => setFormData({ ...formData, productName: text })}
            />
          </View>

          {/* Product Color */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "لون المنتج" : "Product Color"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? "أدخل لون المنتج" : "Enter product color"}
              placeholderTextColor={colors.muted}
              value={formData.productColor}
              onChangeText={(text) => setFormData({ ...formData, productColor: text })}
            />
          </View>
        </View>

        {/* Thread Sections Title */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 12 }}>
          <MaterialIcons name="format-list-bulleted" size={20} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginLeft: 8 }}>
            {isAr ? "تفاصيل أوزان الخيوط المستخدمة وبياناتها" : "Thread Weights & Details"}
          </Text>
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
          {isAr ? "لكل نوع خيط يمكن إضافة حتى 5 ألوان مختلفة مع أكوادها" : "Each thread type supports up to 5 different colors with codes"}
        </Text>

        {/* Thread Sections */}
        {renderThreadSection("cotton", "Cotton", "قطن", "#4CAF50")}
        {renderThreadSection("bamboo", "Bamboo", "بامبو", "#8BC34A")}
        {renderThreadSection("nylon", "Nylon", "نايلون", "#2196F3")}
        {renderThreadSection("span", "Span", "إسبان", "#FF9800")}
        {renderThreadSection("spandex", "Spandex", "إسباندكس", "#9C27B0")}
        {renderThreadSection("rubber", "Rubber", "مطاط", "#795548")}

        {/* Notes */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "ملاحظات إضافية" : "Additional Notes"}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                minHeight: 80,
                textAlignVertical: "top",
                textAlign: isRtl ? "right" : "left",
              },
            ]}
            placeholder={isAr ? "أضف ملاحظات إضافية..." : "Add additional notes..."}
            placeholderTextColor={colors.muted}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            multiline
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <MaterialIcons name="save" size={22} color="white" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                {isAr ? "حفظ البيانات" : "Save Data"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  threadSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  threadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  colorTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  colorHeaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  colorRowNum: {
    width: 20,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  colorInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 32,
  },
});
