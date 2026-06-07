import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";

type AdminTab = "employees" | "departments" | "machines" | "stages" | "boardData" | "settings" | "auditLog";

interface Employee {
  id: number;
  name: string;
  username: string;
  department: string;
  position: string;
  role: string;
}

interface Department {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  isActive: number;
}

interface Machine {
  id: number;
  machineCode: string;
  machineName: string;
  department: string;
  status: string;
}

interface BoardData {
  id: number;
  userId: number;
  dataType: string;
  value: string;
  date: string;
}

export default function ComprehensiveAdminPanel() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<AdminTab>("employees");
  const [searchText, setSearchText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch employees
  const { data: employees, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/users");
        return response.json();
      } catch (error) {
        console.error("Error fetching employees:", error);
        return [];
      }
    },
  });

  // Fetch departments
  const { data: departments, isLoading: departmentsLoading, refetch: refetchDepartments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/departments");
        return response.json();
      } catch (error) {
        console.error("Error fetching departments:", error);
        return [];
      }
    },
  });

  // Fetch machines
  const { data: machines, isLoading: machinesLoading, refetch: refetchMachines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/machines");
        return response.json();
      } catch (error) {
        console.error("Error fetching machines:", error);
        return [];
      }
    },
  });

  // Fetch board data
  const { data: boardData, isLoading: boardDataLoading, refetch: refetchBoardData } = useQuery({
    queryKey: ["boardData"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/board-data");
        return response.json();
      } catch (error) {
        console.error("Error fetching board data:", error);
        return [];
      }
    },
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      refetchEmployees();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف الموظف بنجاح" : "Employee deleted successfully");
    },
  });

  // Delete board data mutation
  const deleteBoardDataMutation = useMutation({
    mutationFn: async (dataId: number) => {
      const response = await fetch(`/api/admin/board-data/${dataId}`, { method: "DELETE" });
      return response.json();
    },
    onSuccess: () => {
      refetchBoardData();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف البيانات بنجاح" : "Data deleted successfully");
    },
  });

  // Clear all board data mutation
  const clearAllBoardDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/board-data/clear-all", { method: "POST" });
      return response.json();
    },
    onSuccess: () => {
      refetchBoardData();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تصفير جميع البيانات بنجاح" : "All data cleared successfully");
    },
  });

  const handleDeleteEmployee = (employeeId: number, employeeName: string) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? `هل تريد حذف الموظف ${employeeName}؟` : `Are you sure you want to delete ${employeeName}?`,
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "حذف" : "Delete",
          onPress: () => deleteEmployeeMutation.mutate(employeeId),
          style: "destructive",
        },
      ]
    );
  };

  const handleClearAllBoardData = () => {
    Alert.alert(
      isAr ? "تأكيد التصفير" : "Confirm Clear",
      isAr ? "هل تريد تصفير جميع بيانات ممثل مجلس الإدارة؟ هذا الإجراء لا يمكن التراجع عنه" : "Are you sure you want to clear all board representative data? This action cannot be undone.",
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "تصفير" : "Clear",
          onPress: () => clearAllBoardDataMutation.mutate(),
          style: "destructive",
        },
      ]
    );
  };

  const renderEmployeesTab = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => router.push("/users-management")}
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
      >
        <MaterialIcons name="person-add" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? "إضافة موظف جديد" : "Add New Employee"}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border }]}
        placeholder={isAr ? "ابحث عن موظف..." : "Search employee..."}
        placeholderTextColor={colors.muted}
        value={searchText}
        onChangeText={setSearchText}
      />

      {employeesLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={employees?.filter((emp: Employee) =>
            emp.name.toLowerCase().includes(searchText.toLowerCase()) ||
            emp.username.toLowerCase().includes(searchText.toLowerCase())
          )}
          keyExtractor={(item: Employee) => item.id.toString()}
          renderItem={({ item }: { item: Employee }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>@{item.username}</Text>
                <Text style={[styles.cardDetail, { color: colors.muted }]}>
                  {isAr ? "القسم: " : "Department: "}{item.department}
                </Text>
                <Text style={[styles.cardDetail, { color: colors.muted }]}>
                  {isAr ? "الدور: " : "Role: "}{item.role}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => router.push("/users-management")}
                  style={styles.actionIcon}
                >
                  <MaterialIcons name="edit" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteEmployee(item.id, item.name)}
                  style={styles.actionIcon}
                >
                  <MaterialIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderBoardDataTab = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={handleClearAllBoardData}
        style={[styles.actionButton, { backgroundColor: "#ef4444" }]}
      >
        <MaterialIcons name="delete-sweep" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? "تصفير جميع البيانات" : "Clear All Data"}
        </Text>
      </TouchableOpacity>

      {boardDataLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={boardData}
          keyExtractor={(item: BoardData) => item.id.toString()}
          renderItem={({ item }: { item: BoardData }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.dataType}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{item.value}</Text>
                <Text style={[styles.cardDetail, { color: colors.muted }]}>
                  {isAr ? "التاريخ: " : "Date: "}{item.date}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => deleteBoardDataMutation.mutate(item.id)}
                style={styles.actionIcon}
              >
                <MaterialIcons name="delete" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderMachinesTab = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => setShowAddForm(!showAddForm)}
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
      >
        <MaterialIcons name={showAddForm ? "close" : "add"} size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? (showAddForm ? "إلغاء" : "إضافة مكينة جديدة") : (showAddForm ? "Cancel" : "Add New Machine")}
        </Text>
      </TouchableOpacity>

      {machinesLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={machines}
          keyExtractor={(item: Machine) => item.id.toString()}
          renderItem={({ item }: { item: Machine }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  {item.machineCode} - {item.machineName}
                </Text>
                <Text style={[styles.cardDetail, { color: colors.muted }]}>
                  {isAr ? "القسم: " : "Department: "}{item.department}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "active"
                          ? "#10b981"
                          : item.status === "maintenance"
                          ? "#f59e0b"
                          : "#ef4444",
                    },
                  ]}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderDepartmentsTab = () => (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        onPress={() => setShowAddForm(!showAddForm)}
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
      >
        <MaterialIcons name={showAddForm ? "close" : "add"} size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? (showAddForm ? "إلغاء" : "إضافة قسم جديد") : (showAddForm ? "Cancel" : "Add New Department")}
        </Text>
      </TouchableOpacity>

      {departmentsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(item: Department) => item.id.toString()}
          renderItem={({ item }: { item: Department }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.name}</Text>
                {item.description && (
                  <Text style={[styles.cardDetail, { color: colors.muted }]}>{item.description}</Text>
                )}
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: item.isActive ? "#10b981" : "#ef4444" },
                  ]}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                    {item.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}
                  </Text>
                </View>
              </View>
            </View>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.settingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {isAr ? "إدارة النظام" : "System Management"}
        </Text>

        <TouchableOpacity
          onPress={() => router.push("/role-management")}
          style={[styles.settingItem, { borderColor: colors.border }]}
        >
          <MaterialIcons name="security" size={24} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>
              {isAr ? "إدارة الأدوار والصلاحيات" : "Manage Roles & Permissions"}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              {isAr ? "تعديل صلاحيات المستخدمين" : "Edit user permissions"}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/backup-restore")}
          style={[styles.settingItem, { borderColor: colors.border }]}
        >
          <MaterialIcons name="backup" size={24} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>
              {isAr ? "النسخ الاحتياطية" : "Backups"}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              {isAr ? "إنشاء واستعادة النسخ الاحتياطية" : "Create and restore backups"}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/activity-log")}
          style={[styles.settingItem, { borderColor: colors.border }]}
        >
          <MaterialIcons name="history" size={24} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.settingTitle, { color: colors.foreground }]}>
              {isAr ? "سجل النشاطات" : "Activity Log"}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              {isAr ? "عرض جميع التعديلات والأنشطة" : "View all modifications and activities"}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name={isRtl ? "chevron-right" : "chevron-left"} size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAr ? "لوحة التحكم الشاملة" : "Comprehensive Admin Panel"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {[
          { id: "employees", labelAr: "الموظفين", labelEn: "Employees", icon: "people" },
          { id: "departments", labelAr: "الأقسام", labelEn: "Departments", icon: "domain" },
          { id: "machines", labelAr: "المكائن", labelEn: "Machines", icon: "settings-input-composite" },
          { id: "stages", labelAr: "المراحل", labelEn: "Stages", icon: "timeline" },
          { id: "boardData", labelAr: "ممثل المجلس", labelEn: "Board Rep", icon: "person-outline" },
          { id: "settings", labelAr: "الإعدادات", labelEn: "Settings", icon: "settings" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as AdminTab)}
            style={[
              styles.tab,
              activeTab === tab.id && [styles.activeTab, { borderBottomColor: colors.primary }],
            ]}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? colors.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.primary : colors.muted },
              ]}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={{ flex: 1, padding: 12 }}>
        {activeTab === "employees" && renderEmployeesTab()}
        {activeTab === "departments" && renderDepartmentsTab()}
        {activeTab === "machines" && renderMachinesTab()}
        {activeTab === "boardData" && renderBoardDataTab()}
        {activeTab === "settings" && renderSettingsTab()}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  tabsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cardDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    marginLeft: 8,
  },
  actionIcon: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  settingsSection: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
