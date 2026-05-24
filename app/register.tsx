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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    position: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const textAlign = isRtl ? "right" : "left";

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = language === "ar" ? "الاسم مطلوب" : "Name is required";
    }
    if (!formData.username.trim()) {
      newErrors.username = language === "ar" ? "اسم المستخدم مطلوب" : "Username is required";
    }
    if (!formData.position.trim()) {
      newErrors.position = language === "ar" ? "المنصب مطلوب" : "Position is required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = language === "ar" ? "رقم الجوال مطلوب" : "Phone is required";
    }
    if (!formData.password) {
      newErrors.password = language === "ar" ? "كلمة المرور مطلوبة" : "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = t("password_min");
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("passwords_not_match");
    }
    if (!agreedToTerms) {
      newErrors.terms = language === "ar" ? "يجب الموافقة على الشروط والأحكام" : "You must agree to the terms";
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
        formData.username,
        formData.phone,
        formData.position,
        formData.password
      );
      Alert.alert(t("success"), t("register_success"));
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("error");
      Alert.alert(t("error"), message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    field: keyof typeof formData,
    label: string,
    placeholder: string,
    icon: string,
    options?: { secure?: boolean; keyboard?: any }
  ) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { textAlign }]}>{label}</Text>
      <View style={[styles.inputContainer, errors[field] ? styles.inputError : null]}>
        {options?.secure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <MaterialIcons
              name={showPassword ? "visibility" : "visibility-off"}
              size={18}
              color="#9ca3af"
            />
          </TouchableOpacity>
        )}
        <TextInput
          style={[styles.input, { textAlign }]}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={formData[field]}
          onChangeText={(text) => {
            setFormData({ ...formData, [field]: text });
            if (errors[field]) setErrors({ ...errors, [field]: "" });
          }}
          secureTextEntry={options?.secure && !showPassword}
          keyboardType={options?.keyboard || "default"}
          autoCapitalize={field === "username" ? "none" : "sentences"}
          editable={!isLoading}
        />
        <MaterialIcons name={icon as any} size={18} color="#9ca3af" />
      </View>
      {errors[field] && <Text style={[styles.errorText, { textAlign }]}>{errors[field]}</Text>}
    </View>
  );

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
              <MaterialIcons name="language" size={16} color="white" />
              <Text style={styles.langBtnText}>
                {language === "ar" ? "English" : "العربية"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.replace("/login")} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={22} color="white" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t("register")}</Text>
              <Text style={styles.headerSubtitle}>
                {language === "ar"
                  ? "أنشئ حسابك للبدء في استخدام التطبيق"
                  : "Create your account to start using the app"}
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {renderInput("name", t("full_name"), t("enter_full_name"), "person-outline")}
              {renderInput("username", t("username"), t("enter_username"), "account-circle")}
              {renderInput(
                "position",
                language === "ar" ? "المنصب الوظيفي" : "Job Position",
                language === "ar" ? "أدخل منصبك الوظيفي" : "Enter your position",
                "work-outline"
              )}
              {renderInput("phone", t("phone"), t("enter_phone"), "phone", { keyboard: "phone-pad" })}
              {renderInput("password", t("password"), t("enter_password"), "lock-outline", { secure: true })}
              {renderInput(
                "confirmPassword",
                t("confirm_password"),
                language === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password",
                "lock",
                { secure: true }
              )}

              {/* Terms */}
              <View style={styles.termsContainer}>
                <TouchableOpacity
                  onPress={() => setAgreedToTerms(!agreedToTerms)}
                  style={styles.checkboxRow}
                >
                  <MaterialIcons
                    name={agreedToTerms ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={agreedToTerms ? "#0a7ea4" : "#9ca3af"}
                  />
                  <Text style={styles.termsText}>
                    {language === "ar" ? "أوافق على " : "I agree to "}
                  </Text>
                  <TouchableOpacity onPress={() => setShowTerms(true)}>
                    <Text style={styles.termsLink}>
                      {language === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
                {errors.terms && <Text style={[styles.errorText, { textAlign }]}>{errors.terms}</Text>}
              </View>

              {/* Register Button */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={isLoading}
                style={[styles.registerButton, isLoading && { opacity: 0.6 }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.registerButtonText}>{t("register")}</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginRow}>
                <Text style={styles.loginLabel}>{t("have_account")} </Text>
                <TouchableOpacity onPress={() => router.push("/login")}>
                  <Text style={styles.loginLink}>{t("login")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms Modal */}
      <Modal visible={showTerms} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {language === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}
              </Text>
              <TouchableOpacity onPress={() => setShowTerms(false)}>
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.termsContent, { textAlign }]}>
                {language === "ar"
                  ? `الشروط والأحكام

1- يلزم مدير الإدارة وكل من أوكلت إليه مهام بإعداد التقرير اليومي من خلال تعبئة البيانات في تطبيق متابعة الأداء، وفي حالة عدم الالتزام بتعبئة بيانات التطبيق والالتزام بالتقارير اليومية يطبق نظام العقوبات.

2- أي تقرير لا يتم إرفاق متطلباته لا يُعتد به.

3- يتم رفع التقارير والبيانات بشكل يومي بمدة أقصاها الساعة 3 عصراً.

4- لا يُقبل صرف أي مبالغ نقدية بدون موافقة ممثل مجلس الإدارة.

5- جميع التعاملات المالية تتم بموجب تحويلات بنكية أو دفع بالبطاقة البنكية فقط.

بالموافقة على هذه الشروط، أقر بأنني قرأت وفهمت جميع البنود أعلاه وأوافق على الالتزام بها.`
                  : `Terms and Conditions

1- Department managers and all assigned personnel must prepare daily reports by filling in data in the performance tracking app. Failure to comply will result in penalties.

2- Any report without required attachments will not be accepted.

3- Reports and data must be submitted daily by 3:00 PM at the latest.

4- No cash disbursements are accepted without board representative approval.

5- All financial transactions must be conducted via bank transfers or bank card payments only.

By agreeing to these terms, I acknowledge that I have read and understood all the above provisions and agree to comply with them.`}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => {
                setAgreedToTerms(true);
                setShowTerms(false);
                if (errors.terms) setErrors({ ...errors, terms: "" });
              }}
              style={styles.agreeButton}
            >
              <Text style={styles.agreeButtonText}>
                {language === "ar" ? "أوافق على الشروط والأحكام" : "I Agree to Terms"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  langBtnText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: "#0a7ea4",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 8,
  },
  backBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#f9fafb",
  },
  inputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1f2937",
    marginHorizontal: 8,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 11,
    marginTop: 4,
  },
  termsContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  termsText: {
    fontSize: 12,
    color: "#1f2937",
    marginLeft: 6,
  },
  termsLink: {
    fontSize: 12,
    color: "#0a7ea4",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  registerButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 14,
    shadowColor: "#0a7ea4",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLabel: {
    color: "#6b7280",
    fontSize: 13,
  },
  loginLink: {
    color: "#0a7ea4",
    fontWeight: "700",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalBody: {
    maxHeight: 300,
    marginBottom: 16,
  },
  termsContent: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 24,
  },
  agreeButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 14,
  },
  agreeButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
});
