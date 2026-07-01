import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { productionService, salesService, expensesService, taskService } from "@/lib/services/api.service";
import { maintenanceEntriesService, warehouseEntriesService } from "@/lib/services/data.service";
import { useLanguage } from "@/lib/language-context";

interface ReportOption {
  id: string;
  titleAr: string;
  titleEn: string;
  icon: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  { id: "production", titleAr: "تقرير الإنتاج", titleEn: "Production Report", icon: "factory" },
  { id: "sales", titleAr: "تقرير المبيعات", titleEn: "Sales Report", icon: "point-of-sale" },
  { id: "warehouse", titleAr: "تقرير المستودعات", titleEn: "Warehouse Report", icon: "warehouse" },
  { id: "maintenance", titleAr: "تقرير الصيانة", titleEn: "Maintenance Report", icon: "build" },
  { id: "expenses", titleAr: "تقرير المصروفات", titleEn: "Expenses Report", icon: "receipt-long" },
  { id: "tasks", titleAr: "تقرير المهام", titleEn: "Tasks Report", icon: "task-alt" },
];

export default function ShareReportsScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const colors = useColors();
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportData, setReportData] = useState<any[]>([]);

  const loadReportData = async (reportId: string) => {
    try {
      let data: any[] = [];
      switch (reportId) {
        case "production": data = await productionService.getAll() || []; break;
        case "sales": data = await salesService.getAll() || []; break;
        case "warehouse": data = await warehouseEntriesService.getBySection("raw") || []; break;
        case "maintenance": data = await maintenanceEntriesService.getBySection("periodic") || []; break;
        case "expenses": data = await expensesService.getAll() || []; break;
        case "tasks": data = await taskService.getAll() || []; break;
      }
      setReportData(data);
    } catch (e) {
      setReportData([]);
    }
  };

  const generateReportText = (reportId: string): string => {
    const today = new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US");
    let text = isAr ? `📊 تقرير مصنع السلطان\n📅 التاريخ: ${today}\n\n` : `📊 Sultan Factory Report\n📅 Date: ${today}\n\n`;

    if (reportData.length === 0) {
      return text + (isAr ? "لا توجد بيانات مسجلة بعد." : "No data recorded yet.");
    }

    switch (reportId) {
      case "production":
        text += isAr ? "🏭 تقرير الإنتاج:\n" : "🏭 Production Report:\n";
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
        const totalProd = reportData.reduce((s, e) => s + parseFloat(e.quantity || e.production || 0), 0);
        const totalWaste = reportData.reduce((s, e) => s + parseFloat(e.waste || 0), 0);
        text += isAr ? `إجمالي الإنتاج: ${totalProd.toFixed(0)}\n` : `Total Production: ${totalProd.toFixed(0)}\n`;
        text += isAr ? `إجمالي الهدر: ${totalWaste.toFixed(0)}\n` : `Total Waste: ${totalWaste.toFixed(0)}\n`;
        text += isAr ? `نسبة الهدر: ${totalProd > 0 ? ((totalWaste / totalProd) * 100).toFixed(1) : 0}%\n` : `Waste Percentage: ${totalProd > 0 ? ((totalWaste / totalProd) * 100).toFixed(1) : 0}%\n`;
        break;
      case "sales":
        text += isAr ? "💰 تقرير المبيعات:\n" : "💰 Sales Report:\n";
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
        const totalSales = reportData.reduce((s, e) => s + parseFloat(e.amount || e.total || 0), 0);
        text += isAr ? `إجمالي المبيعات: ${totalSales.toFixed(0)} ريال\n` : `Total Sales: ${totalSales.toFixed(0)} SAR\n`;
        break;
      case "warehouse":
        text += isAr ? "📦 تقرير المستودعات:\n" : "📦 Warehouse Report:\n";
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
        break;
      case "maintenance":
        text += isAr ? "🔧 تقرير الصيانة:\n" : "🔧 Maintenance Report:\n";
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
        const completed = reportData.filter((e) => e.status === "completed" || e.status === "مكتمل").length;
        text += isAr ? `صيانة مكتملة: ${completed}\n` : `Completed Maintenance: ${completed}\n`;
        text += isAr ? `صيانة معلقة: ${reportData.length - completed}\n` : `Pending Maintenance: ${reportData.length - completed}\n`;
        break;
      case "expenses":
        text += isAr ? "📝 تقرير المصروفات:\n" : "📝 Expenses Report:\n";
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
        const totalExp = reportData.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        text += isAr ? `إجمالي المصروفات: ${totalExp.toFixed(0)} ريال\n` : `Total Expenses: ${totalExp.toFixed(0)} SAR\n`;
        break;
      case "tasks":
        text += isAr ? "✅ تقرير المهام:\n" : "✅ Tasks Report:\n";
        text += isAr ? `إجمالي المهام: ${reportData.length}\n` : `Total Tasks: ${reportData.length}\n`;
        const done = reportData.filter((e) => e.result === "completed" || e.result === "أنجز").length;
        text += isAr ? `مهام منجزة: ${done}\n` : `Completed Tasks: ${done}\n`;
        text += isAr ? `مهام معلقة: ${reportData.length - done}\n` : `Pending Tasks: ${reportData.length - done}\n`;
        break;
      default:
        text += isAr ? `إجمالي السجلات: ${reportData.length}\n` : `Total Records: ${reportData.length}\n`;
    }

    text += isAr ? "\n---\nتم إنشاء هذا التقرير من تطبيق مصنع السلطان" : "\n---\nThis report was generated from Sultan Factory App";
    return text;
  };

  const shareViaWhatsApp = (reportId: string) => {
    if (reportData.length === 0 && !selectedReport) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا توجد بيانات لمشاركتها" : "No data to share");
      return;
    }
    const text = encodeURIComponent(generateReportText(reportId));
    const url = `https://wa.me/?text=${text}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "تعذر فتح واتساب" : "Could not open WhatsApp");
    });
  };

  const shareViaEmail = (reportId: string) => {
    if (reportData.length === 0 && !selectedReport) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا توجد بيانات لمشاركتها" : "No data to share");
      return;
    }
    const report = REPORT_OPTIONS.find((r) => r.id === reportId);
    const subject = encodeURIComponent(isAr ? `${report?.titleAr || "تقرير"} - مصنع السلطان` : `${report?.titleEn || "Report"} - Sultan Factory`);
    const body = encodeURIComponent(generateReportText(reportId));
    const url = `mailto:?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "تعذر فتح البريد الإلكتروني" : "Could not open Email");
    });
  };

  const handleSelectReport = async (report: ReportOption) => {
    setSelectedReport(report.id);
    await loadReportData(report.id);
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "مشاركة التقارير" : "Share Reports"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* اختيار التقرير */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "اختر التقرير" : "Select Report"}</Text>

        <View style={styles.reportsGrid}>
          {REPORT_OPTIONS.map((report) => (
            <Pressable
              key={report.id}
              onPress={() => handleSelectReport(report)}
              style={({ pressed }) => [
                styles.reportCard,
                {
                  backgroundColor: selectedReport === report.id ? colors.primary + "15" : colors.surface,
                  borderColor: selectedReport === report.id ? colors.primary : colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <MaterialIcons
                name={report.icon as any}
                size={28}
                color={selectedReport === report.id ? colors.primary : colors.muted}
              />
              <Text
                style={[
                  styles.reportCardTitle,
                  { color: selectedReport === report.id ? colors.primary : colors.foreground },
                ]}
              >
                {isAr ? report.titleAr : report.titleEn}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* خيارات المشاركة */}
        {selectedReport && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "طريقة المشاركة" : "Share Method"}</Text>

            <View style={styles.shareOptions}>
              <Pressable
                onPress={() => shareViaWhatsApp(selectedReport)}
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: "#25D366" },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialIcons name="chat" size={24} color="white" />
                <Text style={styles.shareBtnText}>{isAr ? "واتساب" : "WhatsApp"}</Text>
              </Pressable>

              <Pressable
                onPress={() => shareViaEmail(selectedReport)}
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: "#EA4335" },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialIcons name="email" size={24} color="white" />
                <Text style={styles.shareBtnText}>{isAr ? "بريد إلكتروني" : "Email"}</Text>
              </Pressable>
            </View>

            {/* معاينة التقرير */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "معاينة التقرير" : "Report Preview"}</Text>
              <Text style={[styles.previewText, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>
                {generateReportText(selectedReport)}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "right",
  },
  reportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  reportCard: {
    width: "47%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 8,
  },
  reportCardTitle: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  shareOptions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "bold",
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "right",
  },
  previewText: {
    fontSize: 13,
    lineHeight: 22,
    textAlign: "right",
  },
});
