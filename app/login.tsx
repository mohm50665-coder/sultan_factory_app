import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) newErrors.email = "البريد الإلكتروني مطلوب";
    if (!password) newErrors.password = "كلمة المرور مطلوبة";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("خطأ", "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-8">
          {/* العنوان */}
          <View className="mb-12 items-center">
            <Text className="text-4xl font-bold text-white mb-2">مصنع السلطان</Text>
            <Text className="text-sm text-white/80">نظام متابعة أداء المصنع</Text>
          </View>

          {/* نموذج تسجيل الدخول */}
          <View className="bg-white rounded-2xl p-6 shadow-lg">
            {/* حقل البريد الإلكتروني */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">
                البريد الإلكتروني
              </Text>
              <TextInput
                className={`border rounded-lg px-4 py-3 text-foreground ${
                  errors.email ? "border-error" : "border-border"
                }`}
                placeholder="أدخل بريدك الإلكتروني"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              {errors.email && (
                <Text className="text-error text-xs mt-1">{errors.email}</Text>
              )}
            </View>

            {/* حقل كلمة المرور */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">
                كلمة المرور
              </Text>
              <TextInput
                className={`border rounded-lg px-4 py-3 text-foreground ${
                  errors.password ? "border-error" : "border-border"
                }`}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                secureTextEntry
                editable={!isLoading}
              />
              {errors.password && (
                <Text className="text-error text-xs mt-1">{errors.password}</Text>
              )}
            </View>

            {/* زر تسجيل الدخول */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              className="bg-primary rounded-lg py-3 mb-4"
              style={{ opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-center">
                  تسجيل الدخول
                </Text>
              )}
            </TouchableOpacity>

            {/* رابط نسيان كلمة المرور */}
            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              className="mb-4"
            >
              <Text className="text-primary text-center font-semibold text-sm">
                هل نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>

            {/* فاصل */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted text-xs mx-2">أو</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* رابط التسجيل الجديد */}
            <View className="flex-row justify-center">
              <Text className="text-muted text-sm">ليس لديك حساب؟ </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text className="text-primary font-semibold text-sm">
                  إنشاء حساب جديد
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* معلومات إضافية */}
          <View className="mt-8 items-center">
            <Text className="text-white/60 text-xs text-center">
              جميع الحقوق محفوظة © 2026 مصنع السلطان
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
