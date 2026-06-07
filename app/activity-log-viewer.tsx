import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { SearchFilter, type FilterOption } from "@/components/search-filter";
import { trpc } from "@/lib/trpc";

interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details?: any;
  createdAt: Date | string;
}

export default function ActivityLogViewerScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [searchText, setSearchText] = useState("");
  const [filterAction, setFilterAction] = useState<string | null>(null);

  // Fetch activity logs from server
  const { data: logs, isLoading } = trpc.activityLog.getAll.useQuery();

  // Get unique actions for filter options
  const uniqueActions = Array.from(
    new Set((logs || []).map((log: ActivityLogEntry) => log.action))
  ).map((action) => ({
    label: getActionLabel(action),
    value: action,
    color: getActionColor(action),
  }));

  // Filter logs based on search and filters
  const filteredLogs = (logs || []).filter((log: ActivityLogEntry) => {
    const matchesSearch =
      !searchText ||
      log.action.toLowerCase().includes(searchText.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchText.toLowerCase());

    const matchesAction = !filterAction || log.action === filterAction;

    return matchesSearch && matchesAction;
  });

  function getActionColor(action: string) {
    switch (action) {
      case "create":
        return "#10b981";
      case "update":
        return "#3b82f6";
      case "delete":
        return "#ef4444";
      default:
        return colors.muted;
    }
  }

  function getActionIcon(action: string) {
    switch (action) {
      case "create":
        return "add-circle";
      case "update":
        return "edit";
      case "delete":
        return "delete";
      default:
        return "info";
    }
  }

  function getActionLabel(action: string) {
    switch (action) {
      case "create":
        return isAr ? "إنشاء" : "Create";
      case "update":
        return isAr ? "تعديل" : "Update";
      case "delete":
        return isAr ? "حذف" : "Delete";
      default:
        return action;
    }
  }

  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(isAr ? "ar-SA" : "en-US");
    } catch {
      return String(dateString);
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <MaterialIcons
              name={isRtl ? "chevron-right" : "chevron-left"}
              size={24}
              color="white"
            />
          </Pressable>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", flex: 1 }}>
            {isAr ? "سجل التعديلات" : "Activity Log"}
          </Text>
        </View>
      </View>

      {/* Search and Filter */}
      <SearchFilter
        searchPlaceholder={isAr ? "ابحث عن إجراء..." : "Search actions..."}
        onSearchChange={setSearchText}
        searchValue={searchText}
        filters={[
          {
            label: isAr ? "الإجراء" : "Action",
            options: uniqueActions,
            value: filterAction,
            onChange: setFilterAction,
          },
        ]}
        isRtl={isRtl}
      />

      {/* Logs List */}
      <ScrollView style={styles.logsList} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {isLoading ? (
          <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={{ justifyContent: "center", alignItems: "center", paddingVertical: 40 }}>
            <MaterialIcons name="history" size={48} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 12, textAlign: "center" }}>
              {isAr ? "لا توجد تعديلات" : "No activity logs found"}
            </Text>
          </View>
        ) : (
          filteredLogs.map((log: ActivityLogEntry) => (
            <View
              key={log.id}
              style={[
                styles.logCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: `${getActionColor(log.action)}20` },
                  ]}
                >
                  <MaterialIcons
                    name={getActionIcon(log.action) as any}
                    size={20}
                    color={getActionColor(log.action)}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text
                      style={{
                        color: getActionColor(log.action),
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {getActionLabel(log.action)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {isAr ? "على" : "on"}
                    </Text>
                  </View>

                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, marginTop: 4 }}>
                    {log.entityType}
                  </Text>

                  {log.details && (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                      {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                    </Text>
                  )}

                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
                    {formatDate(log.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  logsList: {
    flex: 1,
  },
  logCard: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
