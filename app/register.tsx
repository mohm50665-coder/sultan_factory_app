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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function RegisterScreen() {
  const router = useRouter();
  const colors = useColors();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    position: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "الاسم مطلوب";
    if (!formData.username.trim()) newErrors.username = "اسم المستخدم مطلوب";
    if (!formData.position.trim()) newErrors.position = "المنصب مطلوب";
    if (!formData.phone.trim()) newErrors.phone = "رقم الجوال مطلوب";
    if (!formData.password) newErrors.password = "كلمة المرور مطلوبة";
    if (formData.password.length < 6) newErrors.password = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "كلمات المرور غير متطابقة";
    }
    if (!agreedToTerms) {
      newErrors.terms = "يجب الموافقة على الشروط والأحكام";
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

      Alert.alert("نجاح", "تم التسجيل بنجاح!");
      router.replace("/(tabs)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل التسجيل. حاول مرة أخرى.";
      Alert.alert("خطأ", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          {/* العنوان */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>تسجيل جديد</Text>
            <Text style={styles.headerSubtitle}>
              أنشئ حسابك للبدء في استخدام التطبيق
            </Text>
          </View>

          {/* نموذج التسجيل */}
          <View style={styles.formCard}>
            {/* الاسم الكامل */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <View style={[styles.inputContainer, errors.name ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أدخل اسمك الكامل"
                  placeholderTextColor={colors.muted}
                  value={formData.name}
                  onChangeText={(text) => {
                    setFormData({ ...formData, name: text });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                  editable={!isLoading}
                />
                <MaterialIcons name="person" size={20} color={colors.muted} />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* اسم المستخدم */}
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
                <MaterialIcons name="account-circle" size={20} color={colors.muted} />
              </View>
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            </View>

            {/* المنصب */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>المنصب الوظيفي</Text>
              <View style={[styles.inputContainer, errors.position ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أدخل منصبك الوظيفي"
                  placeholderTextColor={colors.muted}
                  value={formData.position}
                  onChangeText={(text) => {
                    setFormData({ ...formData, position: text });
                    if (errors.position) setErrors({ ...errors, position: "" });
                  }}
                  editable={!isLoading}
                />
                <MaterialIcons name="work" size={20} color={colors.muted} />
              </View>
              {errors.position && <Text style={styles.errorText}>{errors.position}</Text>}
            </View>

            {/* رقم الجوال */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>رقم الجوال</Text>
              <View style={[styles.inputContainer, errors.phone ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أدخل رقم جوالك"
                  placeholderTextColor={colors.muted}
                  value={formData.phone}
                  onChangeText={(text) => {
                    setFormData({ ...formData, phone: text });
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
                <MaterialIcons name="phone" size={20} color={colors.muted} />
              </View>
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            {/* كلمة المرور */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>كلمة المرور</Text>
              <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
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
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* تأكيد كلمة المرور */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>تأكيد كلمة المرور</Text>
              <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="أعد إدخال كلمة المرور"
                  placeholderTextColor={colors.muted}
                  value={formData.confirmPassword}
                  onChangeText={(text) => {
                    setFormData({ ...formData, confirmPassword: text });
                    if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" });
                  }}
                  secureTextEntry
                  editable={!isLoading}
                />
                <MaterialIcons name="lock-outline" size={20} color={colors.muted} />
              </View>
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            {/* الشروط والأحكام */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                style={styles.checkboxRow}
              >
                <MaterialIcons
                  name={agreedToTerms ? "check-box" : "check-box-outline-blank"}
                  size={24}
                  color={agreedToTerms ? "#0a7ea4" : "#687076"}
                />
                <Text style={styles.termsText}>أوافق على </Text>
                <TouchableOpacity onPress={() => setShowTerms(true)}>
                  <Text style={styles.termsLink}>الشروط والأحكام</Text>
                </TouchableOpacity>
              </TouchableOpacity>
              {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
            </View>

            {/* زر التسجيل */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              style={[styles.registerButton, { opacity: isLoading ? 0.6 : 1 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.registerButtonText}>إنشاء الحساب</Text>
              )}
            </TouchableOpacity>

            {/* رابط تسجيل الدخول */}
            <View style={styles.loginRow}>
              <Text style={styles.loginLabel}>لديك حساب بالفعل؟ </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={styles.loginLink}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* نافذة الشروط والأحكام */}
      <Modal visible={showTerms} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>الشروط والأحكام</Text>
              <TouchableOpacity onPress={() => setShowTerms(false)}>
                <MaterialIcons name="close" size={24} color="#11181C" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.termsContent}>
                {`شروط وأحكام استخدام تطبيق مصنع السلطان

1. المقدمة
هذه الشروط والأحكام تحكم استخدامك لتطبيق مصنع السلطان لمتابعة أداء المصنع.

2. الاستخدام المسموح
- يُسمح باستخدام التطبيق لأغراض العمل المتعلقة بمصنع السلطان فقط.
- يجب الحفاظ على سرية بيانات الدخول وعدم مشاركتها مع أي شخص.
- يجب إدخال البيانات بدقة ومصداقية.

3. المسؤوليات
- المستخدم مسؤول عن جميع البيانات التي يدخلها في التطبيق.
- يجب الإبلاغ فوراً عن أي استخدام غير مصرح به للحساب.
- يحظر محاولة الوصول لبيانات أو صلاحيات غير مخولة للمستخدم.

4. الخصوصية وحماية البيانات
- جميع البيانات المدخلة تعتبر ملكاً لمصنع السلطان.
- لا يحق للمستخدم نسخ أو نقل البيانات خارج التطبيق بدون إذن.
- تُحفظ البيانات بشكل آمن ولا يتم مشاركتها مع أطراف خارجية.

5. الصلاحيات
- يتم تحديد صلاحيات كل مستخدم حسب منصبه ودوره.
- يحق للإدارة تعديل أو إلغاء الصلاحيات في أي وقت.

6. إنهاء الحساب
- يحق للإدارة إيقاف أو حذف أي حساب في حال مخالفة هذه الشروط.
- عند انتهاء علاقة العمل يتم إلغاء الحساب تلقائياً.

7. التعديلات
- يحق لإدارة المصنع تعديل هذه الشروط في أي وقت.
- سيتم إشعار المستخدمين بأي تعديلات جوهرية.

بالموافقة على هذه الشروط، أقر بأنني قرأت وفهمت جميع البنود أعلاه وأوافق على الالتزام بها.`}
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
              <Text style={styles.agreeButtonText}>أوافق على الشروط والأحكام</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
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
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#11181C",
    marginBottom: 6,
    textAlign: "right",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
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
    fontSize: 13,
    color: "#11181C",
    marginLeft: 8,
  },
  termsLink: {
    fontSize: 13,
    color: "#0a7ea4",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  registerButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 14,
    marginBottom: 16,
  },
  registerButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  loginLabel: {
    color: "#687076",
    fontSize: 13,
  },
  loginLink: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#11181C",
  },
  modalBody: {
    padding: 16,
  },
  termsContent: {
    fontSize: 14,
    color: "#11181C",
    lineHeight: 24,
    textAlign: "right",
  },
  agreeButton: {
    backgroundColor: "#0a7ea4",
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
  },
  agreeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
});
