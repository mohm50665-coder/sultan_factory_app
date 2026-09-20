import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { MaterialIcons } from "@expo/vector-icons";
import { productionExportService, type ProductionRecord, type StoppedMachineRecord } from "@/lib/services/production-export";
import { activityLogService } from "@/lib/services/activity-log";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { maintenanceService, productionService } from "@/lib/services/api.service";
import * as Print from "expo-print";

export default function ProductionExportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [stoppedMachines, setStoppedMachines] = useState<StoppedMachineRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<"csv" | "html">("html");

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    try {
      const [allRecords, allStoppedMachines] = await Promise.all([
        productionService.getAll().catch(() => []),
        maintenanceService.getStopped().catch(() => []),
      ]);
      const filtered = allRecords.filter((r: any) => (r.date || r.entryDate) === date);
      setRecords(filtered as ProductionRecord[]);
      setStoppedMachines((Array.isArray(allStoppedMachines) ? allStoppedMachines : []).filter((r: any) => String(r.stopDate || "").slice(0, 10) === date) as StoppedMachineRecord[]);
    } catch (error) {
      console.error("Failed to load production data:", error);
    }
  };

  const handlePrint = async () => {
    if (records.length === 0) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا توجد بيانات إنتاج لهذا التاريخ" : "No production data for this date");
      return;
    }

    setIsLoading(true);
    try {
      const html = productionExportService.generateHTML(records, date, stoppedMachines);
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
        if (!printWindow) throw new Error("PRINT_WINDOW_BLOCKED");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      } else {
        await Print.printAsync({ html, orientation: Print.Orientation.landscape });
      }
      await activityLogService.addEntry({
        userId: String(user?.id || "unknown"),
        userName: user?.name || (isAr ? "مجهول" : "Unknown"),
        action: "print",
        module: "production",
        description: isAr ? `طباعة تقرير إنتاج المكائن ليوم ${date}` : `Print machine production report for ${date}`,
        details: isAr ? `عدد السجلات: ${records.length}` : `Number of records: ${records.length}`,
      });
    } catch (error) {
      Alert.alert(isAr ? "خطأ في الطباعة" : "Print error", isAr ? "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "Unable to open printing. Allow pop-ups and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (records.length === 0) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا توجد بيانات إنتاج لهذا التاريخ" : "No production data for this date");
      return;
    }

    setIsLoading(true);
    try {
      let content: string;
      if (format === "csv") {
        content = productionExportService.generateCSV(records, date);
      } else {
        content = productionExportService.generateHTML(records, date, stoppedMachines);
      }

      await productionExportService.shareReport(content, format, date);

      // Log the export activity
      await activityLogService.addEntry({
        userId: String(user?.id || "unknown"),
        userName: user?.name || (isAr ? "مجهول" : "Unknown"),
        action: "export",
        module: "production",
        description: isAr ? `تصدير تقرير الإنتاج ليوم ${date} بتنسيق ${format.toUpperCase()}` : `Export production report for ${date} in ${format.toUpperCase()} format`,
        details: isAr ? `عدد السجلات: ${records.length}` : `Number of records: ${records.length}`,
      });

      Alert.alert(isAr ? "نجاح" : "Success", isAr ? `تم تصدير التقرير بنجاح بتنسيق ${format.toUpperCase()}` : `Report exported successfully in ${format.toUpperCase()} format`);
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل تصدير التقرير" : "Failed to export report");
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
        <Text style={styles.headerTitle}>{isAr ? "تقرير إنتاج المكائن" : "Machine Production Report"}</Text>
        <TouchableOpacity onPress={handlePrint} disabled={isLoading || records.length === 0} style={styles.headerPrintButton} accessibilityLabel={isAr ? "طباعة التقرير" : "Print report"}>
          <MaterialIcons name="print" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isAr ? "اختر التاريخ" : "Select Date"}</Text>
          <DateField value={date} onChange={setDate} label={isAr ? "التاريخ" : "Date"} isAr={isAr} style={styles.dateInput} />
        </View>

        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isAr ? "تنسيق التصدير" : "Export Format"}</Text>
          <View style={styles.formatRow}>
            <TouchableOpacity
              onPress={() => setFormat("html")}
              style={[styles.formatOption, format === "html" && styles.formatOptionActive]}
            >
              <MaterialIcons name="web" size={24} color={format === "html" ? "#0a7ea4" : "#687076"} />
              <Text style={[styles.formatText, format === "html" && styles.formatTextActive]}>HTML</Text>
              <Text style={styles.formatDesc}>{isAr ? "تقرير مرئي جاهز للطباعة" : "Visual report ready for printing"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFormat("csv")}
              style={[styles.formatOption, format === "csv" && styles.formatOptionActive]}
            >
              <MaterialIcons name="table-chart" size={24} color={format === "csv" ? "#0a7ea4" : "#687076"} />
              <Text style={[styles.formatText, format === "csv" && styles.formatTextActive]}>CSV</Text>
              <Text style={styles.formatDesc}>{isAr ? "جدول بيانات (Excel)" : "Spreadsheet (Excel)"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isAr ? "ملخص البيانات" : "Data Summary"}</Text>
          {records.length === 0 ? (
            <View style={styles.noData}>
              <MaterialIcons name="info-outline" size={32} color="#d1d5db" />
              <Text style={styles.noDataText}>{isAr ? "لا توجد بيانات إنتاج لهذا التاريخ" : "No production data for this date"}</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{records.length}</Text>
                <Text style={styles.statLabel}>{isAr ? "عدد المكائن" : "Number of Machines"}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.productionDozen}</Text>
                <Text style={styles.statLabel}>{isAr ? "الإنتاج (درزن)" : "Production (Dozen)"}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.productionPairs}</Text>
                <Text style={styles.statLabel}>{isAr ? "الإنتاج (زوج)" : "Production (Pairs)"}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.wasteThread}</Text>
                <Text style={styles.statLabel}>{isAr ? "هدر خيوط (جرام)" : "Thread Waste (g)"}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.wasteSocks}</Text>
                <Text style={styles.statLabel}>{isAr ? "هدر جوارب (جرام)" : "Socks Waste (g)"}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totals.secondGrade}</Text>
                <Text style={styles.statLabel}>{isAr ? "نخب ثاني (زوج)" : "Second Grade (Pairs)"}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Print Button */}
        <TouchableOpacity
          onPress={handlePrint}
          disabled={isLoading || records.length === 0}
          style={[styles.printBtn, (isLoading || records.length === 0) && styles.exportBtnDisabled]}
        >
          <MaterialIcons name="print" size={22} color="white" />
          <Text style={styles.exportBtnText}>{isAr ? "طباعة التقرير" : "Print Report"}</Text>
        </TouchableOpacity>

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
                {isAr ? `تصدير التقرير (${format.toUpperCase()})` : `Export Report (${format.toUpperCase()})`}
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
    flex: 1,
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerPrintButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff26",
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
  printBtn: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
