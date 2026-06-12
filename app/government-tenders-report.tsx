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

interface GovernmentTender {
  id: string;
  tenderNumber: string;
  title: string;
  date: string;
  amount: number;
  status: string;
  department: string;
  notes?: string;
}

export default function GovernmentTendersReportScreen() {
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<GovernmentTender[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [wonCount, setWonCount] = useState(0);

  useEffect(() => {
    loadTendersData();
  }, []);

  const loadTendersData = async () => {
    try {
      // Mock government tenders data
      const tenders: GovernmentTender[] = [
        {
          id: "1",
          tenderNumber: "GOV-2026-001",
          title: isAr ? "توريد جوارب عسكرية" : "Military Socks Supply",
          date: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
          amount: 500000,
          status: "won",
          department: isAr ? "الدفاع" : "Defense",
          notes: isAr ? "تم الفوز بالمناقصة" : "Tender won",
        },
        {
          id: "2",
          tenderNumber: "GOV-2026-002",
          title: isAr ? "توريد جوارب حكومية" : "Government Socks Supply",
          date: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
          amount: 300000,
          status: "pending",
          department: isAr ? "الداخلية" : "Interior",
        },
        {
          id: "3",
          tenderNumber: "GOV-2026-003",
          title: isAr ? "توريد جوارب للمستشفيات" : "Hospital Socks Supply",
          date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          amount: 200000,
          status: "won",
          department: isAr ? "الصحة" : "Health",
          notes: isAr ? "تم الفوز بالمناقصة" : "Tender won",
        },
      ];

      setData(tenders);
      const total = tenders.reduce((sum, item) => sum + item.amount, 0);
      setTotalAmount(total);
      setWonCount(tenders.filter(t => t.status === "won").length);
    } catch (error) {
      console.error("Error loading tenders data:", error);
      Alert.alert(t("error"), t("error_loading_data"));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = isAr ? "رقم المناقصة,العنوان,التاريخ,المبلغ,الحالة,الجهة,الملاحظات\n" : "Tender Number,Title,Date,Amount,Status,Department,Notes\n";
      
      data.forEach((item) => {
        const statusText = item.status === "won" ? (isAr ? "فائز" : "Won") : (isAr ? "قيد الانتظار" : "Pending");
        csv += `"${item.tenderNumber}","${item.title}","${item.date}","${item.amount}","${statusText}","${item.department}","${item.notes || ""}"\n`;
      });

      const fileName = `tenders_report_${new Date().toISOString().split('T')[0]}.csv`;
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
    return status === "won" ? "#10b981" : "#f59e0b";
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير المناقصات الحكومية والعسكرية" : "Government & Military Tenders Report"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير شامل للمناقصات الحكومية والعسكرية" : "Comprehensive government and military tenders report"}
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
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
                {isAr ? "إجمالي قيمة المناقصات الفائزة" : "Total Won Tenders Value"}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "bold", marginBottom: 4 }}>
                {(totalAmount * (wonCount / data.length)).toLocaleString()}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {isAr ? `من ${wonCount} مناقصة فائزة` : `From ${wonCount} won tenders`}
              </Text>
            </View>

            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, backgroundColor: "#10b98120", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#10b981" }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  {isAr ? "فائزة" : "Won"}
                </Text>
                <Text style={{ color: "#10b981", fontSize: 20, fontWeight: "bold" }}>
                  {wonCount}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#f59e0b20", borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: "#f59e0b" }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  {isAr ? "قيد الانتظار" : "Pending"}
                </Text>
                <Text style={{ color: "#f59e0b", fontSize: 20, fontWeight: "bold" }}>
                  {data.length - wonCount}
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

            {/* Tenders List */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تفاصيل المناقصات" : "Tenders Details"}
            </Text>

            {data.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 24, alignItems: "center" }}>
                <MaterialIcons name="inbox" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
                  {isAr ? "لا توجد بيانات مناقصات" : "No tenders data"}
                </Text>
              </View>
            ) : (
              data.map((item, index) => (
                <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, borderRightWidth: isRtl ? 3 : 0, borderLeftWidth: isRtl ? 0 : 3, borderRightColor: isRtl ? getStatusColor(item.status) : "transparent", borderLeftColor: isRtl ? "transparent" : getStatusColor(item.status) }}>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                        {item.title}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                        {isAr ? "رقم المناقصة: " : "Tender #: "}{item.tenderNumber}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: getStatusColor(item.status), fontWeight: "600", fontSize: 11 }}>
                        {item.status === "won" ? (isAr ? "فائز" : "Won") : (isAr ? "قيد الانتظار" : "Pending")}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "التاريخ: " : "Date: "}{item.date}
                    </Text>
                    <Text style={{ color: "#10b981", fontWeight: "600", fontSize: 11 }}>
                      {item.amount.toLocaleString()} {t("riyal")}
                    </Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {isAr ? "الجهة: " : "Department: "}{item.department}
                  </Text>
                  {item.notes && (
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                      {isAr ? "ملاحظات: " : "Notes: "}{item.notes}
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
