import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingSection {
  title: string;
  titleEn: string;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  labelAr: string;
  labelEn: string;
  descAr?: string;
  descEn?: string;
  icon: string;
  iconColor: string;
  type: "toggle" | "select" | "navigate";
}

const NOTIFICATION_KEYS = {
  production_alerts: "notif_production_alerts",
  waste_alerts: "notif_waste_alerts",
  task_reminders: "notif_task_reminders",
  daily_report: "notif_daily_report",
  maintenance_alerts: "notif_maintenance_alerts",
};

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, toggleLanguage, isRtl, t } = useLanguage();
  const isAr = language === "ar";
  const textAlign = isRtl ? "right" : "left";

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    production_alerts: true,
    waste_alerts: true,
    task_reminders: true,
    daily_report: true,
    maintenance_alerts: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedDark = await AsyncStorage.getItem("dark_mode");
      if (savedDark !== null) setDarkMode(savedDark === "true");

      const notifState: any = {};
      for (const [key, storageKey] of Object.entries(NOTIFICATION_KEYS)) {
        const val = await AsyncStorage.getItem(storageKey);
        notifState[key] = val !== "false";
      }
      setNotifications(notifState);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkMode(value);
    await AsyncStorage.setItem("dark_mode", value.toString());
  };

  const handleNotificationToggle = async (key: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(NOTIFICATION_KEYS[key as keyof typeof NOTIFICATION_KEYS], value.toString());
  };

  const handleClearCache = () => {
    Alert.alert(
      isAr ? "مسح ذاكرة التخزين المؤقت" : "Clear Cache",
      isAr ? "هل أنت متأكد؟ سيتم حذف البيانات المؤقتة فقط." : "Are you sure? Only temporary data will be deleted.",
      [
        { text: t("cancel") },
        {
          text: t("confirm"),
          onPress: async () => {
            Alert.alert(t("success"), isAr ? "تم مسح ذاكرة التخزين المؤقت" : "Cache cleared successfully");
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("settings")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {isAr ? "اللغة والمظهر" : "Language & Appearance"}
          </Text>
          <View style={styles.card}>
            {/* Language */}
            <TouchableOpacity onPress={toggleLanguage} style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#3b82f615" }]}>
                  <MaterialIcons name="language" size={20} color="#3b82f6" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {t("language")}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "العربية" : "English"}
                  </Text>
                </View>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeText}>
                  {isAr ? "EN" : "ع"}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Dark Mode */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#6366f115" }]}>
                  <MaterialIcons name="dark-mode" size={20} color="#6366f1" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "الوضع الداكن" : "Dark Mode"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "تفعيل المظهر الداكن للتطبيق" : "Enable dark theme"}
                  </Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {isAr ? "الإشعارات" : "Notifications"}
          </Text>
          <View style={styles.card}>
            {/* Production Alerts */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#3b82f615" }]}>
                  <MaterialIcons name="factory" size={20} color="#3b82f6" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "تنبيهات الإنتاج" : "Production Alerts"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "إشعارات عند إدخال بيانات جديدة" : "Notify on new data entry"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.production_alerts}
                onValueChange={(v) => handleNotificationToggle("production_alerts", v)}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>

            <View style={styles.divider} />

            {/* Waste Alerts */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#ef444415" }]}>
                  <MaterialIcons name="warning-amber" size={20} color="#ef4444" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "تنبيهات الهدر" : "Waste Alerts"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "إشعارات عند تجاوز حدود الهدر" : "Notify when waste exceeds limits"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.waste_alerts}
                onValueChange={(v) => handleNotificationToggle("waste_alerts", v)}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>

            <View style={styles.divider} />

            {/* Task Reminders */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#14b8a615" }]}>
                  <MaterialIcons name="task-alt" size={20} color="#14b8a6" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "تذكير المهام" : "Task Reminders"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "تذكير بالمهام المستحقة" : "Remind about due tasks"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.task_reminders}
                onValueChange={(v) => handleNotificationToggle("task_reminders", v)}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>

            <View style={styles.divider} />

            {/* Daily Report */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#f59e0b15" }]}>
                  <MaterialIcons name="summarize" size={20} color="#f59e0b" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "التقرير اليومي" : "Daily Report"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "تذكير بإرسال التقرير قبل 3 عصراً" : "Remind to submit report before 3 PM"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.daily_report}
                onValueChange={(v) => handleNotificationToggle("daily_report", v)}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>

            <View style={styles.divider} />

            {/* Maintenance Alerts */}
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#8b5cf615" }]}>
                  <MaterialIcons name="build" size={20} color="#8b5cf6" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "تنبيهات الصيانة" : "Maintenance Alerts"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "إشعارات عند وجود أعطال" : "Notify on equipment issues"}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.maintenance_alerts}
                onValueChange={(v) => handleNotificationToggle("maintenance_alerts", v)}
                trackColor={{ false: "#e5e7eb", true: "#0a7ea4" }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>

        {/* Storage & Data Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {isAr ? "البيانات والتخزين" : "Data & Storage"}
          </Text>
          <View style={styles.card}>
            <TouchableOpacity onPress={handleClearCache} style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#f9731615" }]}>
                  <MaterialIcons name="cleaning-services" size={20} color="#f97316" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "مسح ذاكرة التخزين المؤقت" : "Clear Cache"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {isAr ? "حذف البيانات المؤقتة لتحسين الأداء" : "Delete temporary data to improve performance"}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {isAr ? "حول التطبيق" : "About"}
          </Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#0a7ea415" }]}>
                  <MaterialIcons name="info-outline" size={20} color="#0a7ea4" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {isAr ? "الإصدار" : "Version"}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>1.0.0</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#0a7ea415" }]}>
                  <MaterialIcons name="factory" size={20} color="#0a7ea4" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingLabel, { textAlign }]}>
                    {t("app_name")}
                  </Text>
                  <Text style={[styles.settingDesc, { textAlign }]}>
                    {t("app_subtitle")}
                  </Text>
                </View>
              </View>
            </View>
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
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  settingDesc: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  langBadge: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  langBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 64,
  },
});
