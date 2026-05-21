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

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    position: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "الاسم مطلوب";
    if (!formData.position.trim()) newErrors.position = "المنصب مطلوب";
    if (!formData.phone.trim()) newErrors.phone = "رقم الجوال مطلوب";
    if (!formData.email.trim()) newErrors.email = "البريد الإلكتروني مطلوب";
    if (!formData.password) newErrors.password = "كلمة المرور مطلوبة";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "كلمات المرور غير متطابقة";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register(
        formData.name,
        formData.email,
        formData.phone,
        formData.position,
        formData.password
      );

      Alert.alert("نجاح", "تم التسجيل بنجاح!");
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل التسجيل. حاول مرة أخرى.";
      Alert.alert("خطأ", message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    label: string,
    key: keyof typeof formData,
    placeholder: string,
    keyboardType: any = "default",
    secureTextEntry: boolean = false
  ) => (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-foreground mb-2">{label}</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-foreground ${
          errors[key] ? "border-error" : "border-border"
        }`}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={formData[key]}
        onChangeText={(text) => {
          setFormData({ ...formData, [key]: text });
          if (errors[key]) {
            setErrors({ ...errors, [key]: "" });
          }
        }}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={!isLoading}
      />
      {errors[key] && (
        <Text className="text-error text-xs mt-1">{errors[key]}</Text>
      )}
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-8">
          <View className="mb-12 items-center">
            <Text className="text-3xl font-bold text-white mb-2">تسجيل جديد</Text>
            <Text className="text-sm text-white/80 text-center">
              أنشئ حسابك للبدء في استخدام التطبيق
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-6 shadow-lg">
            {renderInput("الاسم الكامل", "name", "أدخل اسمك الكامل")}
            {renderInput("المنصب", "position", "أدخل منصبك الوظيفي")}
            {renderInput("رقم الجوال", "phone", "أدخل رقم جوالك", "phone-pad")}
            {renderInput("البريد الإلكتروني", "email", "أدخل بريدك الإلكتروني", "email-address")}
            {renderInput("كلمة المرور", "password", "أدخل كلمة المرور", "default", true)}
            {renderInput(
              "تأكيد كلمة المرور",
              "confirmPassword",
              "أعد إدخال كلمة المرور",
              "default",
              true
            )}

            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              className="bg-primary rounded-lg py-3 mt-6"
              style={{ opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-center">إنشاء الحساب</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row justify-center mt-4">
              <Text className="text-muted text-sm">لديك حساب بالفعل؟ </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text className="text-primary font-semibold text-sm">تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
