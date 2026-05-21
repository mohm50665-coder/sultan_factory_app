import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface MaintenanceTab {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const MAINTENANCE_TABS: MaintenanceTab[] = [
  {
    id: "maintained",
    label: "الأجهزة المصانة",
    icon: "build",
    description: "تسجيل الأجهزة التي تمت صيانتها",
    color: "#16a34a",
  },
  {
    id: "stopped",
    label: "الأجهزة المتوقفة",
    icon: "error",
    description: "تسجيل الأجهزة المتعطلة والمتوقفة",
    color: "#dc2626",
  },
  {
    id: "recommendations",
    label: "توصيات الصيانة",
    icon: "lightbulb",
    description: "إضافة توصيات الصيانة الوقائية",
    color: "#ea580c",
  },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const colors = useColors();

  const handleTabPress = (tabId: string) => {
    router.push(`/maintenance/${tabId}` as any);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-4 flex-row justify-between items-center">
        <View>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text className="text-white font-bold text-lg">الصيانة</Text>
        <View className="w-10" />
      </View>

      {/* محتوى التبويبات */}
      <ScrollView className="flex-1 p-4">
        {MAINTENANCE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleTabPress(tab.id)}
            className="bg-white rounded-lg p-4 mb-4 border border-border overflow-hidden"
            activeOpacity={0.7}
          >
            <View className="absolute top-0 right-0 w-1 h-full" style={{ backgroundColor: tab.color }} />
            <View className="flex-row items-center">
              <View className="rounded-lg p-3 mr-4" style={{ backgroundColor: `${tab.color}20` }}>
                <MaterialIcons name={tab.icon as any} size={24} color={tab.color} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-bold text-base">{tab.label}</Text>
                <Text className="text-muted text-xs mt-1">{tab.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </View>
          </TouchableOpacity>
        ))}

        {/* معلومات إضافية */}
        <View className="bg-warning/10 rounded-lg p-4 mt-4 border border-border">
          <Text className="text-foreground font-semibold text-sm mb-2">إرشادات الصيانة</Text>
          <Text className="text-muted text-xs leading-5">
            • سجل جميع عمليات الصيانة بالتفصيل{"\n"}
            • أضف توصيات الصيانة الوقائية{"\n"}
            • تابع الأجهزة المتعطلة والمتوقفة{"\n"}
            • حدد إجراءات الحل بوضوح
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
