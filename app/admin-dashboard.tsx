import React, { useState, useEffect, useCallback } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "@/lib/language-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { simpleAuthService, User } from "@/lib/services/simple-auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEPARTMENTS_STORAGE_KEY = "sultan_departments";
const PROCEDURES_TYPES_KEY = "sultan_procedure_types";

interface Department {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  isActive: boolean;
  parentId?: string; // للأقسام الفرعية
}

interface ProcedureType {
  id: string;
  labelAr: string;
  labelEn: string;
  fields: string[];
  isActive: boolean;
}

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "production", labelAr: "قسم الإنتاج", labelEn: "Production", icon: "precision-manufacturing", isActive: true },
  { id: "machines", labelAr: "مرحلة المكائن", labelEn: "Machines Stage", icon: "precision-manufacturing", isActive: true, parentId: "production" },
  { id: "rosso", labelAr: "مرحلة الروسو", labelEn: "Rosso Stage", icon: "loop", isActive: true, parentId: "production" },
  { id: "qalb", labelAr: "مرحلة القلب", labelEn: "Turning Stage", icon: "flip", isActive: true, parentId: "production" },
  { id: "kawiya", labelAr: "مرحلة الكاوية", labelEn: "Ironing Stage", icon: "local-fire-department", isActive: true, parentId: "production" },
  { id: "inspection", labelAr: "مرحلة الفحص", labelEn: "Inspection Stage", icon: "search", isActive: true, parentId: "production" },
  { id: "packing", labelAr: "مرحلة التغليف", labelEn: "Packing Stage", icon: "inventory-2", isActive: true, parentId: "production" },
  { id: "antislip", labelAr: "مرحلة مانع الانزلاق", labelEn: "Anti-slip Stage", icon: "layers", isActive: true, parentId: "production" },
  { id: "storage", labelAr: "مرحلة التخزين", labelEn: "Storage Stage", icon: "warehouse", isActive: true, parentId: "production" },
  { id: "administrative", labelAr: "الإجراءات الإدارية والمصروفات", labelEn: "Administrative & Expenses", icon: "admin-panel-settings", isActive: true },
  { id: "sales", labelAr: "المبيعات والتحصيل", labelEn: "Sales & Collection", icon: "point-of-sale", isActive: true },
  { id: "maintenance", labelAr: "الصيانة", labelEn: "Maintenance", icon: "build", isActive: true },
  { id: "board_representative", labelAr: "ممثل مجلس الإدارة", labelEn: "Board Representative", icon: "groups", isActive: true },
  { id: "warehouse", labelAr: "المستودعات", labelEn: "Warehouse", icon: "warehouse", isActive: true },
];

