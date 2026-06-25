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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";

export default function WebLoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, toggleLanguage, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username.trim()) {
      newErrors.username = isAr ? "اسم المستخدم مطلوب" : "Username is required";
    }
    if (!formData.password) {
      newErrors.password = isAr ? "كلمة المرور مطلوبة" : "Password is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user) {
        await AsyncStorage.setItem("sultan_current_user", JSON.stringify(data.user));
        await AsyncStorage.setItem("sultan_session_id", data.user.id.toString());
        router.replace("/(tabs)");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("login_failed");
      Alert.alert(t("error"), message);
    } finally {
      setIsLoading(false);
    }
  };

  const textAlign = isRtl ? "right" : "left";

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {/* Language Toggle */}
          <View style={styles.langRow}>
            <TouchableOpacity onPress={toggleLanguage} style={styles.langBtn}>
              <MaterialIcons name="language" size={18} color="white" />
              <Text style={styles.langBtnText}>
                {isAr ? "English" : "العربية"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainContainer}>
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                <MaterialIcons name="factory" size={44} color="#0a7ea4" />
              </View>
              <Text style={styles.logoTitle}>{t("app_name")}</Text>
              <Text style={styles.logoSubtitle}>{t("app_subtitle")}</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { textAlign }]}>{t("username")}</Text>
                <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    placeholder={t("enter_username")}
                    placeholderTextColor={colors.muted}
                    value={formData.username}
                    onChangeText={(text) => {
                      setFormData({ ...formData, username: text });
                      if (errors.username) setErrors({ ...errors, username: "" });
                    }}
                    editable={!isLoading}
                  />
                </View>
                {errors.username && (
                  <Text style={[styles.errorText, { textAlign }]}>{errors.username}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { textAlign }]}>{t("password")}</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    placeholder={t("enter_password")}
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showPassword}
                    value={formData.password}
                    onChangeText={(text) => {
                      setFormData({ ...formData, password: text });
                      if (errors.password) setErrors({ ...errors, password: "" });
                    }}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={[styles.errorText, { textAlign }]}>{errors.password}</Text>
                )}
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: colors.primary }]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.loginBtnText}>{t("login")}</Text>
                )}
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={[styles.forgotBtnText, { color: colors.primary }]}>
                  {t("forgot_password")}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={[styles.line, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.muted }]}>
                  {isAr ? "أو" : "or"}
                </Text>
                <View style={[styles.line, { backgroundColor: colors.border }]} />
              </View>

              {/* Sign Up */}
              <View style={styles.signupContainer}>
                <Text style={[styles.signupText, { color: colors.muted }]}>
                  {isAr ? "ليس لديك حساب؟" : "Don't have an account?"}
                </Text>
                <TouchableOpacity>
                  <Text style={[styles.signupLink, { color: colors.primary }]}>
                    {isAr ? "إنشاء حساب جديد" : "Create new account"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  langRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  mainContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  logoSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  formCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  eyeIcon: {
    padding: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
  },
  loginBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  loginBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotBtn: {
    alignItems: "center",
    marginTop: 12,
  },
  forgotBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 12,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
