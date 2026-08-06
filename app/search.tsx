import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";

interface SearchFilter {
  id: string;
  name: string;
  category: string;
  date: string;
  department: string;
  employee: string;
  status: string;
}

export default function SearchScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const colors = useColors();
  const [searchText, setSearchText] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [savedFilters, setSavedFilters] = useState<SearchFilter[]>([]);
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState("");

  const departments = [
    { id: "all", name: isAr ? "جميع الأقسام" : "All Departments" },
    { id: "production", name: isAr ? "الإنتاج" : "Production" },
    { id: "manufacturing", name: isAr ? "مراحل التصنيع" : "Manufacturing Stages" },
    { id: "sales", name: isAr ? "المبيعات" : "Sales" },
    { id: "warehouse", name: isAr ? "المستودعات" : "Warehouse" },
    { id: "maintenance", name: isAr ? "الصيانة" : "Maintenance" },
  ];

  const employees = [
    { id: "all", name: isAr ? "جميع الموظفين" : "All Employees" },
    { id: "rana", name: isAr ? "رنا" : "Rana" },
    { id: "shafiq", name: isAr ? "شفيق" : "Shafiq" },
    { id: "mohammed", name: isAr ? "محمد أحمد" : "Mohammed Ahmed" },
    { id: "atallah", name: isAr ? "عطالله" : "Atallah" },
  ];

  const statuses = [
    { id: "all", name: isAr ? "جميع الحالات" : "All Statuses" },
    { id: "pending", name: isAr ? "قيد الانتظار" : "Pending" },
    { id: "in_progress", name: isAr ? "قيد التنفيذ" : "In Progress" },
    { id: "completed", name: isAr ? "مكتملة" : "Completed" },
  ];

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      const newFilter: SearchFilter = {
        id: Date.now().toString(),
        name: filterName,
        category: selectedDepartment,
        date: `${dateFrom} - ${dateTo}`,
        department: selectedDepartment,
        employee: selectedEmployee,
        status: selectedStatus,
      };
      setSavedFilters([...savedFilters, newFilter]);
      setFilterName("");
      setShowSaveFilter(false);
    }
  };

  const handleLoadFilter = (filter: SearchFilter) => {
    setSelectedDepartment(filter.department);
    setSelectedEmployee(filter.employee);
    setSelectedStatus(filter.status);
  };

  const handleDeleteFilter = (id: string) => {
    setSavedFilters(savedFilters.filter((f) => f.id !== id));
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 4,
              textAlign: isAr ? "right" : "left",
            }}
          >
            {isAr ? "البحث والتصفية" : "Search and Filter"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: isAr ? "right" : "left" }}>
            {isAr ? "ابحث وصفي البيانات بسهولة" : "Search and filter data easily"}
          </Text>
        </View>

        {/* حقل البحث */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <View
            style={{
              flexDirection: isAr ? "row-reverse" : "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 8,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MaterialIcons name="search" size={20} color={colors.muted} />
            <TextInput
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 8,
                color: colors.foreground,
                fontSize: 14,
                textAlign: isAr ? "right" : "left",
              }}
              placeholder={isAr ? "ابحث عن..." : "Search for..."}
              placeholderTextColor={colors.muted}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <MaterialIcons name="close" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* مرشحات التصفية */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 12,
              textAlign: isAr ? "right" : "left",
            }}
          >
            {isAr ? "مرشحات التصفية" : "Filters"}
          </Text>

          {/* القسم */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "القسم" : "Department"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 8 }}>
                {departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.id}
                    onPress={() => setSelectedDepartment(dept.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        selectedDepartment === dept.id
                          ? colors.primary
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedDepartment === dept.id
                          ? colors.primary
                          : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          selectedDepartment === dept.id
                            ? "white"
                            : colors.foreground,
                        fontSize: 11,
                        fontWeight: "500",
                      }}
                    >
                      {dept.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* الموظف */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "الموظف" : "Employee"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 8 }}>
                {employees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => setSelectedEmployee(emp.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        selectedEmployee === emp.id
                          ? colors.primary
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedEmployee === emp.id
                          ? colors.primary
                          : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          selectedEmployee === emp.id
                            ? "white"
                            : colors.foreground,
                        fontSize: 11,
                        fontWeight: "500",
                      }}
                    >
                      {emp.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* الحالة */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "الحالة" : "Status"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 8 }}>
                {statuses.map((status) => (
                  <TouchableOpacity
                    key={status.id}
                    onPress={() => setSelectedStatus(status.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor:
                        selectedStatus === status.id
                          ? colors.primary
                          : colors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedStatus === status.id
                          ? colors.primary
                          : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          selectedStatus === status.id
                            ? "white"
                            : colors.foreground,
                        fontSize: 11,
                        fontWeight: "500",
                      }}
                    >
                      {status.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* نطاق التاريخ */}
          <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "من التاريخ" : "From Date"}
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlign: isAr ? "right" : "left",
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={dateFrom}
                onChangeText={setDateFrom}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "إلى التاريخ" : "To Date"}
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlign: isAr ? "right" : "left",
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={dateTo}
                onChangeText={setDateTo}
              />
            </View>
          </View>
        </View>

        {/* أزرار الإجراءات */}
        <View
          style={{
            paddingHorizontal: 16,
            marginBottom: 20,
            flexDirection: isAr ? "row-reverse" : "row",
            gap: 12,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>
              {isAr ? "بحث" : "Search"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSaveFilter(!showSaveFilter)}
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
              {isAr ? "حفظ المرشح" : "Save Filter"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* نموذج حفظ المرشح */}
        {showSaveFilter && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <TextInput
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.foreground,
                  fontSize: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginBottom: 12,
                  textAlign: isAr ? "right" : "left",
                }}
                placeholder={isAr ? "اسم المرشح" : "Filter Name"}
                placeholderTextColor={colors.muted}
                value={filterName}
                onChangeText={setFilterName}
              />
              <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={handleSaveFilter}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    paddingVertical: 10,
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>
                    {isAr ? "حفظ" : "Save"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowSaveFilter(false)}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    paddingVertical: 10,
                    borderRadius: 6,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {isAr ? "إلغاء" : "Cancel"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* المرشحات المحفوظة */}
        {savedFilters.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "600",
                marginBottom: 12,
                textAlign: isAr ? "right" : "left",
              }}
            >
              {isAr ? "المرشحات المحفوظة" : "Saved Filters"}
            </Text>
            {savedFilters.map((filter) => (
              <View
                key={filter.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  flexDirection: isAr ? "row-reverse" : "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() => handleLoadFilter(filter)}
                  style={{ flex: 1 }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 12,
                      fontWeight: "500",
                      textAlign: isAr ? "right" : "left",
                    }}
                  >
                    {filter.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4, textAlign: isAr ? "right" : "left" }}>
                    {filter.date}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteFilter(filter.id)}
                  style={{ padding: 8 }}
                >
                  <MaterialIcons name="delete" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
