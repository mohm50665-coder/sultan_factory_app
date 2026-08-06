import React, { useState } from "react";
import { BackButton } from "@/components/back-button";
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
import { MaterialIcons } from "@expo/vector-icons";
import { authApiService } from "@/lib/services/api.service";
import { useLanguage } from "@/lib/language-context";

export default function ForgotPasswordScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"username" | "reset">("username");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleVerify = async () => {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = isAr ? "اسم المستخدم مطلوب" : "Username is required";
    if (!phone.trim()) newErrors.phone = isAr ? "رقم الجوال مطلوب" : "Phone number is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Move to reset step - verification happens on server
      setStep("reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? "فشل التحقق من البيانات" : "Data verification failed");
      Alert.alert(isAr ? "خطأ" : "Error", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!newPassword) newErrors.newPassword = isAr ? "كلمة المرور الجديدة مطلوبة" : "New password is required";
    if (newPassword.length < 6) newErrors.newPassword = isAr ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters";
    if (newPassword !== confirmPassword) newErrors.confirmPassword = isAr ? "كلمات المرور غير متطابقة" : "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await authApiService.resetPassword(username.trim(), phone.trim(), newPassword);
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إعادة تعيين كلمة المرور بنجاح" : "Password reset successfully");
      router.replace("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? "فشل إعادة تعيين كلمة المرور" : "Failed to reset password");
      Alert.alert(isAr ? "خطأ" : "Error", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-gradient-to-b from-primary to-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          {/* زر العودة */}
          <BackButton target="/login" />








          {/* العنوان */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "استعادة كلمة المرور" : "Forgot Password"}</Text>
            <Text style={[styles.headerSubtitle, { textAlign: isAr ? "right" : "left" }]}>
              {step === "username"
                ? (isAr ? "أدخل اسم المستخدم ورقم الجوال للتحقق" : "Enter username and phone number to verify")
                : (isAr ? "أدخل كلمة المرور الجديدة" : "Enter new password")}
            </Text>
          </View>

          <View style={styles.formCard}>
            {step === "username" ? (
              <>
                {/* اسم المستخدم */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "اسم المستخدم" : "Username"}</Text>
                  <View style={[styles.inputContainer, errors.username ? styles.inputError : null, { flexDirection: isAr ? "row" : "row-reverse" }]}>
                    <TextInput
                      style={[styles.input, { textAlign: isAr ? "right" : "left" }]}
                      placeholder={isAr ? "أدخل اسم المستخدم" : "Enter username"}
                      placeholderTextColor={colors.muted}
                      value={username}
                      onChangeText={(text) => {
                        setUsername(text);
                        if (errors.username) setErrors({ ...errors, username: "" });
                      }}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                    <MaterialIcons name="person" size={20} color={colors.muted} />
                  </View>
                  {errors.username && <Text style={[styles.errorText, { textAlign: isAr ? "right" : "left" }]}>{errors.username}</Text>}
                </View>

                {/* رقم الجوال */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "رقم الجوال المسجل" : "Registered Phone Number"}</Text>
                  <View style={[styles.inputContainer, errors.phone ? styles.inputError : null, { flexDirection: isAr ? "row" : "row-reverse" }]}>
                    <TextInput
                      style={[styles.input, { textAlign: isAr ? "right" : "left" }]}
                      placeholder={isAr ? "أدخل رقم الجوال المسجل" : "Enter registered phone number"}
                      placeholderTextColor={colors.muted}
                      value={phone}
                      onChangeText={(text) => {
                        setPhone(text);
                        if (errors.phone) setErrors({ ...errors, phone: "" });
                      }}
                      keyboardType="phone-pad"
                      editable={!isLoading}
                    />
                    <MaterialIcons name="phone" size={20} color={colors.muted} />
                  </View>
                  {errors.phone && <Text style={[styles.errorText, { textAlign: isAr ? "right" : "left" }]}>{errors.phone}</Text>}
                </View>

                <TouchableOpacity
                  onPress={handleVerify}
                  disabled={isLoading}
                  style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>{isAr ? "التحقق" : "Verify"}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* كلمة المرور الجديدة */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "كلمة المرور الجديدة" : "New Password"}</Text>
                  <View style={[styles.inputContainer, errors.newPassword ? styles.inputError : null, { flexDirection: isAr ? "row" : "row-reverse" }]}>
                    <TextInput
                      style={[styles.input, { textAlign: isAr ? "right" : "left" }]}
                      placeholder={isAr ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                      placeholderTextColor={colors.muted}
                      value={newPassword}
                      onChangeText={(text) => {
                        setNewPassword(text);
                        if (errors.newPassword) setErrors({ ...errors, newPassword: "" });
                      }}
                      secureTextEntry
                      editable={!isLoading}
                    />
                    <MaterialIcons name="lock" size={20} color={colors.muted} />
                  </View>
                  {errors.newPassword && <Text style={[styles.errorText, { textAlign: isAr ? "right" : "left" }]}>{errors.newPassword}</Text>}
                </View>

                {/* تأكيد كلمة المرور */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Text>
                  <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null, { flexDirection: isAr ? "row" : "row-reverse" }]}>
                    <TextInput
                      style={[styles.input, { textAlign: isAr ? "right" : "left" }]}
                      placeholder={isAr ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                      placeholderTextColor={colors.muted}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" });
                      }}
                      secureTextEntry
                      editable={!isLoading}
                    />
                    <MaterialIcons name="lock-outline" size={20} color={colors.muted} />
                  </View>
                  {errors.confirmPassword && <Text style={[styles.errorText, { textAlign: isAr ? "right" : "left" }]}>{errors.confirmPassword}</Text>}
                </View>

                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>{isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ملاحظة */}
            <View style={styles.noteBox}>
              <Text style={[styles.noteTitle, { textAlign: isAr ? "right" : "left" }]}>{isAr ? "ملاحظة" : "Note"}</Text>
              <Text style={[styles.noteText, { textAlign: isAr ? "right" : "left" }]}>
                {isAr ? "يجب إدخال اسم المستخدم ورقم الجوال المسجل في النظام للتحقق من هويتك قبل إعادة تعيين كلمة المرور." : "You must enter the username and registered phone number to verify your identity before resetting the password."}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  backText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 14,
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  headerSubtitle: {
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
    fontSize: 13,
    fontWeight: "600",
    color: "#11181C",
    marginBottom: 6,
  },
  inputContainer: {
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
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  noteBox: {
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#11181C",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    color: "#687076",
    lineHeight: 20,
  },
});
