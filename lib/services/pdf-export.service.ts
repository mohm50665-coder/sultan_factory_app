import { Platform, Share } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export interface PDFReportData {
  title: string;
  subtitle?: string;
  date: string;
  sections: PDFSection[];
  footer?: string;
}

export interface PDFSection {
  title: string;
  type: "table" | "summary" | "kpi" | "text";
  data: any;
}

/**
 * Generate HTML report content that can be shared or printed as PDF
 */
function generateHTMLReport(report: PDFReportData): string {
  const sectionsHTML = report.sections.map((section) => {
    switch (section.type) {
      case "table":
        return generateTableSection(section);
      case "summary":
        return generateSummarySection(section);
      case "kpi":
        return generateKPISection(section);
      case "text":
        return generateTextSection(section);
      default:
        return "";
    }
  }).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', 'Tahoma', sans-serif; direction: rtl; padding: 20px; background: #fff; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0a7ea4; }
    .header h1 { font-size: 24px; color: #0a7ea4; margin-bottom: 8px; }
    .header h2 { font-size: 16px; color: #666; margin-bottom: 4px; }
    .header .date { font-size: 13px; color: #999; }
    .section { margin-bottom: 24px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: bold; color: #0a7ea4; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
    th { background: #0a7ea4; color: white; padding: 10px 8px; text-align: right; font-weight: bold; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; }
    tr:nth-child(even) { background: #f9fafb; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .summary-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #0a7ea4; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .kpi-card .kpi-title { font-size: 12px; color: #666; }
    .kpi-card .kpi-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
    .kpi-card .kpi-target { font-size: 11px; color: #999; margin-top: 2px; }
    .kpi-good { border-right: 4px solid #22c55e; }
    .kpi-warning { border-right: 4px solid #f59e0b; }
    .kpi-bad { border-right: 4px solid #ef4444; }
    .text-section { background: #f9fafb; padding: 16px; border-radius: 8px; line-height: 1.8; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #999; }
    @media print { body { padding: 0; } .header { page-break-after: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>مصنع السلطان</h1>
    <h2>${report.title}</h2>
    ${report.subtitle ? `<p>${report.subtitle}</p>` : ""}
    <p class="date">${report.date}</p>
  </div>
  ${sectionsHTML}
  <div class="footer">
    ${report.footer || "تم إنشاء هذا التقرير تلقائياً من نظام إدارة مصنع السلطان"}
    <br>تاريخ الإنشاء: ${new Date().toLocaleString("ar-SA")}
  </div>
</body>
</html>`;
}

function generateTableSection(section: PDFSection): string {
  const { headers, rows } = section.data;
  if (!headers || !rows) return "";

  const headerHTML = headers.map((h: string) => `<th>${h}</th>`).join("");
  const rowsHTML = rows.map((row: string[]) =>
    `<tr>${row.map((cell: string) => `<td>${cell}</td>`).join("")}</tr>`
  ).join("");

  return `<div class="section">
    <h3 class="section-title">${section.title}</h3>
    <table><thead><tr>${headerHTML}</tr></thead><tbody>${rowsHTML}</tbody></table>
  </div>`;
}

function generateSummarySection(section: PDFSection): string {
  const items = section.data as { label: string; value: string | number }[];
  const cardsHTML = items.map((item) =>
    `<div class="summary-card"><div class="value">${item.value}</div><div class="label">${item.label}</div></div>`
  ).join("");

  return `<div class="section">
    <h3 class="section-title">${section.title}</h3>
    <div class="summary-grid">${cardsHTML}</div>
  </div>`;
}

function generateKPISection(section: PDFSection): string {
  const kpis = section.data as { title: string; value: string | number; target?: string; status: "good" | "warning" | "bad" }[];
  const kpiHTML = kpis.map((kpi) =>
    `<div class="kpi-card kpi-${kpi.status}">
      <div class="kpi-title">${kpi.title}</div>
      <div class="kpi-value">${kpi.value}</div>
      ${kpi.target ? `<div class="kpi-target">الهدف: ${kpi.target}</div>` : ""}
    </div>`
  ).join("");

  return `<div class="section">
    <h3 class="section-title">${section.title}</h3>
    <div class="kpi-grid">${kpiHTML}</div>
  </div>`;
}

function generateTextSection(section: PDFSection): string {
  return `<div class="section">
    <h3 class="section-title">${section.title}</h3>
    <div class="text-section">${section.data}</div>
  </div>`;
}

/**
 * Export report as HTML file and share it
 */
export async function exportReportAsPDF(report: PDFReportData): Promise<string> {
  const html = generateHTMLReport(report);
  const fileName = `${report.title.replace(/\s+/g, "_")}_${Date.now()}.html`;

  if (Platform.OS === "web") {
    // Web: open the browser print dialog so the user can save a real PDF.
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
      return `${fileName.replace(/\.html$/, "")}.pdf`;
    }
    // Fallback when pop-ups are blocked: download the generated report as HTML.
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return fileName;
  } else {
    // Mobile: save to file system and share
    const filePath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(filePath, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Share.share({
      url: filePath,
      title: report.title,
      message: `تقرير: ${report.title}`,
    });

    return filePath;
  }
}

/**
 * Generate production report
 */
export function generateProductionReport(data: any): PDFReportData {
  return {
    title: "تقرير الإنتاج",
    subtitle: "ملخص شامل لبيانات الإنتاج",
    date: new Date().toLocaleDateString("ar-SA"),
    sections: [
      {
        title: "ملخص الإنتاج",
        type: "summary",
        data: [
          { label: "إجمالي الإنتاج (دزينة)", value: data.totalDozen || 0 },
          { label: "إجمالي الإنتاج (أزواج)", value: data.totalPairs || 0 },
          { label: "عدد الإدخالات", value: data.totalEntries || 0 },
          { label: "إجمالي الهدر (خيوط)", value: `${data.totalWasteThread || 0} جرام` },
          { label: "إجمالي الهدر (جوارب)", value: `${data.totalWasteSocks || 0} جرام` },
          { label: "متوسط الإنتاج اليومي", value: data.avgDaily || 0 },
        ],
      },
      {
        title: "مؤشرات الأداء",
        type: "kpi",
        data: [
          { title: "نسبة تحقيق الهدف", value: `${data.targetAchievement || 0}%`, target: "100%", status: (data.targetAchievement || 0) >= 90 ? "good" : (data.targetAchievement || 0) >= 70 ? "warning" : "bad" },
          { title: "نسبة الهدر", value: `${data.wastePercentage || 0}%`, target: "أقل من 5%", status: (data.wastePercentage || 0) <= 5 ? "good" : (data.wastePercentage || 0) <= 10 ? "warning" : "bad" },
        ],
      },
    ],
  };
}

/**
 * Generate cost report
 */
export function generateCostReport(data: any): PDFReportData {
  return {
    title: "تقرير التكاليف",
    subtitle: "تحليل تكاليف الإنتاج",
    date: new Date().toLocaleDateString("ar-SA"),
    sections: [
      {
        title: "ملخص التكاليف",
        type: "summary",
        data: [
          { label: "إجمالي التكاليف", value: `${data.totalCost || 0} ريال` },
          { label: "تكلفة المواد الخام", value: `${data.materialsCost || 0} ريال` },
          { label: "تكلفة العمالة", value: `${data.laborCost || 0} ريال` },
          { label: "تكلفة الصيانة", value: `${data.maintenanceCost || 0} ريال` },
          { label: "تكلفة المرافق", value: `${data.utilitiesCost || 0} ريال` },
          { label: "أخرى", value: `${data.otherCost || 0} ريال` },
        ],
      },
      {
        title: "مقارنة التكاليف",
        type: "kpi",
        data: [
          { title: "التكلفة الفعلية vs المتوقعة", value: `${data.variancePercentage || 0}%`, target: "0%", status: Math.abs(data.variancePercentage || 0) <= 5 ? "good" : Math.abs(data.variancePercentage || 0) <= 15 ? "warning" : "bad" },
          { title: "تكلفة الوحدة", value: `${data.costPerUnit || 0} ريال`, target: `${data.targetCostPerUnit || 0} ريال`, status: (data.costPerUnit || 0) <= (data.targetCostPerUnit || 999) ? "good" : "warning" },
        ],
      },
    ],
  };
}

/**
 * Generate comprehensive report
 */
export function generateComprehensiveReport(data: any): PDFReportData {
  return {
    title: "التقرير الشامل",
    subtitle: data.reportPeriod?.startDate && data.reportPeriod?.endDate
      ? `ملخص شامل لجميع أقسام المصنع — من ${data.reportPeriod.startDate} إلى ${data.reportPeriod.endDate}`
      : "ملخص شامل لجميع أقسام المصنع",
    date: data.reportPeriod?.startDate === data.reportPeriod?.endDate
      ? data.reportPeriod.startDate
      : (data.reportPeriod ? `${data.reportPeriod.startDate} إلى ${data.reportPeriod.endDate}` : new Date().toLocaleDateString("ar-SA")),
    sections: [
      {
        title: "ملخص عام",
        type: "summary",
        data: [
          { label: "إجمالي الإنتاج", value: `${data.production?.totalDozen || 0} دزينة` },
          { label: "إجمالي المبيعات", value: `${data.sales?.totalAmount || 0} ريال` },
          { label: "إجمالي المصروفات", value: `${data.expenses?.totalAmount || 0} ريال` },
          { label: "إجمالي التكاليف", value: `${data.costs?.totalCost || 0} ريال` },
          { label: "إجمالي التحصيل", value: `${data.collection?.totalAmount || 0} ريال` },
          { label: "المهام المكتملة", value: `${data.tasks?.completed || 0}/${data.tasks?.total || 0}` },
        ],
      },
      {
        title: "مؤشرات الأداء الرئيسية",
        type: "kpi",
        data: [
          { title: "نسبة إنجاز المهام", value: `${data.tasks?.total ? Math.round((data.tasks.completed / data.tasks.total) * 100) : 0}%`, target: "100%", status: data.tasks?.total ? ((data.tasks.completed / data.tasks.total) >= 0.8 ? "good" : "warning") : "bad" },
          { title: "صافي الربح", value: `${(data.sales?.totalAmount || 0) - (data.expenses?.totalAmount || 0)} ريال`, status: ((data.sales?.totalAmount || 0) - (data.expenses?.totalAmount || 0)) > 0 ? "good" : "bad" },
          { title: "نسبة التحصيل", value: `${data.sales?.totalAmount ? Math.round((data.collection?.totalAmount / data.sales.totalAmount) * 100) : 0}%`, target: "100%", status: data.sales?.totalAmount ? ((data.collection?.totalAmount / data.sales.totalAmount) >= 0.8 ? "good" : "warning") : "bad" },
          { title: "عدد الإدخالات", value: `${(data.production?.totalEntries || 0) + (data.sales?.totalEntries || 0)}`, status: "good" },
        ],
      },
    ],
  };
}
