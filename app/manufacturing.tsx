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
}

const STAGES: ManufacturingStage[] = [
  { id: "machines", label: "إنتاج المكائن", icon: "precision-manufacturing", color: "#0a7ea4" },
  { id: "rosso", label: "الروسو", icon: "loop", color: "#7c3aed" },
  { id: "qalb", label: "القلب", icon: "flip", color: "#059669" },
  { id: "kawiya", label: "الكاوية", icon: "local-fire-department", color: "#dc2626" },
  { id: "inspection", label: "الفحص", icon: "search", color: "#d97706" },
  { id: "packing", label: "التغليف", icon: "inventory-2", color: "#2563eb" },
  { id: "storage", label: "التخزين", icon: "warehouse", color: "#4f46e5" },
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
          <Text className="text-white/80 text-sm mt-1">اختر مرحلة لعرض بيانات العمال</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        {STAGES.map((stage) => (
          <TouchableOpacity
            key={stage.id}
            onPress={() => handleStagePress(stage.id)}
            className="bg-surface rounded-xl p-5 mb-4 border border-border"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
              <View className="flex-1 mr-4">
                <Text className="text-foreground font-bold text-lg text-right">{stage.label}</Text>
              </View>
              <View style={{ backgroundColor: `${stage.color}20`, borderRadius: 14, padding: 14 }}>
                <MaterialIcons name={stage.icon as any} size={30} color={stage.color} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
