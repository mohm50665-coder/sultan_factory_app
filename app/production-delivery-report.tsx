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
import { productionService } from "@/lib/services/api.service";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

interface DeliveryStage {
  id: string;
  productionId: string;
  stage: string;
  date: string;
  status: string;
  completedBy: string;
  notes?: string;
}

export default function ProductionDeliveryReportScreen() {
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<DeliveryStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadDeliveryData();
  }, []);

  const loadDeliveryData = async () => {
    try {
      const productions = await productionService.getAll() || [];
      
      // Mock delivery stages data based on productions
      const stages: DeliveryStage[] = [];
      productions.forEach((prod: any) => {
        const stageNames = isAr 
          ? ["التحضير", "الإنتاج", "الفحص", "التعبئة", "التسليم"]
          : ["Preparation", "Production", "Quality Check", "Packaging", "Delivery"];
        
        stageNames.forEach((stage, index) => {
          stages.push({
            id: `${prod.id}-${index}`,
            productionId: prod.id,
            stage,
            date: new Date(Date.now() - (stageNames.length - index) * 86400000).toISOString().split('T')[0],
            status: index < 3 ? "completed" : "pending",
            completedBy: index < 3 ? "محمد" : "-",
            notes: index === 2 ? (isAr ? "تم الفحص بنجاح" : "Inspection passed") : undefined,
          });
        });
      });

      setData(stages);
      setCompletedCount(stages.filter(s => s.status === "completed").length);
      setPendingCount(stages.filter(s => s.status === "pending").length);
    } catch (error) {
      console.error("Error loading delivery data:", error);
      Alert.alert(t("error"), t("error_loading_data"));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = isAr ? "المرحلة,التاريخ,الحالة,المنفذ,الملاحظات\n" : "Stage,Date,Status,Completed By,Notes\n";
      
      data.forEach((item) => {
        const statusText = item.status === "completed" ? (isAr ? "مكتمل" : "Completed") : (isAr ? "قيد الانتظار" : "Pending");
        csv += `"${item.stage}","${item.date}","${statusText}","${item.completedBy}","${item.notes || ""}"\n`;
      });

      const fileName = `delivery_report_${new Date().toISOString().split('T')[0]}.csv`;
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
    return status === "completed" ? "#10b981" : "#f59e0b";
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير مراحل التسليم" : "Delivery Stages Report"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تتبع مراحل الإنتاج والتسليم" : "Track production and delivery stages"}
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
                  {isAr ? "مكتملة" : "Completed"}
                </Text>
                <Text style={{ color: "#10b981", fontSize: 20, fontWeight: "bold" }}>
                  {completedCount}
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

            {/* Stages List */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تفاصيل المراحل" : "Stages Details"}
            </Text>

            {data.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 24, alignItems: "center" }}>
                <MaterialIcons name="inbox" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
                  {isAr ? "لا توجد بيانات مراحل" : "No delivery stages data"}
                </Text>
              </View>
            ) : (
              data.map((item, index) => (
                <View key={item.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, borderRightWidth: isRtl ? 3 : 0, borderLeftWidth: isRtl ? 0 : 3, borderRightColor: isRtl ? getStatusColor(item.status) : "transparent", borderLeftColor: isRtl ? "transparent" : getStatusColor(item.status) }}>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {item.stage}
                    </Text>
                    <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: getStatusColor(item.status), fontWeight: "600", fontSize: 11 }}>
                        {item.status === "completed" ? (isAr ? "مكتمل" : "Completed") : (isAr ? "قيد الانتظار" : "Pending")}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "التاريخ: " : "Date: "}{item.date}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "المنفذ: " : "By: "}{item.completedBy}
                    </Text>
                  </View>
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