const ROLES = [
  { labelAr: "مدير عام (Admin)", labelEn: "General Manager (Admin)", value: "admin" },
  { labelAr: "مشرف", labelEn: "Supervisor", value: "supervisor" },
  { labelAr: "موظف", labelEn: "Employee", value: "user" },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"employees" | "departments" | "procedures">("employees");
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [procedureTypes, setProcedureTypes] = useState<ProcedureType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  // Employee Form
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    username: "",
    phone: "",
    position: "",
    department: "",
    role: "user",
    password: "123456",
  });

  // Department Form
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({
    labelAr: "",
    labelEn: "",
    icon: "folder",
    parentId: "",
  });

  // Procedure Form
  const [showProcForm, setShowProcForm] = useState(false);
  const [editingProc, setEditingProc] = useState<ProcedureType | null>(null);
  const [procForm, setProcForm] = useState({
    labelAr: "",
    labelEn: "",
    fields: "",
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [usersData, deptsData, procsData] = await Promise.all([
        simpleAuthService.getAllUsers(),
        loadDepartments(),
        loadProcedureTypes(),
      ]);
      setUsers(usersData);
      setDepartments(deptsData);
      setProcedureTypes(procsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDepartments = async (): Promise<Department[]> => {
    try {
      const stored = await AsyncStorage.getItem(DEPARTMENTS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      await AsyncStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEPARTMENTS));
      return DEFAULT_DEPARTMENTS;
    } catch {
      return DEFAULT_DEPARTMENTS;
    }
  };

  const saveDepartments = async (depts: Department[]) => {
    await AsyncStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(depts));
    setDepartments(depts);
  };

  const loadProcedureTypes = async (): Promise<ProcedureType[]> => {
    try {
      const stored = await AsyncStorage.getItem(PROCEDURES_TYPES_KEY);
      if (stored) return JSON.parse(stored);
      const defaults: ProcedureType[] = [
        { id: "leave", labelAr: "إجازة", labelEn: "Leave", fields: ["نوع الإجازة", "من تاريخ", "إلى تاريخ", "السبب"], isActive: true },
        { id: "advance", labelAr: "سلفة", labelEn: "Advance", fields: ["المبلغ", "السبب", "طريقة السداد"], isActive: true },
        { id: "transfer", labelAr: "نقل", labelEn: "Transfer", fields: ["القسم الحالي", "القسم المطلوب", "السبب"], isActive: true },
        { id: "complaint", labelAr: "شكوى", labelEn: "Complaint", fields: ["نوع الشكوى", "التفاصيل"], isActive: true },
        { id: "resignation", labelAr: "استقالة", labelEn: "Resignation", fields: ["تاريخ آخر يوم", "السبب"], isActive: true },
      ];
      await AsyncStorage.setItem(PROCEDURES_TYPES_KEY, JSON.stringify(defaults));
      return defaults;
    } catch {
      return [];
    }
  };

  const saveProcedureTypes = async (procs: ProcedureType[]) => {
    await AsyncStorage.setItem(PROCEDURES_TYPES_KEY, JSON.stringify(procs));
    setProcedureTypes(procs);
  };

  // ===== EMPLOYEES =====
  const handleAddEmployee = () => {
    setEditingUser(null);
    setEmployeeForm({ name: "", username: "", phone: "", position: "", department: "", role: "user", password: "123456" });
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (user: User) => {
    setEditingUser(user);
    setEmployeeForm({
      name: user.name,
      username: user.username,
      phone: user.phone,
      position: user.position,
      department: user.department,
      role: user.role,
      password: "",
    });
    setShowEmployeeForm(true);
  };

  const handleSaveEmployee = async () => {
    if (!employeeForm.name || !employeeForm.username || !employeeForm.department) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء ملء الحقول المطلوبة (الاسم، اسم المستخدم، القسم)" : "Please fill in the required fields (Name, Username, Department)");
      return;
    }

    try {
      if (editingUser) {
        // تعديل موظف موجود
        await simpleAuthService.updateUser(editingUser.id, {
          name: employeeForm.name,
          username: employeeForm.username,
          phone: employeeForm.phone,
          position: employeeForm.position,
          department: employeeForm.department,
          role: employeeForm.role,
        });
        if (employeeForm.password) {
          await simpleAuthService.resetUserPassword(editingUser.id, employeeForm.password);
        }
        Alert.alert(isAr ? "نجح" : "Success", isAr ? "تم تحديث بيانات الموظف" : "Employee data updated");
      } else {
        // إضافة موظف جديد
        await simpleAuthService.register({
          name: employeeForm.name,
          username: employeeForm.username,
          phone: employeeForm.phone,
          position: employeeForm.position,
          department: employeeForm.department,
          password: employeeForm.password || "123456",
        });
        // تفعيل الموظف مباشرة لأن الأدمن هو من أضافه
        const allUsers = await simpleAuthService.getAllUsers();
        const newUser = allUsers.find(u => u.username === employeeForm.username);
        if (newUser) {
          await simpleAuthService.toggleUserActive(newUser.id);
        }
        Alert.alert(isAr ? "نجح" : "Success", isAr ? "تم إضافة الموظف وتفعيله" : "Employee added and activated");
      }
      setShowEmployeeForm(false);
      loadAllData();
    } catch (error: any) {
      Alert.alert(isAr ? "خطأ" : "Error", error.message || isAr ? "فشل في حفظ البيانات" : "Failed to save data");
    }
  };

  const handleDeleteEmployee = (user: User) => {
    if (user.role === "admin") {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "لا يمكن حذف حساب المدير العام" : "Cannot delete the general manager account");
      return;
    }
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف الموظف "${user.name}"؟ (ترك العمل)` : `Do you want to delete employee "${user.name}"? (Left work)`, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          await simpleAuthService.deleteUser(user.id);
          Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف الموظف" : "Employee deleted");
          loadAllData();
        },
      },
    ]);
  };

  const handleToggleActive = async (user: User) => {
    await simpleAuthService.toggleUserActive(user.id);
    loadAllData();
  };

  const handleTransferEmployee = (user: User) => {
    setEditingUser(user);
    setEmployeeForm({
      name: user.name,
      username: user.username,
      phone: user.phone,
      position: user.position,
      department: user.department,
      role: user.role,
      password: "",
    });
    setShowEmployeeForm(true);
  };

  // ===== DEPARTMENTS =====
  const handleAddDept = () => {
    setEditingDept(null);
    setDeptForm({ labelAr: "", labelEn: "", icon: "folder", parentId: "" });
    setShowDeptForm(true);
  };

  const handleEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({ labelAr: dept.labelAr, labelEn: dept.labelEn, icon: dept.icon, parentId: dept.parentId || "" });
    setShowDeptForm(true);
  };

  const handleSaveDept = async () => {
    if (!deptForm.labelAr) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء إدخال اسم القسم بالعربي" : "Please enter the department name in Arabic");
      return;
    }
    const updatedDepts = [...departments];
    if (editingDept) {
      const idx = updatedDepts.findIndex(d => d.id === editingDept.id);
      if (idx !== -1) {
        updatedDepts[idx] = { ...updatedDepts[idx], labelAr: deptForm.labelAr, labelEn: deptForm.labelEn, icon: deptForm.icon, parentId: deptForm.parentId || undefined };
      }
    } else {
      const newId = deptForm.labelAr.replace(/\s/g, "_").toLowerCase() + "_" + Date.now();
      updatedDepts.push({
        id: newId,
        labelAr: deptForm.labelAr,
        labelEn: deptForm.labelEn || deptForm.labelAr,
        icon: deptForm.icon || "folder",
        isActive: true,
        parentId: deptForm.parentId || undefined,
      });
    }
    await saveDepartments(updatedDepts);
    setShowDeptForm(false);
    Alert.alert(isAr ? "نجح" : "Success", editingDept ? isAr ? "تم تعديل القسم" : "Department updated" : isAr ? "تم إضافة القسم" : "Department added");
  };

  const handleDeleteDept = (dept: Department) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف القسم "${isAr ? dept.labelAr : dept.labelEn}"؟` : `Do you want to delete department "${isAr ? dept.labelAr : dept.labelEn}"?`, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = departments.filter(d => d.id !== dept.id && d.parentId !== dept.id);
          await saveDepartments(updated);
          Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف القسم" : "Department deleted");
        },
      },
    ]);
  };

  const handleToggleDept = async (dept: Department) => {
    const updated = departments.map(d => d.id === dept.id ? { ...d, isActive: !d.isActive } : d);
    await saveDepartments(updated);
  };

  // ===== PROCEDURES =====
  const handleAddProc = () => {
    setEditingProc(null);
    setProcForm({ labelAr: "", labelEn: "", fields: "" });
    setShowProcForm(true);
  };

  const handleEditProc = (proc: ProcedureType) => {
    setEditingProc(proc);
    setProcForm({ labelAr: proc.labelAr, labelEn: proc.labelEn, fields: proc.fields.join("، ") });
    setShowProcForm(true);
  };

  const handleSaveProc = async () => {
    if (!procForm.labelAr) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء إدخال اسم الإجراء" : "Please enter the procedure name");
      return;
    }
    const updatedProcs = [...procedureTypes];
    const fields = procForm.fields.split(/[،,]/).map(f => f.trim()).filter(Boolean);
    if (editingProc) {
      const idx = updatedProcs.findIndex(p => p.id === editingProc.id);
      if (idx !== -1) {
        updatedProcs[idx] = { ...updatedProcs[idx], labelAr: procForm.labelAr, labelEn: procForm.labelEn, fields };
      }
    } else {
      updatedProcs.push({
        id: "proc_" + Date.now(),
        labelAr: procForm.labelAr,
        labelEn: procForm.labelEn || procForm.labelAr,
        fields,
        isActive: true,
      });
    }
    await saveProcedureTypes(updatedProcs);
    setShowProcForm(false);
    Alert.alert(isAr ? "نجح" : "Success", editingProc ? isAr ? "تم تعديل الإجراء" : "Procedure updated" : isAr ? "تم إضافة الإجراء" : "Procedure added");
  };

  const handleDeleteProc = (proc: ProcedureType) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف الإجراء "${proc.labelAr}"؟` : `Do you want to delete procedure "${proc.labelAr}"?`, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          const updated = procedureTypes.filter(p => p.id !== proc.id);
          await saveProcedureTypes(updated);
          Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف الإجراء" : "Procedure deleted");
        },
      },
    ]);
  };

  // ===== FILTERS =====
  const filteredUsers = users.filter(u => {
    const matchesDept = !filterDept || u.department === filterDept;
    const matchesSearch = !searchText || u.name.includes(searchText) || u.username.includes(searchText) || u.position.includes(searchText);
    return matchesDept && matchesSearch;
  });

  const getDeptLabel = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? (isAr ? dept.labelAr : dept.labelEn) : deptId;
  };

  // ===== RENDER =====
  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>{isAr ? "جاري التحميل..." : "Loading..."}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "لوحة تحكم الأدمن الشاملة" : "Comprehensive Admin Dashboard"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { id: "employees", label: isAr ? "الموظفين" : "Employees", icon: "people" },
          { id: "departments", label: isAr ? "الأقسام" : "Departments", icon: "business" },
          { id: "procedures", label: isAr ? "الإجراءات" : "Procedures", icon: "assignment" },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabBtn, activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <MaterialIcons name={tab.icon as any} size={18} color={activeTab === tab.id ? colors.primary : colors.muted} />
            <Text style={{ color: activeTab === tab.id ? colors.primary : colors.muted, fontWeight: "600", fontSize: 12, marginTop: 2 }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== EMPLOYEES TAB ===== */}
      {activeTab === "employees" && (
        <>
          {/* Search & Filter */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                style={{ flex: 1, paddingVertical: 8, color: colors.foreground, fontSize: 14 }}
                placeholder={isAr ? "ابحث بالاسم أو المسمى..." : "Search by name or position..."}
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={colors.muted}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <TouchableOpacity
                style={[styles.filterChip, { backgroundColor: !filterDept ? colors.primary : colors.surface, borderColor: colors.border }]}
                onPress={() => setFilterDept(null)}
              >
                <Text style={{ color: !filterDept ? "white" : colors.foreground, fontSize: 11, fontWeight: "600" }}>{isAr ? "الكل" : "All"} ({users.length})</Text>
              </TouchableOpacity>
              {departments.filter(d => !d.parentId && d.isActive).map(dept => {
                const count = users.filter(u => u.department === dept.id).length;
                return (
                  <TouchableOpacity
                    key={dept.id}
                    style={[styles.filterChip, { backgroundColor: filterDept === dept.id ? colors.primary : colors.surface, borderColor: colors.border }]}
                    onPress={() => setFilterDept(dept.id)}
                  >
                    <Text style={{ color: filterDept === dept.id ? "white" : colors.foreground, fontSize: 11, fontWeight: "600" }}>
                      {isAr ? dept.labelAr : dept.labelEn} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Add Button */}
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddEmployee}>
            <MaterialIcons name="person-add" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>{isAr ? "إضافة موظف جديد" : "Add New Employee"}</Text>
          </TouchableOpacity>

          {/* Employees List */}
          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <View style={[styles.employeeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.empName, { color: colors.foreground }]}>{item.name}</Text>
                    {!item.isActive && (
                      <View style={{ backgroundColor: "#EF444420", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: "#EF4444", fontSize: 10, fontWeight: "600" }}>{isAr ? "معطل" : "Disabled"}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>@{item.username}</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "القسم:" : "Department:"} {getDeptLabel(item.department)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "المسمى:" : "Position:"} {item.position || "—"}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "الدور:" : "Role:"} {isAr ? (ROLES.find(r => r.value === item.role)?.labelAr || item.role) : (ROLES.find(r => r.value === item.role)?.labelEn || item.role)}</Text>
                  </View>
                </View>
                {/* Actions */}
                <View style={{ gap: 4 }}>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => handleEditEmployee(item)}>
                    <MaterialIcons name="edit" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#F59E0B20" }]} onPress={() => handleToggleActive(item)}>
                    <MaterialIcons name={item.isActive ? "block" : "check-circle"} size={16} color="#F59E0B" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#EF444420" }]} onPress={() => handleDeleteEmployee(item)}>
                    <MaterialIcons name="delete" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <MaterialIcons name="people-outline" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>{isAr ? "لا يوجد موظفين في هذا القسم" : "No employees in this department"}</Text>
              </View>
            }
          />
        </>
      )}

      {/* ===== DEPARTMENTS TAB ===== */}
      {activeTab === "departments" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddDept}>
            <MaterialIcons name="add-business" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>{isAr ? "إضافة قسم جديد" : "Add New Department"}</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16, marginTop: 8 }}>{isAr ? "الأقسام الرئيسية" : "Main Departments"}</Text>
          {departments.filter(d => !d.parentId).map(dept => (
            <View key={dept.id}>
              <View style={[styles.deptCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: dept.isActive ? 1 : 0.5 }]}>
                <MaterialIcons name={dept.icon as any} size={24} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "bold" }}>{isAr ? dept.labelAr : dept.labelEn}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? dept.labelEn : dept.labelAr}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {users.filter(u => u.department === dept.id).length} {isAr ? "موظف" : "Employee"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => handleEditDept(dept)}>
                    <MaterialIcons name="edit" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#F59E0B20" }]} onPress={() => handleToggleDept(dept)}>
                    <MaterialIcons name={dept.isActive ? "visibility-off" : "visibility"} size={16} color="#F59E0B" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#EF444420" }]} onPress={() => handleDeleteDept(dept)}>
                    <MaterialIcons name="delete" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Sub-departments */}
              {departments.filter(sd => sd.parentId === dept.id).map(sub => (
                <View key={sub.id} style={[styles.subDeptCard, { backgroundColor: colors.surface, borderColor: colors.border, marginLeft: 24, opacity: sub.isActive ? 1 : 0.5 }]}>
                  <MaterialIcons name={sub.icon as any} size={18} color={colors.muted} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: colors.foreground, fontSize: 13 }}>{isAr ? sub.labelAr : sub.labelEn}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => handleEditDept(sub)}>
                      <MaterialIcons name="edit" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#EF444420" }]} onPress={() => handleDeleteDept(sub)}>
                      <MaterialIcons name="delete" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ===== PROCEDURES TAB ===== */}
      {activeTab === "procedures" && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddProc}>
            <MaterialIcons name="note-add" size={20} color="white" />
            <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>{isAr ? "إضافة إجراء إداري جديد" : "Add New Administrative Procedure"}</Text>
          </TouchableOpacity>

          <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16, marginTop: 8 }}>{isAr ? "أنواع الإجراءات الإدارية" : "Administrative Procedure Types"}</Text>
          {procedureTypes.map(proc => (
            <View key={proc.id} style={[styles.procCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "bold" }}>{isAr ? proc.labelAr : proc.labelEn}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  المتطلبات: {proc.fields.join(" • ")}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => handleEditProc(proc)}>
                  <MaterialIcons name="edit" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.miniBtn, { backgroundColor: "#EF444420" }]} onPress={() => handleDeleteProc(proc)}>
                  <MaterialIcons name="delete" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ===== EMPLOYEE FORM MODAL ===== */}
      <Modal visible={showEmployeeForm} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowEmployeeForm(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>
              {editingUser ? (isAr ? "تعديل موظف" : "Edit Employee") : (isAr ? "إضافة موظف جديد" : "Add New Employee")}
            </Text>
            <TouchableOpacity onPress={handleSaveEmployee}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>{isAr ? "حفظ" : "Save"}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "الاسم الكامل *" : "Full Name *"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={employeeForm.name}
                onChangeText={t => setEmployeeForm({ ...employeeForm, name: t })}
                placeholder={isAr ? "أدخل اسم الموظف" : "Enter employee name"}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "اسم المستخدم *" : "Username *"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={employeeForm.username}
                onChangeText={t => setEmployeeForm({ ...employeeForm, username: t })}
                placeholder={isAr ? "اسم المستخدم لتسجيل الدخول" : "Username for login"}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "رقم الجوال" : "Phone Number"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={employeeForm.phone}
                onChangeText={t => setEmployeeForm({ ...employeeForm, phone: t })}
                placeholder="05xxxxxxxx"
                keyboardType="phone-pad"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "المسمى الوظيفي" : "Job Title"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={employeeForm.position}
                onChangeText={t => setEmployeeForm({ ...employeeForm, position: t })}
                placeholder={isAr ? "مثال: مشغل مكينة، محاسب..." : "e.g., Machine Operator, Accountant..."}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "القسم *" : "Department *"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                {departments.filter(d => d.isActive).map(dept => (
                  <TouchableOpacity
                    key={dept.id}
                    style={[styles.deptChip, { backgroundColor: employeeForm.department === dept.id ? colors.primary : colors.surface, borderColor: colors.border }]}
                    onPress={() => setEmployeeForm({ ...employeeForm, department: dept.id })}
                  >
                    <Text style={{ color: employeeForm.department === dept.id ? "white" : colors.foreground, fontSize: 11 }}>
                      {isAr ? dept.labelAr : dept.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "الدور" : "Role"}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {ROLES.map(role => (
                  <TouchableOpacity
                    key={role.value}
                    style={[styles.roleChip, { backgroundColor: employeeForm.role === role.value ? colors.primary : colors.surface, borderColor: colors.border, flex: 1 }]}
                    onPress={() => setEmployeeForm({ ...employeeForm, role: role.value })}
                  >
                    <Text style={{ color: employeeForm.role === role.value ? "white" : colors.foreground, fontSize: 11, textAlign: "center" }}>
                      {isAr ? role.labelAr : role.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                {editingUser ? (isAr ? "كلمة المرور الجديدة (اتركها فارغة لعدم التغيير)" : "New Password (leave blank to keep unchanged)") : (isAr ? "كلمة المرور" : "Password")}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={employeeForm.password}
                onChangeText={t => setEmployeeForm({ ...employeeForm, password: t })}
                placeholder={editingUser ? (isAr ? "اتركها فارغة لعدم التغيير" : "Leave blank to keep unchanged") : (isAr ? "كلمة المرور الافتراضية: 123456" : "Default password: 123456")}
                secureTextEntry
                placeholderTextColor={colors.muted}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ===== DEPARTMENT FORM MODAL ===== */}
      <Modal visible={showDeptForm} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowDeptForm(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>
              {editingDept ? (isAr ? "تعديل القسم" : "Edit Department") : (isAr ? "إضافة قسم جديد" : "Add New Department")}
            </Text>
            <TouchableOpacity onPress={handleSaveDept}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>{isAr ? "حفظ" : "Save"}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "اسم القسم بالعربي *" : "Department Name in Arabic *"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={deptForm.labelAr}
                onChangeText={t => setDeptForm({ ...deptForm, labelAr: t })}
                placeholder={isAr ? "مثال: قسم التصميم" : "e.g., Design Department"}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "اسم القسم بالإنجليزي" : "Department Name in English"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={deptForm.labelEn}
                onChangeText={t => setDeptForm({ ...deptForm, labelEn: t })}
                placeholder="e.g., Design Department"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "قسم رئيسي (فرعي من)" : "Main Department (Sub of)"}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                <TouchableOpacity
                  style={[styles.deptChip, { backgroundColor: !deptForm.parentId ? colors.primary : colors.surface, borderColor: colors.border }]}
                  onPress={() => setDeptForm({ ...deptForm, parentId: "" })}
                >
                  <Text style={{ color: !deptForm.parentId ? "white" : colors.foreground, fontSize: 11 }}>{isAr ? "قسم رئيسي" : "Main Department"}</Text>
                </TouchableOpacity>
                {departments.filter(d => !d.parentId).map(dept => (
                  <TouchableOpacity
                    key={dept.id}
                    style={[styles.deptChip, { backgroundColor: deptForm.parentId === dept.id ? colors.primary : colors.surface, borderColor: colors.border }]}
                    onPress={() => setDeptForm({ ...deptForm, parentId: dept.id })}
                  >
                    <Text style={{ color: deptForm.parentId === dept.id ? "white" : colors.foreground, fontSize: 11 }}>
                      فرعي من: {isAr ? dept.labelAr : dept.labelEn}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ===== PROCEDURE FORM MODAL ===== */}
      <Modal visible={showProcForm} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowProcForm(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>
              {editingProc ? (isAr ? "تعديل الإجراء" : "Edit Procedure") : (isAr ? "إضافة إجراء جديد" : "Add New Procedure")}
            </Text>
            <TouchableOpacity onPress={handleSaveProc}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>{isAr ? "حفظ" : "Save"}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "اسم الإجراء بالعربي *" : "Procedure Name in Arabic *"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={procForm.labelAr}
                onChangeText={t => setProcForm({ ...procForm, labelAr: t })}
                placeholder={isAr ? "مثال: طلب ترقية" : "e.g., Promotion Request"}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "اسم الإجراء بالإنجليزي" : "Procedure Name in English"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={procForm.labelEn}
                onChangeText={t => setProcForm({ ...procForm, labelEn: t })}
                placeholder="e.g., Promotion Request"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{isAr ? "المتطلبات والحقول (افصل بفاصلة)" : "Requirements and Fields (comma separated)"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }]}
                value={procForm.fields}
                onChangeText={t => setProcForm({ ...procForm, fields: t })}
                placeholder={isAr ? "مثال: السبب، التاريخ، المبلغ، ملاحظات" : "e.g., Reason, Date, Amount, Notes"}
                multiline
                placeholderTextColor={colors.muted}
              />
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                افصل بين كل متطلب بفاصلة (،) أو (,)
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
    fontSize: 16,
    fontWeight: "bold",
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  employeeCard: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  empName: {
    fontSize: 15,
    fontWeight: "bold",
  },
  miniBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  deptCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  subDeptCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  procCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  fieldLabel: {
    fontWeight: "600",
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  deptChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleChip: {
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
});
