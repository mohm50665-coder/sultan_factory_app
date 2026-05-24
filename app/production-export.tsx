import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MaterialIcons } from "@expo/vector-icons";
import { productionExportService, type ProductionRecord } from "@/lib/services/production-export";
import { activityLogService } from "@/lib/services/activity-log";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProductionExportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<"csv" | "html">("html");

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    try {
      const dataJson = await AsyncStorage.getItem("production_data");
      let allRecords: ProductionRecord[] = dataJson ? JSON.parse(dataJson) : [];
      const filtered = allRecords.filter((r) => r.date === date);
      setRecords(filtered);
    } catch (error) {
      console.error("Failed to load production data:", error);
    }
  };

  const handleExport = async () => {
    if (records.length === 0) {
      Alert.alert("تنبيه", "لا توجد بيانات إنتاج لهذا التاريخ");
      return;
    }

    setIsLoading(true);
    try {
      let content: string;
      if (format === "csv") {
        content = productionExportService.generateCSV(records, date);
      } else {
        content = productionExportService.generateHTML(records, date);
      }

      await productionExportService.shareReport(content, format, date);

      // Log the export activity
      await activityLogService.addEntry({
        userId: user?.id || "unknown",
        userName: user?.name || "مجهول",
        action: "export",
        module: "production",
        description: `تصدير تقرير الإنتاج ليوم ${date} بتنسيق ${format.toUpperCase()}`,
        details: `عدد السجلات: ${records.length}`,
      });

      Alert.alert("نجاح", `تم تصدير التقرير بنجاح بتنسيق ${format.toUpperCase()}`);
    } catch (error) {
      Alert.alert("خطأ", "فشل تصدير التقرير");
    } finally {
      setIsLoading(false);
    }
  };

  const totals = records.reduce(
    (acc, r) => ({
      productionDozen: acc.productionDozen + (r.productionDozen || 0),
      productionPairs: acc.productionPairs + (r.productionPairs || 0),
      wasteThread: acc.wasteThread + (r.wasteThread || 0),
      wasteSocks: acc.wasteSocks + (r.wasteSocks || 0),
      secondGrade: acc.secondGrade + (r.secondGrade || 0),
      wasteNeedles: acc.wasteNeedles + (r.wasteNeedles || 0),
    }),
    { productionDozen: 0, productionPairs: 0, wasteThread: 0, wasteSocks: 0, secondGrade: 0, wasteNeedles: 0 }
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>تصدير بيانات الإنتاج</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>اختر التاريخ</Text>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="default"
          />
        </View>

        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تنسيق التصدير</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity
              onPress={() => setFormat("html")}
              style={[styles.formatOption, format === "html" && styles.formatOptionActive]}
            >
              <MaterialIcons name="web" size={24} color={format === "html" ? "#0a7ea4" : "#687076"} />
              <Text style={[styles.formatText, format === "html" && styles.formatTextActive]}>HTML</Text>
              <Text style={styles.formatDesc}>تقرير مرئي جاهز للطباعة</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFormat("csv")}
              style={[styles.formatOption, format === "csv" && styles.formatOptionActive]}
            >
              <MaterialIcons name="table-chart" size={24} color={format === "csv" ? "#0a7ea4" : "#687076"} />
              <Text style={[styles.formatText, format === "csv" && styles.formatTextActive]}>CSV</Text>
              <Text style={styles.formatDesc}>جدول بيانات (Excel)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص البيانات</Text>
          {records.length === 0 ? (
            <View style={styles.noData}>
              <MaterialIcons name="info-outline" size={32} color="#d1d5db" />
              <Text style={styles.noDataText}>لا توجد بيانات إنتاج لهذا التاريخ</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{records.length}</Text>
                <Text style={styles.statLabel}>عدد المكائن</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.productionDozen}</Text>
                <Text style={styles.statLabel}>الإنتاج (درزن)</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.productionPairs}</Text>
                <Text style={styles.statLabel}>الإنتاج (زوج)</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.wasteThread}</Text>
                <Text style={styles.statLabel}>هدر خيوط (جرام)</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.wasteSocks}</Text>
                <Text style={styles.statLabel}>هدر جوارب (جرام)</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.secondGrade}</Text>
                <Text style={styles.statLabel}>نخب ثاني (زوج)</Text>
              </View>
            </View>
          )}
        </View>

        {/* Export Button */}
        <TouchableOpacity
          onPress={handleExport}
          disabled={isLoading || records.length === 0}
          style={[styles.exportBtn, (isLoading || records.length === 0) && styles.exportBtnDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="file-download" size={22} color="white" />
              <Text style={styles.exportBtnText}>
                تصدير التقرير ({format.toUpperCase()})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0a7ea4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#11181C",
    textAlign: "right",
    marginBottom: 10,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
    backgroundColor: "white",
  },
  formatRow: {
    flexDirection: "row",
    gap: 12,
  },
  formatOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: "white",
  },
  formatOptionActive: {
    borderColor: "#0a7ea4",
    backgroundColor: "#e0f7fa",
  },
  formatText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#687076",
    marginTop: 8,
  },
  formatTextActive: {
    color: "#0a7ea4",
  },
  formatDesc: {
    fontSize: 10,
    color: "#9ca3af",
    marginTop: 4,
  },
  noData: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  noDataText: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    width: "30%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0a7ea4",
  },
  statLabel: {
    fontSize: 10,
    color: "#687076",
    marginTop: 4,
    textAlign: "center",
  },
  exportBtn: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
