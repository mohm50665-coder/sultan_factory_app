import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) newErrors.username = "اسم المستخدم مطلوب";
    if (!formData.password) newErrors.password = "كلمة المرور مطلوبة";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login(formData.username, formData.password);
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
      await login("admin", "123456");
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
          {/* الشعار */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <MaterialIcons name="factory" size={40} color="#0a7ea4" />
            </View>
            <Text style={styles.logoTitle}>مصنع السلطان</Text>
            <Text style={styles.logoSubtitle}>نظام متابعة أداء المصنع</Text>
          </View>

          {/* نموذج تسجيل الدخول */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>اسم المستخدم</Text>
              <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أدخل اسم المستخدم"
                  placeholderTextColor={colors.muted}
                  value={formData.username}
                  onChangeText={(text) => {
                    setFormData({ ...formData, username: text });
                    if (errors.username) setErrors({ ...errors, username: "" });
                  }}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <MaterialIcons name="person" size={20} color={colors.muted} />
              </View>
              {errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
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
                <MaterialIcons name="lock" size={20} color={colors.muted} />
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* زر تسجيل الدخول */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              style={[styles.loginButton, { opacity: isLoading ? 0.6 : 1 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>تسجيل الدخول</Text>
              )}
            </TouchableOpacity>

            {/* زر الدخول التجريبي */}
            <TouchableOpacity
              onPress={handleDemoLogin}
              disabled={isLoading}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>دخول تجريبي</Text>
            </TouchableOpacity>

            {/* استعادة كلمة المرور */}
            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>هل نسيت كلمة المرور؟</Text>
            </TouchableOpacity>

            {/* فاصل */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>أو</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* التسجيل */}
            <View style={styles.registerRow}>
              <Text style={styles.registerLabel}>ليس لديك حساب؟ </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={styles.registerLink}>إنشاء حساب جديد</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* بيانات الدخول التجريبي */}
          <View style={styles.demoInfo}>
            <Text style={styles.demoInfoText}>
              بيانات الدخول التجريبي:{"\n"}
              اسم المستخدم: admin{"\n"}
              كلمة المرور: 123456
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  formCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#11181C",
    marginBottom: 8,
    textAlign: "right",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#11181C",
    textAlign: "right",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  loginButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  loginButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  demoButton: {
    borderWidth: 1,
    borderColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 16,
  },
  demoButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  forgotPassword: {
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 13,
    textAlign: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    color: "#687076",
    fontSize: 12,
    marginHorizontal: 8,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  registerLabel: {
    color: "#687076",
    fontSize: 13,
  },
  registerLink: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 13,
  },
  demoInfo: {
    marginTop: 24,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  demoInfoText: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 20,
  },
});
