import React, { useState, useEffect, useCallback } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { alertsService } from "@/lib/services/api.service";
import { MaterialIcons } from "@expo/vector-icons";
import notificationsService, {
  type AppNotification,
  type NotificationType,
} from "@/lib/services/notifications.service";

const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string; labelAr: string; labelEn: string }> = {
  production: { icon: "factory", color: "#3b82f6", labelAr: "إنتاج", labelEn: "Production" },
  waste: { icon: "warning-amber", color: "#ef4444", labelAr: "هدر", labelEn: "Waste" },
  task: { icon: "checklist", color: "#14b8a6", labelAr: "مهام", labelEn: "Tasks" },
  maintenance: { icon: "build", color: "#f59e0b", labelAr: "صيانة", labelEn: "Maintenance" },
  system: { icon: "info", color: "#6366f1", labelAr: "نظام", labelEn: "System" },
  admin: { icon: "admin-panel-settings", color: "#8b5cf6", labelAr: "إداري", labelEn: "Admin" },
  performance: { icon: "assessment", color: "#0f766e", labelAr: "تقييم أداء", labelEn: "Performance" },
};

export default function InAppNotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationType | "all">("all");

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const local = await notificationsService.getAll();
      const serverRows = user?.id ? await alertsService.getByUser(Number(user.id)) : [];
      const server: AppNotification[] = (Array.isArray(serverRows) ? serverRows : []).map((row: any) => ({
        id: `server_${row.id}`,
        type: row.data?.category === "employee_performance" ? "performance" : "admin",
        title: row.title,
        message: row.message,
        isRead: Boolean(row.read),
        createdAt: row.createdAt,
        data: { ...(row.data || {}), serverId: row.id },
      }));
      setNotifications([...server, ...local].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
    const unsubscribe = notificationsService.subscribe(loadNotifications);
    return unsubscribe;
  }, [loadNotifications]);

  const filteredNotifications =
    filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = async (id: string) => {
    if (id.startsWith("server_")) await alertsService.markAsRead(Number(id.replace("server_", "")));
    else await notificationsService.markAsRead(id);
    await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationsService.markAllAsRead();
    if (user?.id) await alertsService.markAllAsRead(Number(user.id));
    await loadNotifications();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t("confirm"),
      isAr ? "هل تريد حذف هذا الإشعار؟" : "Delete this notification?",
      [
        { text: t("cancel") },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            if (id.startsWith("server_")) await alertsService.delete(Number(id.replace("server_", "")));
            else await notificationsService.delete(id);
            await loadNotifications();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      t("confirm"),
      isAr ? "هل تريد حذف جميع الإشعارات؟" : "Clear all notifications?",
      [
        { text: t("cancel") },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            const serverIds = notifications.filter((item) => item.id.startsWith("server_")).map((item) => Number(item.id.replace("server_", "")));
            await Promise.all(serverIds.map((id) => alertsService.delete(id)));
            await notificationsService.clearAll();
            await loadNotifications();
          },
        },
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return isAr ? "الآن" : "Just now";
    if (diffMin < 60) return isAr ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    if (diffDays < 7) return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    return date.toLocaleDateString(isAr ? "ar-SA" : "en-US");
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const config = TYPE_CONFIG[item.type];
    return (
      <TouchableOpacity
        onPress={async () => {
          await handleMarkAsRead(item.id);
          if (item.data?.route) router.push(item.data.route as any);
        }}
        onLongPress={() => handleDelete(item.id)}
        style={[styles.notifCard, !item.isRead && styles.notifUnread]}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${config.color}15` }]}>
          <MaterialIcons name={config.icon as any} size={22} color={config.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.notifMessage, { textAlign: isRtl ? "right" : "left" }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.notifTime, { textAlign: isRtl ? "right" : "left" }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const FILTER_OPTIONS: Array<{ key: NotificationType | "all"; labelAr: string; labelEn: string }> = [
    { key: "all", labelAr: "الكل", labelEn: "All" },
    { key: "production", labelAr: "إنتاج", labelEn: "Production" },
    { key: "waste", labelAr: "هدر", labelEn: "Waste" },
    { key: "task", labelAr: "مهام", labelEn: "Tasks" },
    { key: "maintenance", labelAr: "صيانة", labelEn: "Maintenance" },
    { key: "admin", labelAr: "إداري", labelEn: "Admin" },
    { key: "performance", labelAr: "تقييم أداء", labelEn: "Performance" },
  ];

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>
          {t("notifications")} {unreadCount > 0 ? `(${unreadCount})` : ""}
        </Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerActionBtn}>
              <MaterialIcons name="done-all" size={20} color="white" />
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.headerActionBtn}>
              <MaterialIcons name="delete-sweep" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: opt }) => (
            <TouchableOpacity
              onPress={() => setFilter(opt.key)}
              style={[styles.filterTab, filter === opt.key && styles.filterTabActive]}
            >
              <Text
                style={[styles.filterTabText, filter === opt.key && styles.filterTabTextActive]}
              >
                {isAr ? opt.labelAr : opt.labelEn}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="notifications-none" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>
            {isAr ? "لا توجد إشعارات" : "No notifications"}
          </Text>
          <Text style={styles.emptySubtext}>
            {isAr ? "ستظهر الإشعارات هنا عند وجود تحديثات" : "Notifications will appear here when there are updates"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  filterTabActive: {
    backgroundColor: "#0a7ea4",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "white",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  notifCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notifUnread: {
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 3,
    borderLeftColor: "#0a7ea4",
  },
  notifIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0a7ea4",
    marginLeft: 8,
  },
  notifMessage: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: "#9ca3af",
  },
});
