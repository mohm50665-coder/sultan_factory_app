import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import {
  notificationService,
  Notification,
} from "@/lib/services/notification.service";

interface NotificationGroup {
  date: string;
  notifications: Notification[];
}

export default function NotificationsCenterScreen() {
  const router = useRouter();
  const colors = useColors();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    taskCompleted: true,
    equipmentStopped: true,
    wasteExceeded: true,
    alerts: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const allNotifications = await notificationService.getAllNotifications();
      setNotifications(allNotifications);

      const currentSettings = await notificationService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإشعار");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإشعارات");
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في حذف الإشعار");
    }
  };

  const handleDeleteAllNotifications = async () => {
    Alert.alert(
      "تأكيد",
      "هل أنت متأكد من حذف جميع الإشعارات؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              await notificationService.deleteAllNotifications();
              loadNotifications();
            } catch (error) {
              Alert.alert("خطأ", "فشل في حذف الإشعارات");
            }
          },
        },
      ]
    );
  };

  const handleSettingChange = async (key: string, value: boolean) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await notificationService.updateSettings(newSettings);
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإعدادات");
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "task_completed":
        return "check-circle";
      case "equipment_stopped":
        return "error";
      case "waste_exceeded":
        return "warning";
      case "alert":
        return "notifications-active";
      case "info":
        return "info";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "task_completed":
        return "#22c55e";
      case "equipment_stopped":
        return "#ef4444";
      case "waste_exceeded":
        return "#f59e0b";
      case "alert":
        return "#ef4444";
      case "info":
        return "#0a7ea4";
      default:
        return colors.primary;
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return "اليوم";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "أمس";
    } else {
      return d.toLocaleDateString("ar-SA");
    }
  };

  const groupNotificationsByDate = (): NotificationGroup[] => {
    const groups: Record<string, Notification[]> = {};

    notifications.forEach((notif) => {
      const dateKey = formatDate(notif.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(notif);
    });

    return Object.entries(groups).map(([date, notifs]) => ({
      date,
      notifications: notifs,
    }));
  };

  const renderNotificationItem = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      onPress={() => handleMarkAsRead(notification.id)}
      className={`flex-row items-start p-4 border-b border-border ${
        !notification.read ? "bg-primary/5" : ""
      }`}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{
          backgroundColor: getNotificationColor(notification.type) + "20",
        }}
      >
        <MaterialIcons
          name={getNotificationIcon(notification.type) as any}
          size={20}
          color={getNotificationColor(notification.type)}
        />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground font-semibold text-sm">
            {notification.title}
          </Text>
          {!notification.read && (
            <View className="w-2 h-2 rounded-full bg-primary" />
          )}
        </View>
        <Text className="text-muted text-xs mt-1 leading-4">
          {notification.body}
        </Text>
        <Text className="text-muted text-xs mt-2">
          {new Date(notification.timestamp).toLocaleTimeString("ar-SA", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => handleDeleteNotification(notification.id)}
        className="ml-2 p-1"
      >
        <MaterialIcons name="close" size={18} color={colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-bold text-xl">الإشعارات</Text>
            <Text className="text-white/80 text-sm mt-1">
              {notifications.filter((n) => !n.read).length} إشعارات جديدة
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(!showSettings)}
          className="bg-white/20 rounded-full p-2"
        >
          <MaterialIcons name="settings" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {showSettings ? (
        // شاشة الإعدادات
        <ScrollView className="flex-1">
          <View className="p-6">
            <Text className="text-foreground font-bold text-base mb-4">
              إعدادات الإشعارات
            </Text>

            {/* إعدادات أنواع الإشعارات */}
            <View className="bg-surface rounded-lg overflow-hidden border border-border mb-6">
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name="task-alt" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold text-sm ml-3">
                    إشعارات المهام المكتملة
                  </Text>
                </View>
                <Switch
                  value={settings.taskCompleted}
                  onValueChange={(value) =>
                    handleSettingChange("taskCompleted", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.taskCompleted ? colors.primary : colors.muted}
                />
              </View>

              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name="error" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold text-sm ml-3">
                    إشعارات توقف الأجهزة
                  </Text>
                </View>
                <Switch
                  value={settings.equipmentStopped}
                  onValueChange={(value) =>
                    handleSettingChange("equipmentStopped", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.equipmentStopped ? colors.primary : colors.muted}
                />
              </View>

              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name="warning" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold text-sm ml-3">
                    إشعارات تجاوز الهدر
                  </Text>
                </View>
                <Switch
                  value={settings.wasteExceeded}
                  onValueChange={(value) =>
                    handleSettingChange("wasteExceeded", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.wasteExceeded ? colors.primary : colors.muted}
                />
              </View>
            </View>

            {/* إعدادات الصوت والاهتزاز */}
            <Text className="text-foreground font-bold text-base mb-4">
              إعدادات الصوت والاهتزاز
            </Text>

            <View className="bg-surface rounded-lg overflow-hidden border border-border">
              <View className="flex-row items-center justify-between p-4 border-b border-border">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name="volume-up" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold text-sm ml-3">
                    تفعيل الصوت
                  </Text>
                </View>
                <Switch
                  value={settings.soundEnabled}
                  onValueChange={(value) =>
                    handleSettingChange("soundEnabled", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.soundEnabled ? colors.primary : colors.muted}
                />
              </View>

              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name="vibration" size={20} color={colors.primary} />
                  <Text className="text-foreground font-semibold text-sm ml-3">
                    تفعيل الاهتزاز
                  </Text>
                </View>
                <Switch
                  value={settings.vibrationEnabled}
                  onValueChange={(value) =>
                    handleSettingChange("vibrationEnabled", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.vibrationEnabled ? colors.primary : colors.muted}
                />
              </View>
            </View>

            {/* زر العودة */}
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              className="bg-primary rounded-lg p-4 items-center justify-center mt-6"
            >
              <Text className="text-white font-semibold text-base">
                العودة للإشعارات
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        // شاشة الإشعارات
        <>
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <MaterialIcons name="notifications-none" size={64} color={colors.muted} />
              <Text className="text-foreground font-semibold text-base mt-4">
                لا توجد إشعارات
              </Text>
              <Text className="text-muted text-sm mt-2 text-center">
                ستظهر الإشعارات هنا عند حدوث أحداث مهمة في النظام
              </Text>
            </View>
          ) : (
            <>
              {/* أزرار الإجراءات */}
              <View className="px-6 py-4 flex-row gap-2">
                {notifications.some((n) => !n.read) && (
                  <TouchableOpacity
                    onPress={handleMarkAllAsRead}
                    className="flex-1 bg-primary rounded-lg py-2 px-3 items-center justify-center"
                  >
                    <Text className="text-white font-semibold text-sm">
                      تحديد الكل كمقروء
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleDeleteAllNotifications}
                  className="flex-1 bg-error/20 rounded-lg py-2 px-3 items-center justify-center border border-error"
                >
                  <Text className="text-error font-semibold text-sm">
                    حذف الكل
                  </Text>
                </TouchableOpacity>
              </View>

              {/* قائمة الإشعارات */}
              <FlatList
                data={groupNotificationsByDate()}
                keyExtractor={(item) => item.date}
                renderItem={({ item: group }) => (
                  <View>
                    <View className="px-6 py-3 bg-background">
                      <Text className="text-muted font-semibold text-xs">
                        {group.date}
                      </Text>
                    </View>
                    {group.notifications.map(renderNotificationItem)}
                  </View>
                )}
              />
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
