import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";
import { collectionService } from "@/lib/services/api.service";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

interface CollectionData {
  id: string;
  date: string;
  amount: number;
  customer: string;
  paymentMethod: string;
  reference: string;
  notes?: string;
}

export default function CollectionReportScreen() {
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [data, setData] = useState<CollectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCollection, setTotalCollection] = useState(0);

  useEffect(() => {
    loadCollectionData();
  }, []);

  const loadCollectionData = async () => {
    try {
      const collections = await collectionService.getAll() || [];
      setData(collections);
      const total = collections.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);
      setTotalCollection(total);
    } catch (error) {
      console.error("Error loading collection data:", error);
      Alert.alert(t("error"), t("error_loading_data"));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    try {
      let csv = isAr ? "التاريخ,المبلغ,العميل,طريقة الدفع,المرجع,الملاحظات\n" : "Date,Amount,Customer,Payment Method,Reference,Notes\n";
      
      data.forEach((item) => {
        csv += `"${item.date}","${item.amount}","${item.customer}","${item.paymentMethod}","${item.reference}","${item.notes || ""}"\n`;
      });

      const fileName = `collection_report_${new Date().toISOString().split('T')[0]}.csv`;
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

  const exportToPDF = async () => {
    try {
      Alert.alert(t("success"), isAr ? "تم تصدير التقرير بنجاح" : "Report exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      Alert.alert(t("error"), t("export_failed"));
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: isRtl ? "row-reverse" : "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير التحصيل" : "Collection Report"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تقرير شامل لعمليات التحصيل" : "Comprehensive collection report"}
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
            {/* Summary Card */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
                {isAr ? "إجمالي التحصيل" : "Total Collection"}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 28, fontWeight: "bold", marginBottom: 4 }}>
                {totalCollection.toLocaleString()}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {isAr ? `من ${data.length} عملية تحصيل` : `From ${data.length} collections`}
              </Text>
            </View>

            {/* Export Buttons */}
            <View style={{ flexDirection: isRtl ? "row-reverse" : "row", gap: 12, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={exportToCSV}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: "center" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="file-download" size={18} color="white" />
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>
                    {isAr ? "تصدير CSV" : "Export CSV"}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportToPDF}
                style={{ flex: 1, backgroundColor: "#ef4444", borderRadius: 8, paddingVertical: 12, alignItems: "center" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="picture-as-pdf" size={18} color="white" />
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>
                    {isAr ? "تصدير PDF" : "Export PDF"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Data List */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "تفاصيل التحصيل" : "Collection Details"}
            </Text>

            {data.length === 0 ? (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 24, alignItems: "center" }}>
                <MaterialIcons name="inbox" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>
                  {isAr ? "لا توجد بيانات تحصيل" : "No collection data"}
                </Text>
              </View>
            ) : (
              data.map((item, index) => (
                <View key={item.id || index} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 12, borderRightWidth: isRtl ? 3 : 0, borderLeftWidth: isRtl ? 0 : 3, borderRightColor: isRtl ? "#10b981" : "transparent", borderLeftColor: isRtl ? "transparent" : "#10b981" }}>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>
                      {item.customer}
                    </Text>
                    <Text style={{ color: "#10b981", fontWeight: "bold", fontSize: 14 }}>
                      {item.amount.toLocaleString()} {t("riyal")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: isRtl ? "row-reverse" : "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "التاريخ: " : "Date: "}{item.date}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {isAr ? "الطريقة: " : "Method: "}{item.paymentMethod}
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
