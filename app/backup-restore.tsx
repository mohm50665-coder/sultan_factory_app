import { useState, useEffect } from "react";
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
  Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { backupService } from "@/lib/services/backup.service";
import { backupsService } from "@/lib/services/server-data.service";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SCHEDULE_KEY = "backup_schedule_settings";

type ScheduleFrequency = "daily" | "weekly" | "monthly" | "off";

interface ScheduleSettings {
  enabled: boolean;
  frequency: ScheduleFrequency;
  time: string; // HH:mm format
  lastAutoBackup: string | null;
  nextBackup: string | null;
}

const defaultSchedule: ScheduleSettings = {
  enabled: false,
  frequency: "daily",
  time: "02:00",
  lastAutoBackup: null,
  nextBackup: null,
};

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
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSettings>(defaultSchedule);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    loadStats();
    loadServerBackups();
    loadScheduleSettings();
  }, []);

  // Check if auto backup is needed
  useEffect(() => {
    if (schedule.enabled) {
      checkAutoBackup();
    }
  }, [schedule.enabled]);

  const loadScheduleSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SCHEDULE_KEY);
      if (saved) {
        setSchedule(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
    }
  };

  const saveScheduleSettings = async (newSettings: ScheduleSettings) => {
    try {
      // Calculate next backup time
      const next = calculateNextBackup(newSettings);
      newSettings.nextBackup = next;
      await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(newSettings));
      setSchedule(newSettings);
    } catch (error) {
      console.error("Error saving schedule:", error);
    }
  };

  const calculateNextBackup = (settings: ScheduleSettings): string | null => {
    if (!settings.enabled) return null;
    const now = new Date();
    const [hours, minutes] = settings.time.split(":").map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      switch (settings.frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }
    return next.toISOString();
  };

  const checkAutoBackup = async () => {
    if (!schedule.enabled || !schedule.nextBackup) return;
    const now = new Date();
    const nextBackupTime = new Date(schedule.nextBackup);
    if (now >= nextBackupTime) {
      // Time to auto backup
      await performAutoBackup();
    }
  };

  const performAutoBackup = async () => {
    try {
      await backupService.exportBackup(user?.username || "admin");
      await backupService.saveLastBackupDate();
      try {
        await backupsService.create({
          backupName: `نسخة_تلقائية_${new Date().toISOString().split("T")[0]}`,
          backupType: "automatic",
          userId: 1,
        });
      } catch (e) { /* server backup optional */ }
      
      const newSettings = {
        ...schedule,
        lastAutoBackup: new Date().toISOString(),
        nextBackup: calculateNextBackup(schedule),
      };
      await saveScheduleSettings(newSettings);
      await loadStats();
      await loadServerBackups();
    } catch (error) {
      console.error("Auto backup failed:", error);
    }
  };

  const loadServerBackups = async () => {
    try {
      const data = await backupsService.getAll();
      setServerBackups(data);
    } catch (error) {
      console.error("Error loading server backups:", error);
    }
  };

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
      try {
        await backupsService.create({
          backupName: `نسخة_${new Date().toISOString().split("T")[0]}`,
          backupType: "manual",
          userId: 1,
        });
      } catch (e) { /* server backup optional */ }
      await loadStats();
      await loadServerBackups();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إنشاء النسخة الاحتياطية بنجاح (محلي + سيرفر)" : "Backup created successfully (local + server)");
    } catch (e: any) {
      Alert.alert(isAr ? "خطأ" : "Error", e.message || (isAr ? "فشل إنشاء النسخة الاحتياطية" : "Failed to create backup"));
    } finally {
      setIsLoading(false);
      setAction("");
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === "web") {
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
            isAr ? `هل تريد استعادة النسخة الاحتياطية؟\nسيتم استبدال البيانات الحالية.` : `Do you want to restore this backup?\nCurrent data will be replaced.`,
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

  const frequencyOptions: { value: ScheduleFrequency; labelAr: string; labelEn: string }[] = [
    { value: "daily", labelAr: "يومياً", labelEn: "Daily" },
    { value: "weekly", labelAr: "أسبوعياً", labelEn: "Weekly" },
    { value: "monthly", labelAr: "شهرياً", labelEn: "Monthly" },
  ];

  const timeOptions = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

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

        {/* جدولة النسخ الاحتياطية */}
        <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setShowSchedule(!showSchedule)}
            style={({ pressed }) => [styles.actionHeader, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="schedule" size={32} color="#8b5cf6" />
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                {isAr ? "جدولة النسخ الاحتياطية التلقائية" : "Auto Backup Schedule"}
              </Text>
              <Text style={[styles.actionDesc, { color: colors.muted }]}>
                {schedule.enabled
                  ? (isAr ? `مفعّل - ${frequencyOptions.find(f => f.value === schedule.frequency)?.[isAr ? "labelAr" : "labelEn"]} الساعة ${schedule.time}` : `Active - ${frequencyOptions.find(f => f.value === schedule.frequency)?.labelEn} at ${schedule.time}`)
                  : (isAr ? "غير مفعّل - اضغط للإعداد" : "Inactive - tap to configure")}
              </Text>
            </View>
            <MaterialIcons name={showSchedule ? "expand-less" : "expand-more"} size={24} color={colors.muted} />
          </Pressable>

          {showSchedule && (
            <View style={styles.scheduleContent}>
              {/* تفعيل/تعطيل */}
              <View style={styles.scheduleRow}>
                <Text style={[styles.scheduleLabel, { color: colors.foreground }]}>
                  {isAr ? "تفعيل الجدولة التلقائية" : "Enable Auto Schedule"}
                </Text>
                <Switch
                  value={schedule.enabled}
                  onValueChange={(value) => {
                    saveScheduleSettings({ ...schedule, enabled: value });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {schedule.enabled && (
                <>
                  {/* التكرار */}
                  <View style={styles.scheduleSection}>
                    <Text style={[styles.scheduleSectionTitle, { color: colors.foreground }]}>
                      {isAr ? "التكرار" : "Frequency"}
                    </Text>
                    <View style={styles.frequencyRow}>
                      {frequencyOptions.map((opt) => (
                        <Pressable
                          key={opt.value}
                          onPress={() => saveScheduleSettings({ ...schedule, frequency: opt.value })}
                          style={({ pressed }) => [
                            styles.frequencyBtn,
                            { borderColor: schedule.frequency === opt.value ? colors.primary : colors.border },
                            schedule.frequency === opt.value && { backgroundColor: colors.primary + "20" },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[
                            styles.frequencyBtnText,
                            { color: schedule.frequency === opt.value ? colors.primary : colors.muted },
                          ]}>
                            {isAr ? opt.labelAr : opt.labelEn}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* الوقت */}
                  <View style={styles.scheduleSection}>
                    <Text style={[styles.scheduleSectionTitle, { color: colors.foreground }]}>
                      {isAr ? "وقت النسخ الاحتياطي" : "Backup Time"}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                      {timeOptions.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => saveScheduleSettings({ ...schedule, time })}
                          style={({ pressed }) => [
                            styles.timeBtn,
                            { borderColor: schedule.time === time ? colors.primary : colors.border },
                            schedule.time === time && { backgroundColor: colors.primary + "20" },
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[
                            styles.timeBtnText,
                            { color: schedule.time === time ? colors.primary : colors.muted },
                          ]}>
                            {time}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* معلومات الجدولة */}
                  <View style={[styles.scheduleInfo, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                    <MaterialIcons name="info" size={20} color={colors.primary} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      {schedule.lastAutoBackup && (
                        <Text style={[styles.scheduleInfoText, { color: colors.foreground }]}>
                          {isAr ? "آخر نسخة تلقائية: " : "Last auto backup: "}
                          {new Date(schedule.lastAutoBackup).toLocaleString(isAr ? "ar-SA" : "en-US")}
                        </Text>
                      )}
                      {schedule.nextBackup && (
                        <Text style={[styles.scheduleInfoText, { color: colors.muted }]}>
                          {isAr ? "النسخة التالية: " : "Next backup: "}
                          {new Date(schedule.nextBackup).toLocaleString(isAr ? "ar-SA" : "en-US")}
                        </Text>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* النسخ الاحتياطي اليدوي */}
        <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.actionHeader}>
            <MaterialIcons name="backup" size={32} color={colors.primary} />
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: colors.foreground }]}>{isAr ? "إنشاء نسخة احتياطية يدوية" : "Create Manual Backup"}</Text>
              <Text style={[styles.actionDesc, { color: colors.muted }]}>
                {isAr ? "حفظ جميع بيانات التطبيق في ملف JSON (محلي + سيرفر)" : "Save all app data in a JSON file (local + server)"}
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
                {isAr ? "استيراد بيانات من ملف نسخة احتياطية سابقة" : "Import data from a previous backup file"}
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

        {/* النسخ الاحتياطية على السيرفر */}
        {serverBackups.length > 0 && (
          <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.actionHeader}>
              <MaterialIcons name="cloud-done" size={32} color="#22c55e" />
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                  {isAr ? `النسخ المحفوظة على السيرفر (${serverBackups.length})` : `Server Backups (${serverBackups.length})`}
                </Text>
              </View>
            </View>
            {serverBackups.slice(0, 5).map((backup: any, index: number) => (
              <View key={index} style={[styles.backupItem, { borderTopColor: colors.border }]}>
                <MaterialIcons
                  name={backup.backupType === "auto" ? "autorenew" : "save"}
                  size={18}
                  color={backup.backupType === "auto" ? "#8b5cf6" : colors.primary}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.backupName, { color: colors.foreground }]}>{backup.backupName}</Text>
                  <Text style={[styles.backupDate, { color: colors.muted }]}>
                    {backup.createdAt ? new Date(backup.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : ""}
                  </Text>
                </View>
                <View style={[styles.backupBadge, { backgroundColor: backup.backupType === "auto" ? "#8b5cf620" : colors.primary + "20" }]}>
                  <Text style={[styles.backupBadgeText, { color: backup.backupType === "auto" ? "#8b5cf6" : colors.primary }]}>
                    {backup.backupType === "auto" ? (isAr ? "تلقائي" : "Auto") : (isAr ? "يدوي" : "Manual")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* تحذيرات */}
        <View style={[styles.warningCard, { backgroundColor: "#fef3c7", borderColor: "#f59e0b" }]}>
          <MaterialIcons name="warning" size={24} color="#f59e0b" />
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={[styles.warningTitle, { color: "#92400e" }]}>{isAr ? "تنبيهات مهمة" : "Important Alerts"}</Text>
            <Text style={[styles.warningText, { color: "#92400e" }]}>
              {isAr ? "• احرص على إنشاء نسخة احتياطية بشكل دوري\n• عند الاستعادة سيتم استبدال جميع البيانات الحالية\n• احفظ ملف النسخة الاحتياطية في مكان آمن\n• النسخ التلقائية تُحفظ على السيرفر تلقائياً" : "• Make sure to create a backup periodically\n• When restoring, all current data will be replaced\n• Save the backup file in a safe place\n• Auto backups are saved to server automatically"}
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
    marginBottom: 12,
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
  scheduleContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  scheduleSection: {
    marginBottom: 16,
  },
  scheduleSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "right",
  },
  frequencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  frequencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
  },
  frequencyBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeScroll: {
    flexDirection: "row",
  },
  timeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    marginRight: 8,
  },
  timeBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scheduleInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  scheduleInfoText: {
    fontSize: 12,
    lineHeight: 20,
  },
  backupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  backupName: {
    fontSize: 13,
    fontWeight: "500",
  },
  backupDate: {
    fontSize: 11,
    marginTop: 2,
  },
  backupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  backupBadgeText: {
    fontSize: 10,
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
