import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "task" | "equipment" | "event" | "alert";
  timestamp: string;
  read: boolean;
  icon: string;
  color: string;
}

export default function NotificationsScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const colors = useColors();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: isAr ? "انتهاء المهمة" : "Task Completed",
      message: isAr ? "تم إكمال مهمة فحص الإنتاج بنجاح" : "Production inspection task completed successfully",
      type: "task",
      timestamp: isAr ? "منذ 5 دقائق" : "5 mins ago",
      read: false,
      icon: "check-circle",
      color: "#10B981",
    },
    {
      id: "2",
      title: isAr ? "توقف الجهاز" : "Equipment Stopped",
      message: isAr ? "توقف جهاز الكاوية رقم 3 - يحتاج صيانة" : "Ironing machine #3 stopped - needs maintenance",
      type: "equipment",
      timestamp: isAr ? "منذ 15 دقيقة" : "15 mins ago",
      read: false,
      icon: "error",
      color: "#EF4444",
    },
    {
      id: "3",
      title: isAr ? "حدث مهم" : "Important Event",
      message: isAr ? "تم تجاوز حد الإنتاج المخطط له بنسبة 20%" : "Planned production limit exceeded by 20%",
      type: "event",
      timestamp: isAr ? "منذ ساعة" : "1 hour ago",
      read: true,
      icon: "trending-up",
      color: "#3B82F6",
    },
    {
      id: "4",
      title: isAr ? "تنبيه" : "Alert",
      message: isAr ? "معدل الهدر في الإنتاج أعلى من المعدل الطبيعي" : "Production waste rate is higher than normal",
      type: "alert",
      timestamp: isAr ? "منذ ساعتين" : "2 hours ago",
      read: true,
      icon: "warning",
      color: "#F59E0B",
    },
    {
      id: "5",
      title: isAr ? "انتهاء المهمة" : "Task Completed",
      message: isAr ? "تم تسليم الطلب رقم 2024-001" : "Order #2024-001 delivered",
      type: "task",
      timestamp: isAr ? "منذ 3 ساعات" : "3 hours ago",
      read: true,
      icon: "check-circle",
      color: "#10B981",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  const handleClearAll = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      onPress={() => handleMarkAsRead(notification.id)}
      style={{
        backgroundColor: notification.read ? colors.surface : colors.primary + "10",
        borderLeftWidth: 4,
        borderLeftColor: notification.color,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        flexDirection: isAr ? "row" : "row-reverse",
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: notification.color + "20",
          justifyContent: "center",
          alignItems: "center",
          marginRight: isAr ? 12 : 0,
          marginLeft: isAr ? 0 : 12,
        }}
      >
        <MaterialIcons
          name={notification.icon as any}
          size={20}
          color={notification.color}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: notification.read ? "500" : "600",
              flex: 1,
              textAlign: isAr ? "right" : "left",
            }}
          >
            {notification.title}
          </Text>
          {!notification.read && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
                marginLeft: isAr ? 8 : 0,
                marginRight: isAr ? 0 : 8,
              }}
            />
          )}
        </View>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 4,
            marginBottom: 4,
            textAlign: isAr ? "right" : "left",
          }}
        >
          {notification.message}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: isAr ? "right" : "left" }}>
          {notification.timestamp}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            flexDirection: isAr ? "row" : "row-reverse",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 4,
                textAlign: isAr ? "right" : "left",
              }}
            >
              {isAr ? "الإشعارات" : "Notifications"}
            </Text>
            {unreadCount > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: isAr ? "right" : "left" }}>
                {unreadCount} {isAr ? "إشعارات جديدة" : "new notifications"}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: colors.surface,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "500", textAlign: isAr ? "right" : "left" }}>
                {isAr ? "تحديد الكل" : "Mark all as read"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* الإشعارات */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {notifications.length > 0 ? (
            notifications.map(renderNotification)
          ) : (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
              }}
            >
              <MaterialIcons
                name="notifications-none"
                size={48}
                color={colors.muted}
              />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: isAr ? "right" : "left",
                }}
              >
                {isAr ? "لا توجد إشعارات" : "No notifications"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
