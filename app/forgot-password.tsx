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

export default function ForgotPasswordScreen() {
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
    if (!username.trim()) newErrors.username = "اسم المستخدم مطلوب";
    if (!phone.trim()) newErrors.phone = "رقم الجوال مطلوب";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Move to reset step - verification happens on server
      setStep("reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل التحقق من البيانات";
      Alert.alert("خطأ", message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    if (!newPassword) newErrors.newPassword = "كلمة المرور الجديدة مطلوبة";
    if (newPassword.length < 6) newErrors.newPassword = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    if (newPassword !== confirmPassword) newErrors.confirmPassword = "كلمات المرور غير متطابقة";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await authApiService.resetPassword(username.trim(), phone.trim(), newPassword);
      Alert.alert("نجاح", "تم إعادة تعيين كلمة المرور بنجاح");
      router.replace("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل إعادة تعيين كلمة المرور";
      Alert.alert("خطأ", message);
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
            <Text style={styles.headerTitle}>استعادة كلمة المرور</Text>
            <Text style={styles.headerSubtitle}>
              {step === "username"
                ? "أدخل اسم المستخدم ورقم الجوال للتحقق"
                : "أدخل كلمة المرور الجديدة"}
            </Text>
          </View>

          <View style={styles.formCard}>
            {step === "username" ? (
              <>
                {/* اسم المستخدم */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>اسم المستخدم</Text>
                  <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
                    <TextInput
                      style={styles.input}
                      placeholder="أدخل اسم المستخدم"
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
                  {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                </View>

                {/* رقم الجوال */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>رقم الجوال المسجل</Text>
                  <View style={[styles.inputContainer, errors.phone ? styles.inputError : null]}>
                    <TextInput
                      style={styles.input}
                      placeholder="أدخل رقم الجوال المسجل"
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
                  {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                </View>

                <TouchableOpacity
                  onPress={handleVerify}
                  disabled={isLoading}
                  style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>التحقق</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* كلمة المرور الجديدة */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>كلمة المرور الجديدة</Text>
                  <View style={[styles.inputContainer, errors.newPassword ? styles.inputError : null]}>
                    <TextInput
                      style={styles.input}
                      placeholder="أدخل كلمة المرور الجديدة"
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
                  {errors.newPassword && <Text style={styles.errorText}>{errors.newPassword}</Text>}
                </View>

                {/* تأكيد كلمة المرور */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>تأكيد كلمة المرور الجديدة</Text>
                  <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                    <TextInput
                      style={styles.input}
                      placeholder="أعد إدخال كلمة المرور"
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
                  {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                </View>

                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  style={[styles.submitButton, { opacity: isLoading ? 0.6 : 1 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.submitButtonText}>إعادة تعيين كلمة المرور</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ملاحظة */}
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>ملاحظة</Text>
              <Text style={styles.noteText}>
                يجب إدخال اسم المستخدم ورقم الجوال المسجل في النظام للتحقق من هويتك قبل إعادة تعيين كلمة المرور.
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
    textAlign: "right",
  },
  noteText: {
    fontSize: 12,
    color: "#687076",
    lineHeight: 20,
    textAlign: "right",
  },
});
