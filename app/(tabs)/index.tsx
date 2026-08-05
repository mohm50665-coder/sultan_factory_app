import { ScrollView, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";

export default function HomeScreen() {
  const { user } = useAuth();

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-8">
          {/* Hero Section */}
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground">مرحباً</Text>
            <Text className="text-base text-muted text-center">
              {user?.name || "المستخدم"}
            </Text>
          </View>

          {/* Info Card */}
          <View className="w-full bg-surface rounded-2xl p-6 shadow-sm border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">تم تسجيل الدخول بنجاح</Text>
            <Text className="text-sm text-muted leading-relaxed">
              استخدم الأيقونات في أسفل الشاشة للتنقل بين الأقسام المختلفة.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
