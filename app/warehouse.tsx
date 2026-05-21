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

interface WarehouseTab {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const WAREHOUSE_TABS: WarehouseTab[] = [
  {
    id: "raw_materials",
    label: "المواد الخام",
    icon: "inventory-2",
    description: "إدارة المواد الخام والمدخلات",
  },
  {
    id: "consumption",
    label: "مواد الصرف",
    icon: "trending-down",
    description: "تسجيل مواد الصرف والاستهلاك",
  },
  {
    id: "incoming",
    label: "المواد المدخلة",
    icon: "input",
    description: "تسجيل المواد الجديدة المدخلة",
  },
];

export default function WarehouseScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedTab, setSelectedTab] = useState<string>("raw_materials");

  const handleTabPress = (tabId: string) => {
    setSelectedTab(tabId);
    // يمكن إضافة ملاحة إلى شاشات فرعية هنا
    router.push(`/warehouse/${tabId}`);
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
        <Text className="text-white font-bold text-lg">المستودعات</Text>
        <View className="w-10" />
      </View>

      {/* محتوى التبويبات */}
      <ScrollView className="flex-1 p-4">
        {WAREHOUSE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handleTabPress(tab.id)}
            className="bg-white rounded-lg p-4 mb-4 border border-border"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="bg-primary/10 rounded-lg p-3 mr-4">
                <MaterialIcons name={tab.icon as any} size={24} color={colors.primary} />
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
        <View className="bg-blue/10 rounded-lg p-4 mt-4 border border-border">
          <Text className="text-foreground font-semibold text-sm mb-2">ملاحظة مهمة</Text>
          <Text className="text-muted text-xs leading-5">
            يمكنك إدارة جميع عمليات المستودع من خلال التبويبات أعلاه. تتبع المواد الخام والمدخلة والمصروفة بسهولة.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
