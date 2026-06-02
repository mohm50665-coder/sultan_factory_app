import React from "react";
import { BackButton } from "@/components/back-button";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";

interface ManufacturingStage {
  id: string;
  label: string;
  icon: string;
  color: string;
  workers: string[];
}

export default function ManufacturingScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();

  const STAGES: ManufacturingStage[] = [
    {
      id: "machines",
      label: isAr ? "إنتاج المكائن" : "Machine Production",
      icon: "precision-manufacturing",
      color: "#0a7ea4",
      workers: isAr ? ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق"] : ["Rana", "Mohammed Ahmed", "Afzal", "Atallah", "Shafiq"],
    },
    {
      id: "rosso",
      label: isAr ? "الروسو" : "Rosso",
      icon: "loop",
      color: "#7c3aed",
      workers: isAr ? ["فريدو", "قيوم"] : ["Fredo", "Qayyum"],
    },
    {
      id: "qalb",
      label: isAr ? "القلب" : "Turning",
      icon: "flip",
      color: "#059669",
      workers: isAr ? ["حسين السوري"] : ["Hussein Al-Suri"],
    },
    {
      id: "kawiya",
      label: isAr ? "الكاوية" : "Ironing",
      icon: "local-fire-department",
      color: "#dc2626",
      workers: isAr ? ["جنيد"] : ["Junaid"],
    },
    {
      id: "inspection",
      label: isAr ? "الفحص" : "Inspection",
      icon: "search",
      color: "#d97706",
      workers: isAr ? ["عارف", "انام الدين"] : ["Aref", "Anamuddin"],
    },
    {
      id: "packing",
      label: isAr ? "التغليف" : "Packing",
      icon: "inventory-2",
      color: "#2563eb",
      workers: isAr ? ["محمد عمر", "غلام", "بشير"] : ["Mohammed Omar", "Ghulam", "Bashir"],
    },
    {
      id: "antislip",
      label: isAr ? "مانع الانزلاق" : "Anti-slip",
      icon: "layers",
      color: "#0891b2",
      workers: isAr ? ["محمد عمر", "مرتضى", "أوجيل"] : ["Mohammed Omar", "Murtadha", "Ogil"],
    },
    {
      id: "storage",
      label: isAr ? "التخزين" : "Storage",
      icon: "warehouse",
      color: "#4f46e5",
      workers: isAr ? ["شميم"] : ["Shamim"],
    },
  ];

  const handleStagePress = (stageId: string) => {
    router.push(`/manufacturing-stage?stage=${stageId}` as any);
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AdminBadgeIcon />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "مراحل التصنيع" : "Manufacturing Stages"}</Text>
          <Text style={{ fontSize: 14, marginTop: 4 }}>{isAr ? "اختر مرحلة لعرض وإدخال بيانات العمال" : "Select a stage to view and enter workers data"}</Text>
        </View>
        <BackButton />
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
        {STAGES.map((stage) => (
          <TouchableOpacity
            key={stage.id}
            onPress={() => handleStagePress(stage.id)}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>{stage.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' }}>
                  {isAr ? "العمال: " : "Workers: "}{stage.workers.join(isAr ? "، " : ", ")}
                </Text>
              </View>
              <View style={{ backgroundColor: `${stage.color}20`, borderRadius: 12, padding: 12 }}>
                <MaterialIcons name={stage.icon as any} size={26} color={stage.color} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
