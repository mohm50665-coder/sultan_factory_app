import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface ManufacturingStage {
  id: string;
  label: string;
  icon: string;
  color: string;
  workers: string[];
}

const STAGES: ManufacturingStage[] = [
  {
    id: "machines",
    label: "إنتاج المكائن",
    icon: "precision-manufacturing",
    color: "#0a7ea4",
    workers: ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق"],
  },
  {
    id: "rosso",
    label: "الروسو",
    icon: "loop",
    color: "#7c3aed",
    workers: ["فريدو", "قيوم"],
  },
  {
    id: "qalb",
    label: "القلب",
    icon: "flip",
    color: "#059669",
    workers: ["حسين السوري"],
  },
  {
    id: "kawiya",
    label: "الكاوية",
    icon: "local-fire-department",
    color: "#dc2626",
    workers: ["جنيد"],
  },
  {
    id: "inspection",
    label: "الفحص",
    icon: "search",
    color: "#d97706",
    workers: ["عارف", "انام الدين"],
  },
  {
    id: "packing",
    label: "التغليف",
    icon: "inventory-2",
    color: "#2563eb",
    workers: ["محمد عمر", "غلام", "بشير"],
  },
  {
    id: "antislip",
    label: "مانع الانزلاق",
    icon: "layers",
    color: "#0891b2",
    workers: ["محمد عمر", "مرتضى", "أوجيل"],
  },
  {
    id: "storage",
    label: "التخزين",
    icon: "warehouse",
    color: "#4f46e5",
    workers: ["شميم"],
  },
];

export default function ManufacturingScreen() {
  const router = useRouter();
  const colors = useColors();

  const handleStagePress = (stageId: string) => {
    router.push(`/manufacturing-stage?stage=${stageId}` as any);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-5 flex-row items-center justify-between">
        <View className="w-10" />
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">مراحل التصنيع</Text>
          <Text className="text-white/80 text-sm mt-1">اختر مرحلة لعرض وإدخال بيانات العمال</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {STAGES.map((stage) => (
          <TouchableOpacity
            key={stage.id}
            onPress={() => handleStagePress(stage.id)}
            className="bg-surface rounded-xl p-4 mb-3 border border-border"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
              <View className="flex-1 mr-3">
                <Text className="text-foreground font-bold text-base text-right">{stage.label}</Text>
                <Text className="text-muted text-xs mt-1 text-right">
                  العمال: {stage.workers.join("، ")}
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
