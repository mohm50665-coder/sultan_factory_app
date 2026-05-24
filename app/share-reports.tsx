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
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ReportOption {
  id: string;
  title: string;
  icon: string;
  storageKey: string;
}

const REPORT_OPTIONS: ReportOption[] = [
  { id: "production", title: "تقرير الإنتاج", icon: "factory", storageKey: "sultan_production_entries" },
  { id: "sales", title: "تقرير المبيعات", icon: "point-of-sale", storageKey: "sultan_sales_entries" },
  { id: "warehouse", title: "تقرير المستودعات", icon: "warehouse", storageKey: "sultan_warehouse_raw" },
  { id: "maintenance", title: "تقرير الصيانة", icon: "build", storageKey: "sultan_maintenance_entries" },
  { id: "expenses", title: "تقرير المصروفات", icon: "receipt-long", storageKey: "sultan_financial_entries" },
  { id: "tasks", title: "تقرير المهام", icon: "task-alt", storageKey: "sultan_tasks_entries" },
];

export default function ShareReportsScreen() {
  const colors = useColors();
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [reportData, setReportData] = useState<any[]>([]);

  const loadReportData = async (storageKey: string) => {
    try {
      const data = await AsyncStorage.getItem(storageKey);
      if (data) {
        setReportData(JSON.parse(data));
      } else {
        setReportData([]);
      }
    } catch (e) {
      setReportData([]);
    }
  };

  const generateReportText = (reportId: string): string => {
    const today = new Date().toLocaleDateString("ar-SA");
    let text = `📊 تقرير مصنع السلطان\n📅 التاريخ: ${today}\n\n`;

    if (reportData.length === 0) {
      return text + "لا توجد بيانات مسجلة بعد.";
    }

    switch (reportId) {
      case "production":
        text += "🏭 تقرير الإنتاج:\n";
        text += `إجمالي السجلات: ${reportData.length}\n`;
        const totalProd = reportData.reduce((s, e) => s + parseFloat(e.quantity || e.production || 0), 0);
        const totalWaste = reportData.reduce((s, e) => s + parseFloat(e.waste || 0), 0);
        text += `إجمالي الإنتاج: ${totalProd.toFixed(0)}\n`;
        text += `إجمالي الهدر: ${totalWaste.toFixed(0)}\n`;
        text += `نسبة الهدر: ${totalProd > 0 ? ((totalWaste / totalProd) * 100).toFixed(1) : 0}%\n`;
        break;
      case "sales":
        text += "💰 تقرير المبيعات:\n";
        text += `إجمالي السجلات: ${reportData.length}\n`;
        const totalSales = reportData.reduce((s, e) => s + parseFloat(e.amount || e.total || 0), 0);
        text += `إجمالي المبيعات: ${totalSales.toFixed(0)} ريال\n`;
        break;
      case "warehouse":
        text += "📦 تقرير المستودعات:\n";
        text += `إجمالي السجلات: ${reportData.length}\n`;
        break;
      case "maintenance":
        text += "🔧 تقرير الصيانة:\n";
        text += `إجمالي السجلات: ${reportData.length}\n`;
        const completed = reportData.filter((e) => e.status === "completed" || e.status === "مكتمل").length;
        text += `صيانة مكتملة: ${completed}\n`;
        text += `صيانة معلقة: ${reportData.length - completed}\n`;
        break;
      case "expenses":
        text += "📝 تقرير المصروفات:\n";
        text += `إجمالي السجلات: ${reportData.length}\n`;
        const totalExp = reportData.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
        text += `إجمالي المصروفات: ${totalExp.toFixed(0)} ريال\n`;
        break;
      case "tasks":
        text += "✅ تقرير المهام:\n";
        text += `إجمالي المهام: ${reportData.length}\n`;
        const done = reportData.filter((e) => e.result === "completed" || e.result === "أنجز").length;
        text += `مهام منجزة: ${done}\n`;
        text += `مهام معلقة: ${reportData.length - done}\n`;
        break;
      default:
        text += `إجمالي السجلات: ${reportData.length}\n`;
    }

    text += "\n---\nتم إنشاء هذا التقرير من تطبيق مصنع السلطان";
    return text;
  };

  const shareViaWhatsApp = (reportId: string) => {
    if (reportData.length === 0 && !selectedReport) {
      Alert.alert("تنبيه", "لا توجد بيانات لمشاركتها");
      return;
    }
    const text = encodeURIComponent(generateReportText(reportId));
    const url = `https://wa.me/?text=${text}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح واتساب");
    });
  };

  const shareViaEmail = (reportId: string) => {
    if (reportData.length === 0 && !selectedReport) {
      Alert.alert("تنبيه", "لا توجد بيانات لمشاركتها");
      return;
    }
    const report = REPORT_OPTIONS.find((r) => r.id === reportId);
    const subject = encodeURIComponent(`${report?.title || "تقرير"} - مصنع السلطان`);
    const body = encodeURIComponent(generateReportText(reportId));
    const url = `mailto:?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("خطأ", "تعذر فتح البريد الإلكتروني");
    });
  };

  const handleSelectReport = async (report: ReportOption) => {
    setSelectedReport(report.id);
    await loadReportData(report.storageKey);
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>مشاركة التقارير</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* اختيار التقرير */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>اختر التقرير</Text>

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
                {report.title}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* خيارات المشاركة */}
        {selectedReport && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>طريقة المشاركة</Text>

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
                <Text style={styles.shareBtnText}>واتساب</Text>
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
                <Text style={styles.shareBtnText}>بريد إلكتروني</Text>
              </Pressable>
            </View>

            {/* معاينة التقرير */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>معاينة التقرير</Text>
              <Text style={[styles.previewText, { color: colors.muted }]}>
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
