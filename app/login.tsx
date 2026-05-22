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
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { login } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();
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
      newErrors.username = language === "ar" ? "اسم المستخدم مطلوب" : "Username is required";
    }
    if (!formData.password) {
      newErrors.password = language === "ar" ? "كلمة المرور مطلوبة" : "Password is required";
    }
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
      const message = error instanceof Error ? error.message : t("login_failed");
      Alert.alert(t("error"), message);
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
      Alert.alert(t("error"), t("login_failed"));
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
                {language === "ar" ? "English" : "العربية"}
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
                    placeholderTextColor="#9ca3af"
                    value={formData.username}
                    onChangeText={(text) => {
                      setFormData({ ...formData, username: text });
                      if (errors.username) setErrors({ ...errors, username: "" });
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    returnKeyType="next"
                  />
                  <MaterialIcons name="person-outline" size={20} color="#9ca3af" />
                </View>
                {errors.username && (
                  <Text style={[styles.errorText, { textAlign }]}>{errors.username}</Text>
                )}
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { textAlign }]}>{t("password")}</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { textAlign }]}
                    placeholder={t("enter_password")}
                    placeholderTextColor="#9ca3af"
                    value={formData.password}
                    onChangeText={(text) => {
                      setFormData({ ...formData, password: text });
                      if (errors.password) setErrors({ ...errors, password: "" });
                    }}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <MaterialIcons name="lock-outline" size={20} color="#9ca3af" />
                </View>
                {errors.password && (
                  <Text style={[styles.errorText, { textAlign }]}>{errors.password}</Text>
                )}
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                style={[styles.loginButton, isLoading && { opacity: 0.6 }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.loginButtonText}>{t("login")}</Text>
                )}
              </TouchableOpacity>

              {/* Demo Login */}
              <TouchableOpacity
                onPress={handleDemoLogin}
                disabled={isLoading}
                style={styles.demoButton}
              >
                <MaterialIcons name="play-circle-outline" size={18} color="#0a7ea4" />
                <Text style={styles.demoButtonText}>{t("demo_login")}</Text>
              </TouchableOpacity>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => router.push("/forgot-password")}
                style={styles.forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>{t("forgot_password")}</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{language === "ar" ? "أو" : "or"}</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register Link */}
              <View style={styles.registerRow}>
                <Text style={styles.registerLabel}>{t("no_account")} </Text>
                <TouchableOpacity onPress={() => router.push("/register")}>
                  <Text style={styles.registerLink}>{t("register")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Demo Info */}
            <View style={styles.demoInfo}>
              <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.demoInfoText}>
                {t("demo_credentials")}: admin / 123456
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  langRow: {
    position: "absolute",
    top: 12,
    left: 16,
    zIndex: 10,
  },
  langBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  langBtnText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  mainContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
    backgroundColor: "#0a7ea4",
    backgroundGradient: "linear-gradient(180deg, #0a7ea4 0%, #065a75 100%)",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  logoTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "white",
    marginBottom: 6,
  },
  logoSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  formCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#f9fafb",
  },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    marginHorizontal: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 4,
    marginBottom: 12,
    shadowColor: "#0a7ea4",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  demoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 16,
  },
  demoButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 14,
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
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    color: "#9ca3af",
    fontSize: 12,
    marginHorizontal: 12,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  registerLink: {
    color: "#0a7ea4",
    fontWeight: "700",
    fontSize: 13,
  },
  demoInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
  },
  demoInfoText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
  },
});
