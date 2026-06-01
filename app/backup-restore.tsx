import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { backupService } from "@/lib/services/backup.service";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

export default function BackupRestoreScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [stats, setStats] = useState<{ totalKeys: number; totalSize: string; lastBackup: string | null }>({
    totalKeys: 0,
    totalSize: "0 bytes",
    lastBackup: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<string>("");

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const s = await backupService.getBackupStats();
    setStats(s);
  };

  const handleBackup = async () => {
    setIsLoading(true);
    setAction("backup");
    try {
      await backupService.exportBackup(user?.username || "admin");
      await backupService.saveLastBackupDate();
      await loadStats();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إنشاء النسخة الاحتياطية بنجاح" : "Backup created successfully");
    } catch (e: any) {
      Alert.alert(isAr ? "خطأ" : "Error", e.message || (isAr ? "فشل إنشاء النسخة الاحتياطية" : "Failed to create backup"));
    } finally {
      setIsLoading(false);
      setAction("");
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === "web") {
      // Web: file input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setAction("restore");
        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          if (!backup.version || !backup.data) {
            throw new Error(isAr ? "ملف النسخة الاحتياطية غير صالح" : "Invalid backup file");
          }

          Alert.alert(
            isAr ? "تأكيد الاستعادة" : "Confirm Restore",
            isAr ? `هل تريد استعادة النسخة الاحتياطية المؤرخة ${new Date(backup.createdAt).toLocaleDateString("ar-SA")}؟\nسيتم استبدال البيانات الحالية.` : `Do you want to restore the backup dated ${new Date(backup.createdAt).toLocaleDateString("en-US")}?\nCurrent data will be replaced.`,
            [
              { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
              {
                text: isAr ? "استعادة" : "Restore",
                style: "destructive",
                onPress: async () => {
                  const result = await backupService.restoreBackup(backup);
                  await loadStats();
                  Alert.alert(isAr ? "نجاح" : "Success", isAr ? `تم استعادة ${result.restored} عنصر بنجاح` : `Successfully restored ${result.restored} items`);
                },
              },
            ]
          );
        } catch (e: any) {
          Alert.alert(isAr ? "خطأ" : "Error", e.message || (isAr ? "فشل قراءة ملف النسخة الاحتياطية" : "Failed to read backup file"));
        } finally {
          setIsLoading(false);
          setAction("");
        }
      };
      input.click();
    } else {
      Alert.alert(isAr ? "استعادة" : "Restore", isAr ? "يرجى اختيار ملف النسخة الاحتياطية (.json) من جهازك" : "Please select a backup file (.json) from your device");
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "النسخ الاحتياطي والاستعادة" : "Backup and Restore"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* إحصائيات */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statsTitle, { color: colors.foreground }]}>{isAr ? "حالة البيانات" : "Data Status"}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="storage" size={28} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.totalKeys}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{isAr ? "أقسام محفوظة" : "Saved Sections"}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="sd-storage" size={28} color="#f59e0b" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stats.totalSize}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{isAr ? "حجم البيانات" : "Data Size"}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="schedule" size={28} color="#22c55e" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString(isAr ? "ar-SA" : "en-US") : (isAr ? "لا يوجد" : "None")}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>{isAr ? "آخر نسخة" : "Last Backup"}</Text>
            </View>
          </View>
        </View>

        {/* النسخ الاحتياطي */}
        <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionHeader}>
            <MaterialIcons name="backup" size={32} color={colors.primary} />
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>{isAr ? "إنشاء نسخة احتياطية" : "Create Backup"}</Text>
              <Text style={[styles.actionDesc, { color: colors.muted }]}>
                {isAr ? "حفظ جميع بيانات التطبيق في ملف JSON يمكن استعادته لاحقاً" : "Save all app data in a JSON file that can be restored later"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleBackup}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
              isLoading && action === "backup" && { opacity: 0.5 },
            ]}
          >
            {isLoading && action === "backup" ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <MaterialIcons name="cloud-download" size={20} color="white" />
                <Text style={styles.actionBtnText}>{isAr ? "تصدير النسخة الاحتياطية" : "Export Backup"}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* الاستعادة */}
        <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionHeader}>
            <MaterialIcons name="restore" size={32} color="#f59e0b" />
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>{isAr ? "استعادة من نسخة احتياطية" : "Restore from Backup"}</Text>
              <Text style={[styles.actionDesc, { color: colors.muted }]}>
                {isAr ? "استيراد بيانات من ملف نسخة احتياطية سابقة (سيتم استبدال البيانات الحالية)" : "Import data from a previous backup file (current data will be replaced)"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleRestore}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: "#f59e0b" },
              pressed && { opacity: 0.8 },
              isLoading && action === "restore" && { opacity: 0.5 },
            ]}
          >
            {isLoading && action === "restore" ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <MaterialIcons name="cloud-upload" size={20} color="white" />
                <Text style={styles.actionBtnText}>{isAr ? "استيراد نسخة احتياطية" : "Import Backup"}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* تحذيرات */}
        <View style={[styles.warningCard, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
          <MaterialIcons name="warning" size={24} color="#f59e0b" />
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.warningTitle, { color: "#92400e" }]}>{isAr ? "تنبيهات مهمة" : "Important Alerts"}</Text>
            <Text style={[styles.warningText, { color: "#92400e" }]}>
              {isAr ? "• احرص على إنشاء نسخة احتياطية بشكل دوري\n• عند الاستعادة سيتم استبدال جميع البيانات الحالية\n• احفظ ملف النسخة الاحتياطية في مكان آمن\n• لا تعدل محتوى ملف النسخة الاحتياطية يدوياً" : "• Make sure to create a backup periodically\n• When restoring, all current data will be replaced\n• Save the backup file in a safe place\n• Do not manually modify the backup file content"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "right",
  },
  actionDesc: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "right",
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "right",
  },
  warningText: {
    fontSize: 12,
    lineHeight: 22,
    textAlign: "right",
  },
});
