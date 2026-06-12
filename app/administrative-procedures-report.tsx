import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

interface AdministrativeProcedure {
  id: string;
  type: string;
  date: string;
  employee: string;
  status: string;
  reason?: string;
  approvedBy?: string;
}

export default function AdministrativeProceduresReportScreen() {
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<AdministrativeProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadProceduresData();
  }, []);

  const loadProceduresData = async () => {
    try {
      // Mock administrative procedures data
      const procedures: AdministrativeProcedure[] = [
        {
          id: "1",
          type: isAr ? "طلب إجازة" : "Leave Request",
          date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          employee: "محمد أحمد",
          status: "approved",
          reason: isAr ? "إجازة سنوية" : "Annual Leave",
          approvedBy: "رنا",
        },
        {
          id: "2",
          type: isAr ? "طلب عطلة" : "Vacation Request",
          date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
          employee: "شفيق",
          status: "pending",
          reason: isAr ? "عطلة طارئة" : "Emergency Leave",
        },
        {
          id: "3",
          type: isAr ? "إجازة مرضية" : "Sick Leave",
          date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
          employee: "عطالله",
          status: "approved",
          reason: isAr ? "مرض" : "Illness",
          approvedBy: "رنا",
        },
      ];

      setData(procedures);
      setApprovedCount(procedures.filter(p => p.status === "approved").length);
      setPendingCount(procedures.filter(p => p.status === "pending").length);
    } catch (error) {
      console.error("Error loading procedures data:", error);
      Alert.alert(t("error"), t("error_loading_data"));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = isAr ? "النوع,التاريخ,الموظف,الحالة,السبب,الموافقة من\n" : "Type,Date,Employee,Status,Reason,Approved By\n";
      
      data.forEach((item) => {
        const statusText = item.status === "approved" ? (isAr ? "موافق عليه" : "Approved") : (isAr ? "قيد الانتظار" : "Pending");
        csv += `"${item.type}","${item.date}","${item.employee}","${statusText}","${item.reason || ""}","${item.approvedBy || ""}"\n`;
      });

      const fileName = `admin_procedures_${new Date().toISOString().split('T')[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csv);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert(t("success"), t("file_saved"));
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert(t("error"), t("export_failed"));
    }
  };

  const getStatusColor = (status: string) => {
    return status === "approved" ? "#10b981" : "#f59e0b";
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير الإجراءات الإدارية" : "Administrative Procedures Report"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير شامل للإجراءات الإدارية" : "Comprehensive administrative procedures report"}
            </Text>
          </View>
          <BackButton />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {/* Summary Cards */}
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: "#10b98120", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#10b981" }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  {isAr ? "موافق عليه" : "Approved"}
                </Text>
                <Text style={{ color: "#10b981", fontSize: 20, fontWeight: "bold" }}>
                  {approvedCount}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#f59e0b20", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  {isAr ? "قيد الانتظار" : "Pending"}
                </Text>
                <Text style={{ color: "#f59e0b", fontSize: 20, fontWeight: "bold" }}>
                  {pendingCount}
                </Text>
              </View>
            </View>

            {/* Export Button */}
            <TouchableOpacity
              onPress={exportToCSV}
              style={{ backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginBottom: 16 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialIcons name="file-download" size={18} color="white" />
                <Text style={{ color: "white", fontWeight: "600" }}>
                  {isAr ? "تصدير التقرير" : "Export Report"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Procedures List */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تفاصيل الإجراءات" : "Procedures Details"}
            </Text>

            {data.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 24, alignItems: "center" }}>
                <MaterialIcons name="inbox" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
                  {isAr ? "لا توجد إجراءات إدارية" : "No administrative procedures"}
                </Text>
              </View>
            ) : (
              data.map((item, index) => (
                <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, borderRightWidth: isRtl ? 3 : 0, borderLeftWidth: isRtl ? 0 : 3, borderRightColor: isRtl ? getStatusColor(item.status) : "transparent", borderLeftColor: isRtl ? "transparent" : getStatusColor(item.status) }}>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                        {item.type}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {isAr ? "الموظف: " : "Employee: "}{item.employee}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: getStatusColor(item.status), fontWeight: "600", fontSize: 11 }}>
                        {item.status === "approved" ? (isAr ? "موافق عليه" : "Approved") : (isAr ? "قيد الانتظار" : "Pending")}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "التاريخ: " : "Date: "}{item.date}
                    </Text>
                    {item.reason && (
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {isAr ? "السبب: " : "Reason: "}{item.reason}
                      </Text>
                    )}
                  </View>
                  {item.approvedBy && (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                      {isAr ? "موافقة من: " : "Approved by: "}{item.approvedBy}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
