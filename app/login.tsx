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
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) newErrors.email = "البريد الإلكتروني مطلوب";
    if (!formData.password) newErrors.password = "كلمة المرور مطلوبة";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل تسجيل الدخول";
      Alert.alert("خطأ", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      await login("admin@sultan.com", "123456");
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("خطأ", "فشل الدخول التجريبي");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-8">
          <View className="mb-12 items-center">
            <Text className="text-4xl font-bold text-white mb-2">مصنع السلطان</Text>
            <Text className="text-sm text-white/80">نظام متابعة أداء المصنع</Text>
          </View>

          <View className="bg-white rounded-2xl p-6 shadow-lg">
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
                value={formData.email}
                onChangeText={(text) => {
                  setFormData({ ...formData, email: text });
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
                value={formData.password}
                onChangeText={(text) => {
                  setFormData({ ...formData, password: text });
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                secureTextEntry
                editable={!isLoading}
              />
              {errors.password && (
                <Text className="text-error text-xs mt-1">{errors.password}</Text>
              )}
            </View>

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

            <TouchableOpacity
              onPress={handleDemoLogin}
              disabled={isLoading}
              className="border border-primary rounded-lg py-3 mb-4"
            >
              <Text className="text-primary text-center font-semibold text-sm">
                دخول تجريبي
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              className="mb-4"
            >
              <Text className="text-primary text-center font-semibold text-sm">
                هل نسيت كلمة المرور؟
              </Text>
            </TouchableOpacity>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-muted text-xs mx-2">أو</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <View className="flex-row justify-center">
              <Text className="text-muted text-sm">ليس لديك حساب؟ </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text className="text-primary font-semibold text-sm">
                  إنشاء حساب جديد
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-8 p-4 bg-white/10 rounded-lg">
            <Text className="text-white text-xs text-center">
              بيانات الدخول التجريبي:{"\n"}
              البريد: admin@sultan.com{"\n"}
              كلمة المرور: 123456
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
