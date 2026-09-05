import React, { useState } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  TextInput,
  Pressable,
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

const DEPARTMENTS = [
  { id: "production", labelAr: "قسم الإنتاج", labelEn: "Production Department", icon: "precision-manufacturing" },
  { id: "machines", labelAr: "مرحلة المكائن", labelEn: "Machines Stage", icon: "precision-manufacturing" },
  { id: "rosso", labelAr: "مرحلة الروسو", labelEn: "Rosso Stage", icon: "loop" },
  { id: "qalb", labelAr: "مرحلة القلب", labelEn: "Turning Stage", icon: "flip" },
  { id: "kawiya", labelAr: "مرحلة الكاوية", labelEn: "Ironing Stage", icon: "local-fire-department" },
  { id: "inspection", labelAr: "مرحلة الفحص", labelEn: "Inspection Stage", icon: "search" },
  { id: "packing", labelAr: "مرحلة التغليف", labelEn: "Packing Stage", icon: "inventory-2" },
  { id: "antislip", labelAr: "مرحلة مانع الانزلاق", labelEn: "Anti-slip Stage", icon: "layers" },
  { id: "storage", labelAr: "مرحلة التخزين", labelEn: "Storage Stage", icon: "warehouse" },
  { id: "administrative", labelAr: "قسم الإجراءات الإدارية والمصروفات", labelEn: "Administrative & Expenses", icon: "admin-panel-settings" },
  { id: "sales", labelAr: "قسم المبيعات والتحصيل", labelEn: "Sales & Collection", icon: "point-of-sale" },
  { id: "maintenance", labelAr: "قسم الصيانة", labelEn: "Maintenance Department", icon: "build" },
  { id: "board_representative", labelAr: "ممثل مجلس الإدارة", labelEn: "Board Representative", icon: "groups" },
  { id: "warehouse", labelAr: "قسم المستودعات", labelEn: "Warehouse Department", icon: "warehouse" },
  { id: "employees", labelAr: "الموظفين", labelEn: "Employees", icon: "people" },
  { id: "government_tenders", labelAr: "المناقصات الحكومية والعسكرية", labelEn: "Government & Military Tenders", icon: "gavel" },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register, user } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDepartmentPicker, setShowDepartmentPicker] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    position: "",
    department: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const textAlign = isRtl ? "right" : "left";
  const isAr = language === "ar";
  const isAdminAddingUser = user?.role === "admin";

  const getSelectedDepartmentLabel = () => {
    const dept = DEPARTMENTS.find((d) => d.id === formData.department);
    if (!dept) return isAr ? "اختر القسم" : "Select Department";
    return isAr ? dept.labelAr : dept.labelEn;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = isAr ? "الاسم مطلوب" : "Name is required";
    }
    if (!formData.username.trim()) {
      newErrors.username = isAr ? "اسم المستخدم مطلوب" : "Username is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = isAr ? "البريد الإلكتروني مطلوب" : "Email is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      newErrors.email = isAr ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email address";
    }
    if (!formData.department) {
      newErrors.department = isAr ? "القسم مطلوب" : "Department is required";
    }
    if (!formData.position.trim()) {
      newErrors.position = isAr ? "المنصب مطلوب" : "Position is required";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = isAr ? "رقم الجوال مطلوب" : "Phone is required";
    }
    if (!formData.password) {
      newErrors.password = isAr ? "كلمة المرور مطلوبة" : "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = t("password_min");
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("passwords_not_match");
    }
    if (!isAdminAddingUser && !agreedToTerms) {
      newErrors.terms = isAr ? "يجب الموافقة على الشروط والأحكام" : "You must agree to the terms";
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
        formData.email,
        formData.phone,
        formData.position,
        formData.department,
        formData.password
      );
      const successMsg = isAdminAddingUser
        ? (isAr ? "تمت إضافة الموظف بنجاح، ويمكنك تفعيل حسابه وتحديد صلاحياته من إدارة المستخدمين." : "Employee added successfully. You can activate the account and assign permissions from user management.")
        : (isAr ? "تم التسجيل بنجاح! حسابك بانتظار التفعيل من المدير. يرجى التواصل مع الإدارة." : "Registration successful! Your account is pending activation by the admin. Please contact management.");
      if (Platform.OS === "web") {
        window.alert(successMsg);
      } else {
        Alert.alert(
          isAr ? "تم التسجيل" : "Registered",
          successMsg
        );
      }
      router.replace(isAdminAddingUser ? "/users-management" : "/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("error");
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert(t("error"), message);
      }
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
          <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
            <MaterialIcons
              name={showPassword ? "visibility" : "visibility-off"}
              size={18}
              color="#9ca3af"
            />
          </Pressable>
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
            <Pressable
              onPress={toggleLanguage}
              style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="language" size={16} color="white" />
              <Text style={styles.langBtnText}>
                {isAr ? "English" : "العربية"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.mainContainer}>
            {/* Header */}
            <View style={styles.header}>
              <BackButton target={isAdminAddingUser ? "/users-management" : "/login"} />
              <Text style={styles.headerTitle}>{isAdminAddingUser ? (isAr ? "إضافة موظف جديد" : "Add New Employee") : t("register")}</Text>
              <Text style={styles.headerSubtitle}>
                {isAdminAddingUser
                  ? (isAr ? "أدخل بيانات الموظف ثم حدد صلاحياته من إدارة المستخدمين" : "Enter employee details, then assign permissions from user management")
                  : (isAr ? "أنشئ حسابك للبدء في استخدام التطبيق" : "Create your account to start using the app")}
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {renderInput("name", t("full_name"), t("enter_full_name"), "person-outline")}
              {renderInput("username", t("username"), t("enter_username"), "account-circle")}
              {renderInput("email", isAr ? "البريد الإلكتروني" : "Email", isAr ? "أدخل البريد الإلكتروني" : "Enter email", "email", { keyboard: "email-address" })}

              {/* Department Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { textAlign }]}>
                  {isAr ? "القسم" : "Department"}
                </Text>
                <Pressable
                  onPress={() => setShowDepartmentPicker(true)}
                  style={({ pressed }) => [
                    styles.inputContainer,
                    errors.department ? styles.inputError : null,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialIcons name="arrow-drop-down" size={20} color="#9ca3af" />
                  <Text
                    style={[
                      styles.input,
                      { textAlign },
                      !formData.department && { color: "#9ca3af" },
                    ]}
                  >
                    {getSelectedDepartmentLabel()}
                  </Text>
                  <MaterialIcons name="business" size={18} color="#9ca3af" />
                </Pressable>
                {errors.department && (
                  <Text style={[styles.errorText, { textAlign }]}>{errors.department}</Text>
                )}
              </View>

              {renderInput(
                "position",
                isAr ? "المنصب الوظيفي" : "Job Position",
                isAr ? "أدخل منصبك الوظيفي" : "Enter your position",
                "work-outline"
              )}
              {renderInput("phone", t("phone"), t("enter_phone"), "phone", { keyboard: "phone-pad" })}
              {renderInput("password", t("password"), t("enter_password"), "lock-outline", { secure: true })}
              {renderInput(
                "confirmPassword",
                t("confirm_password"),
                isAr ? "أعد إدخال كلمة المرور" : "Re-enter password",
                "lock",
                { secure: true }
              )}

              {/* Terms */}
              {!isAdminAddingUser && <View style={styles.termsContainer}>
                <View style={styles.checkboxRow}>
                  <Pressable
                    onPress={() => {
                      setAgreedToTerms(!agreedToTerms);
                      if (errors.terms) setErrors({ ...errors, terms: "" });
                    }}
                    style={({ pressed }) => [{ padding: 8, marginRight: 4 }, pressed && { opacity: 0.6 }]}
                  >
                    <MaterialIcons
                      name={agreedToTerms ? "check-box" : "check-box-outline-blank"}
                      size={24}
                      color={agreedToTerms ? "#0a7ea4" : "#9ca3af"}
                    />
                  </Pressable>
                  <Text style={styles.termsText}>
                    {isAr ? "أوافق على " : "I agree to "}
                  </Text>
                  <Pressable onPress={() => setShowTerms(true)} style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}>
                    <Text style={styles.termsLink}>
                      {isAr ? "الشروط والأحكام" : "Terms & Conditions"}
                    </Text>
                  </Pressable>
                </View>
                {errors.terms && <Text style={[styles.errorText, { textAlign }]}>{errors.terms}</Text>}
              </View>}

              {/* Register Button */}
              <Pressable
                onPress={handleRegister}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.registerButton,
                  isLoading && { opacity: 0.6 },
                  pressed && { opacity: 0.8 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.registerButtonText}>{isAdminAddingUser ? (isAr ? "حفظ الموظف" : "Save Employee") : t("register")}</Text>
                )}
              </Pressable>

              {/* Login Link */}
              {!isAdminAddingUser && <View style={styles.loginRow}>
                <Text style={styles.loginLabel}>{t("have_account")} </Text>
                <Pressable
                  onPress={() => router.push("/login")}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.loginLink}>{t("login")}</Text>
                </Pressable>
              </View>}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Department Picker Modal */}
      <Modal visible={showDepartmentPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? "اختر القسم" : "Select Department"}
              </Text>
              <Pressable
                onPress={() => setShowDepartmentPicker(false)}
                style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {DEPARTMENTS.map((dept) => (
                <Pressable
                  key={dept.id}
                  onPress={() => {
                    setFormData({ ...formData, department: dept.id });
                    if (errors.department) setErrors({ ...errors, department: "" });
                    setShowDepartmentPicker(false);
                  }}
                  style={({ pressed }) => [
                    styles.departmentItem,
                    formData.department === dept.id && styles.departmentItemSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <MaterialIcons
                    name={(dept.icon || "business") as any}
                    size={24}
                    color={formData.department === dept.id ? "#0a7ea4" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.departmentItemText,
                      formData.department === dept.id && styles.departmentItemTextSelected,
                    ]}
                  >
                    {isAr ? dept.labelAr : dept.labelEn}
                  </Text>
                  {formData.department === dept.id && (
                    <MaterialIcons name="check-circle" size={22} color="#0a7ea4" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Terms Modal */}
      <Modal visible={showTerms} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAr ? "الشروط والأحكام" : "Terms & Conditions"}
              </Text>
              <Pressable
                onPress={() => setShowTerms(false)}
                style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}
              >
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.termsContent, { textAlign }]}>
                {isAr
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
            <Pressable
              onPress={() => {
                setAgreedToTerms(true);
                setShowTerms(false);
                if (errors.terms) setErrors({ ...errors, terms: "" });
              }}
              style={({ pressed }) => [styles.agreeButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.agreeButtonText}>
                {isAr ? "أوافق على الشروط والأحكام" : "I Agree to Terms"}
              </Text>
            </Pressable>
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
  departmentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  departmentItemSelected: {
    backgroundColor: "#e0f2fe",
    borderColor: "#0a7ea4",
  },
  departmentItemText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  departmentItemTextSelected: {
    color: "#0a7ea4",
    fontWeight: "700",
  },
});
