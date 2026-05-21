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
import { MaterialIcons } from "@expo/vector-icons";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("البريد الإلكتروني مطلوب");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Alert.alert(
        "نجاح",
        "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
      );
      router.replace("/login");
    } catch (err) {
      Alert.alert("خطأ", "فشل إرسال رابط إعادة التعيين");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-8 flex-row items-center"
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text className="text-white font-semibold ml-2">العودة</Text>
          </TouchableOpacity>

          <View className="mb-12">
            <Text className="text-3xl font-bold text-white mb-2">
              إعادة تعيين كلمة المرور
            </Text>
            <Text className="text-sm text-white/80">
              أدخل بريدك الإلكتروني لاستقبال رابط إعادة التعيين
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-6 shadow-lg">
            <View className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-2">
                البريد الإلكتروني
              </Text>
              <TextInput
                className={`border rounded-lg px-4 py-3 text-foreground ${
                  error ? "border-error" : "border-border"
                }`}
                placeholder="أدخل بريدك الإلكتروني"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              {error && (
                <Text className="text-error text-xs mt-1">{error}</Text>
              )}
            </View>

            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={isLoading}
              className="bg-primary rounded-lg py-3"
              style={{ opacity: isLoading ? 0.6 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold text-center">
                  إرسال رابط إعادة التعيين
                </Text>
              )}
            </TouchableOpacity>

            <View className="mt-6 bg-blue/10 rounded-lg p-4 border border-border">
              <Text className="text-foreground font-semibold text-sm mb-2">
                ملاحظة
              </Text>
              <Text className="text-muted text-xs leading-5">
                سيتم إرسال رابط آمن إلى بريدك الإلكتروني. انقر على الرابط لإعادة تعيين كلمة المرور.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
