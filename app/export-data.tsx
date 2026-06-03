import React, { useState } from "react";
import { BackButton } from "@/components/back-button";
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
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, flexDirection: 'row', alignItems: 'center' }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>تصدير البيانات</Text>
            <Text style={{ fontSize: 14, marginTop: 4 }}>
              اختر الأقسام والصيغة المطلوبة
            </Text>
          </View>
        </View>

        <View style={{ padding: 24 }}>
          {/* اختيار صيغة التصدير */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16, marginBottom: 12 }}>
              صيغة التصدير
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(["json", "html", "csv"] as const).map((format) => (
                <TouchableOpacity
                  key={format}
                  onPress={() => setExportFormat(format)}
                  style={{ flex: 1, borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }}
                >
                  <Text
                    style={{ fontWeight: '600', fontSize: 14 }}
                  >
                    {format.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* اختيار الأقسام */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>
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
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                  {sections.every((s) => s.selected)
                    ? "إلغاء الكل"
                    : "تحديد الكل"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              {sections.map((section, index) => (
                <View
                  key={section.id}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <MaterialIcons
                      name={section.icon as any}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
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
          <View style={{ borderRadius: 8, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <MaterialIcons name="info" size={20} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 4 }}>
                  معلومات التصدير
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
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
            style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center' }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="download" size={20} color="white" />
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>
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
