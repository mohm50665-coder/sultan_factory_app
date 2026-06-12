import React, { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { t, isRtl } = useLanguage();
  const { user, logout } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmed) {
      Alert.alert(
        t("warning"),
        t("confirm_delete_msg")
      );
      return;
    }

    setIsDeleting(true);
    try {
      // Call API to delete account
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      Alert.alert(
        t("success"),
        isRtl ? "تم حذف حسابك وجميع بياناتك بنجاح" : "Your account and data have been deleted successfully",
        [
          {
            text: t("done"),
            onPress: () => {
              logout();
              router.replace("/");
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert(t("error"), t("operation_failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">
              {isRtl ? "حذف الحساب" : "Delete Account"}
            </Text>
            <Text className="text-base text-muted">
              {isRtl 
                ? "حذف حسابك وجميع البيانات المرتبطة به بشكل دائم"
                : "Permanently delete your account and all associated data"}
            </Text>
          </View>

          {/* Warning Section */}
          <View className="bg-error/10 border border-error rounded-lg p-4 gap-3">
            <Text className="text-lg font-semibold text-error">
              ⚠️ {t("warning")}
            </Text>
            <Text className="text-sm text-foreground leading-relaxed">
              {isRtl
                ? "هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك نهائياً."
                : "This action cannot be undone. All your data will be permanently deleted."}
            </Text>
          </View>

          {/* What Will Be Deleted */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">
              {isRtl ? "سيتم حذف:" : "What will be deleted:"}
            </Text>
            <View className="gap-2">
              <Text className="text-sm text-muted">
                • {isRtl ? "معلومات الملف الشخصي" : "Profile information"}
              </Text>
              <Text className="text-sm text-muted">
                • {isRtl ? "بيانات تسجيل الدخول" : "Login credentials"}
              </Text>
              <Text className="text-sm text-muted">
                • {isRtl ? "سجل العمل" : "Work history"}
              </Text>
              <Text className="text-sm text-muted">
                • {isRtl ? "تعيينات المهام" : "Task assignments"}
              </Text>
              <Text className="text-sm text-muted">
                • {isRtl ? "جميع البيانات الشخصية" : "All personal data"}
              </Text>
            </View>
          </View>

          {/* Confirmation Checkbox */}
          <View className="flex-row items-center gap-3 p-4 bg-surface rounded-lg border border-border">
            <TouchableOpacity
              onPress={() => setConfirmed(!confirmed)}
              className={`w-6 h-6 rounded border-2 items-center justify-center ${
                confirmed ? "bg-error border-error" : "border-border"
              }`}
            >
              {confirmed && <Text className="text-white font-bold">✓</Text>}
            </TouchableOpacity>
            <Text className="flex-1 text-sm text-foreground">
              {isRtl
                ? "أوافق على حذف حسابي وجميع بياناتي"
                : "I agree to delete my account and all my data"}
            </Text>
          </View>

          {/* Delete Button */}
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={!confirmed || isDeleting}
            className={`py-3 px-4 rounded-lg items-center justify-center ${
              confirmed && !isDeleting
                ? "bg-error"
                : "bg-error/50"
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {isDeleting 
                ? (isRtl ? "جاري الحذف..." : "Deleting...")
                : (isRtl ? "حذف الحساب نهائياً" : "Delete Account Permanently")}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="py-3 px-4 rounded-lg items-center justify-center bg-surface border border-border"
          >
            <Text className="text-foreground font-semibold text-base">
              {t("cancel")}
            </Text>
          </TouchableOpacity>

          {/* Contact Support */}
          <View className="gap-2 pt-4 border-t border-border">
            <Text className="text-sm text-muted">
              {isRtl ? "هل تحتاج مساعدة؟" : "Need help?"}
            </Text>
            <TouchableOpacity>
              <Text className="text-sm text-primary font-semibold">
                {isRtl ? "تواصل مع الدعم" : "Contact Support"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
