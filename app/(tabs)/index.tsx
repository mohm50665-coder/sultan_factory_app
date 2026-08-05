import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

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

          {/* Logout Button */}
          <View className="items-center">
            <TouchableOpacity 
              className="bg-error px-6 py-3 rounded-full active:opacity-80"
              onPress={() => router.replace("/login")}
            >
              <Text className="text-background font-semibold">تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
