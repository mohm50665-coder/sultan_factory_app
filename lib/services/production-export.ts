import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";

export interface ProductionRecord {
  id: string;
  machineId: string;
  date: string;
  productionDozen: number;
  productionPairs: number;
  wasteThread: number; // grams
  wasteSocks: number; // grams
  secondGrade: number; // pairs
  wasteNeedles: number; // pieces
}

const PRODUCTION_DATA_KEY = "production_data";

export const productionExportService = {
  async getProductionData(date?: string): Promise<ProductionRecord[]> {
    try {
      const dataJson = await AsyncStorage.getItem(PRODUCTION_DATA_KEY);
      let records: ProductionRecord[] = dataJson ? JSON.parse(dataJson) : [];

      if (date) {
        records = records.filter((r) => r.date === date);
      }

      return records;
    } catch (error) {
      console.error("Failed to get production data:", error);
      return [];
    }
  },

  generateCSV(records: ProductionRecord[], date: string): string {
    const header = "رقم المكينة,التاريخ,الإنتاج (درزن),الإنتاج (زوج),هدر الخيوط (جرام),هدر الجوارب (جرام),النخب الثاني (زوج),هدر الإبر (حبة)";
    const rows = records.map(
      (r) =>
        `${r.machineId},${r.date},${r.productionDozen},${r.productionPairs},${r.wasteThread},${r.wasteSocks},${r.secondGrade},${r.wasteNeedles}`
    );

    // Calculate totals
    const totals = records.reduce(
      (acc, r) => ({
        productionDozen: acc.productionDozen + r.productionDozen,
        productionPairs: acc.productionPairs + r.productionPairs,
        wasteThread: acc.wasteThread + r.wasteThread,
        wasteSocks: acc.wasteSocks + r.wasteSocks,
        secondGrade: acc.secondGrade + r.secondGrade,
        wasteNeedles: acc.wasteNeedles + r.wasteNeedles,
      }),
      { productionDozen: 0, productionPairs: 0, wasteThread: 0, wasteSocks: 0, secondGrade: 0, wasteNeedles: 0 }
    );

    const totalRow = `المجموع,${date},${totals.productionDozen},${totals.productionPairs},${totals.wasteThread},${totals.wasteSocks},${totals.secondGrade},${totals.wasteNeedles}`;

    return [header, ...rows, "", totalRow].join("\n");
  },

  generateHTML(records: ProductionRecord[], date: string): string {
    const totals = records.reduce(
      (acc, r) => ({
        productionDozen: acc.productionDozen + r.productionDozen,
        productionPairs: acc.productionPairs + r.productionPairs,
        wasteThread: acc.wasteThread + r.wasteThread,
        wasteSocks: acc.wasteSocks + r.wasteSocks,
        secondGrade: acc.secondGrade + r.secondGrade,
        wasteNeedles: acc.wasteNeedles + r.wasteNeedles,
      }),
      { productionDozen: 0, productionPairs: 0, wasteThread: 0, wasteSocks: 0, secondGrade: 0, wasteNeedles: 0 }
    );

    const wastePercentage = totals.productionPairs > 0
      ? (((totals.wasteThread + totals.wasteSocks) / (totals.productionPairs * 50)) * 100).toFixed(2)
      : "0";

    const rows = records
      .map(
        (r) => `
      <tr>
        <td>${r.machineId}</td>
        <td>${r.productionDozen}</td>
        <td>${r.productionPairs}</td>
        <td>${r.wasteThread}</td>
        <td>${r.wasteSocks}</td>
        <td>${r.secondGrade}</td>
        <td>${r.wasteNeedles}</td>
      </tr>`
      )
      .join("");

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير الإنتاج اليومي - ${date}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
    h1 { color: #0a7ea4; text-align: center; }
    h2 { color: #333; text-align: center; margin-bottom: 5px; }
    .date { text-align: center; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #0a7ea4; color: white; padding: 10px; text-align: center; }
    td { padding: 8px; text-align: center; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .totals { background: #e0f7fa !important; font-weight: bold; }
    .stats { display: flex; justify-content: space-around; margin: 20px 0; }
    .stat-box { background: #f5f5f5; border-radius: 10px; padding: 15px; text-align: center; min-width: 120px; }
    .stat-number { font-size: 24px; font-weight: bold; color: #0a7ea4; }
    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
    .footer { text-align: center; color: #999; margin-top: 30px; font-size: 12px; }
    .waste-alert { color: #ef4444; font-weight: bold; }
  </style>
</head>
<body>
  <h1>مصنع السلطان</h1>
  <h2>تقرير الإنتاج اليومي</h2>
  <p class="date">التاريخ: ${date}</p>

  <div class="stats">
    <div class="stat-box">
      <div class="stat-number">${totals.productionDozen}</div>
      <div class="stat-label">إجمالي الإنتاج (درزن)</div>
    </div>
    <div class="stat-box">
      <div class="stat-number">${totals.productionPairs}</div>
      <div class="stat-label">إجمالي الإنتاج (زوج)</div>
    </div>
    <div class="stat-box">
      <div class="stat-number">${wastePercentage}%</div>
      <div class="stat-label">نسبة الهدر</div>
    </div>
    <div class="stat-box">
      <div class="stat-number">${records.length}</div>
      <div class="stat-label">عدد المكائن</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>رقم المكينة</th>
        <th>الإنتاج (درزن)</th>
        <th>الإنتاج (زوج)</th>
        <th>هدر الخيوط (جرام)</th>
        <th>هدر الجوارب (جرام)</th>
        <th>النخب الثاني (زوج)</th>
        <th>هدر الإبر (حبة)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="totals">
        <td>المجموع</td>
        <td>${totals.productionDozen}</td>
        <td>${totals.productionPairs}</td>
        <td>${totals.wasteThread}</td>
        <td>${totals.wasteSocks}</td>
        <td>${totals.secondGrade}</td>
        <td>${totals.wasteNeedles}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    تم إنشاء هذا التقرير بواسطة تطبيق متابعة أداء مصنع السلطان | ${new Date().toLocaleString("ar-SA")}
  </div>
</body>
</html>`;
  },

  async shareReport(content: string, format: "csv" | "html", date: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        // On web, create a downloadable blob
        const mimeType = format === "csv" ? "text/csv" : "text/html";
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `production_report_${date}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // On mobile, use Share API
        await Share.share({
          message: content,
          title: `تقرير الإنتاج - ${date}`,
        });
      }
    } catch (error) {
      console.error("Failed to share report:", error);
      throw error;
    }
  },
};
