import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { exportService } from "@/lib/services/export.service";

interface ExportSection {
  id: string;
  label: string;
  storageKey: string;
  icon: string;
  selected: boolean;
}

export default function ExportDataScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "html" | "csv">(
    "json"
  );
  const [sections, setSections] = useState<ExportSection[]>([
    {
      id: "production",
      label: "الإنتاج",
      storageKey: "sultan_production_data_v2",
      icon: "factory",
      selected: true,
    },
    {
      id: "manufacturing",
      label: "مراحل التصنيع",
      storageKey: "sultan_manufacturing_machines",
      icon: "precision-manufacturing",
      selected: true,
    },
    {
      id: "sales",
      label: "المبيعات",
      storageKey: "sultan_sales_data",
      icon: "shopping-cart",
      selected: true,
    },
    {
      id: "collection",
      label: "التحصيل",
      storageKey: "sultan_collection_data",
      icon: "attach-money",
      selected: true,
    },
    {
      id: "warehouse",
      label: "المستودعات",
      storageKey: "sultan_warehouse_raw",
      icon: "warehouse",
      selected: true,
    },
    {
      id: "maintenance",
      label: "الصيانة",
      storageKey: "sultan_maintenance_periodic",
      icon: "build",
      selected: true,
    },
    {
      id: "administrative",
      label: "الإجراءات الإدارية",
      storageKey: "sultan_administrative_data",
      icon: "assignment",
      selected: true,
    },
    {
      id: "financial",
      label: "الشؤون المالية",
      storageKey: "sultan_expenses",
      icon: "account-balance",
      selected: true,
    },
    {
      id: "tasks",
      label: "المهام",
      storageKey: "tasks_entries",
      icon: "checklist",
      selected: true,
    },
  ]);

  const toggleSection = (id: string) => {
    setSections(
      sections.map((section) =>
        section.id === id ? { ...section, selected: !section.selected } : section
      )
    );
  };

  const handleExport = async () => {
    try {
      const selectedSections = sections.filter((s) => s.selected);

      if (selectedSections.length === 0) {
        Alert.alert("خطأ", "الرجاء اختيار قسم واحد على الأقل");
        return;
      }

      setIsLoading(true);

      const storageKeys = selectedSections.map((s) => s.storageKey);
      const fileUri = await exportService.createComprehensiveReport(
        storageKeys,
        exportFormat as "json" | "html",
        {
          title: "تقرير مصنع السلطان",
        }
      );

      Alert.alert(
        "نجاح",
        `تم تصدير البيانات بنجاح.\nالملف محفوظ في: ${fileUri}`
      );
    } catch (error) {
      Alert.alert("خطأ", "فشل في تصدير البيانات");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1">
        {/* رأس الصفحة */}
        <View className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-bold text-xl">تصدير البيانات</Text>
            <Text className="text-white/80 text-sm mt-1">
              اختر الأقسام والصيغة المطلوبة
            </Text>
          </View>
        </View>

        <View className="p-6">
          {/* اختيار صيغة التصدير */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold text-base mb-3">
              صيغة التصدير
            </Text>
            <View className="flex-row gap-2">
              {(["json", "html", "csv"] as const).map((format) => (
                <TouchableOpacity
                  key={format}
                  onPress={() => setExportFormat(format)}
                  className={`flex-1 rounded-lg p-3 items-center justify-center border ${
                    exportFormat === format
                      ? "bg-primary border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <Text
                    className={`font-semibold text-sm ${
                      exportFormat === format
                        ? "text-white"
                        : "text-foreground"
                    }`}
                  >
                    {format.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* اختيار الأقسام */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold text-base">
                الأقسام
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const allSelected = sections.every((s) => s.selected);
                  setSections(
                    sections.map((s) => ({
                      ...s,
                      selected: !allSelected,
                    }))
                  );
                }}
              >
                <Text className="text-primary text-sm font-semibold">
                  {sections.every((s) => s.selected)
                    ? "إلغاء الكل"
                    : "تحديد الكل"}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="bg-surface rounded-lg overflow-hidden border border-border">
              {sections.map((section, index) => (
                <View
                  key={section.id}
                  className={`flex-row items-center justify-between p-4 ${
                    index !== sections.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons
                      name={section.icon as any}
                      size={20}
                      color={colors.primary}
                    />
                    <Text className="text-foreground font-semibold text-sm ml-3">
                      {section.label}
                    </Text>
                  </View>
                  <Switch
                    value={section.selected}
                    onValueChange={() => toggleSection(section.id)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={section.selected ? colors.primary : colors.muted}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* معلومات التصدير */}
          <View className="bg-blue/10 rounded-lg p-4 mb-6 border border-border">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color={colors.primary} />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold text-sm mb-1">
                  معلومات التصدير
                </Text>
                <Text className="text-muted text-xs leading-5">
                  سيتم تصدير جميع البيانات المحفوظة في الأقسام المختارة بالصيغة
                  المحددة. يمكنك العثور على الملف في مجلد المستندات.
                </Text>
              </View>
            </View>
          </View>

          {/* زر التصدير */}
          <TouchableOpacity
            onPress={handleExport}
            disabled={isLoading}
            className="bg-primary rounded-lg p-4 items-center justify-center"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center">
                <MaterialIcons name="download" size={20} color="white" />
                <Text className="text-white font-semibold text-base ml-2">
                  تصدير البيانات
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
