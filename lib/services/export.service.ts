import * as FileSystem from "expo-file-system";
import { localStorageService, StorageData } from "./local-storage";

interface ExportOptions {
  title?: string;
  includeTimestamp?: boolean;
  fileName?: string;
}

class ExportService {
  /**
   * تصدير البيانات إلى ملف نصي (CSV)
   */
  async exportToCSV(
    data: StorageData[],
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const { title = "Export", fileName = "export.csv" } = options;

      if (data.length === 0) {
        throw new Error("لا توجد بيانات للتصدير");
      }

      // الحصول على جميع المفاتيح
      const keys = Object.keys(data[0]);

      // إنشاء رأس الجدول
      let csv = keys.join(",") + "\n";

      // إضافة البيانات
      data.forEach((row) => {
        const values = keys.map((key) => {
          const value = row[key];
          // تجنب مشاكل الفواصل في CSV
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        });
        csv += values.join(",") + "\n";
      });

      // حفظ الملف
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);

      return fileUri;
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      throw error;
    }
  }

  /**
   * تصدير البيانات إلى ملف JSON
   */
  async exportToJSON(
    data: StorageData[],
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const { title = "Export", fileName = "export.json" } = options;

      if (data.length === 0) {
        throw new Error("لا توجد بيانات للتصدير");
      }

      const exportData = {
        title,
        exportedAt: new Date().toISOString(),
        totalRecords: data.length,
        data,
      };

      // حفظ الملف
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(
        fileUri,
        JSON.stringify(exportData, null, 2)
      );

      return fileUri;
    } catch (error) {
      console.error("Error exporting to JSON:", error);
      throw error;
    }
  }

  /**
   * تصدير البيانات إلى HTML (يمكن فتحه في المتصفح أو تحويله إلى PDF)
   */
  async exportToHTML(
    data: StorageData[],
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const { title = "Export", fileName = "export.html" } = options;

      if (data.length === 0) {
        throw new Error("لا توجد بيانات للتصدير");
      }

      const keys = Object.keys(data[0]);

      // إنشاء جدول HTML
      let html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              direction: rtl;
              margin: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              border-bottom: 2px solid #0a7ea4;
              padding-bottom: 10px;
            }
            .metadata {
              color: #666;
              font-size: 12px;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th {
              background-color: #0a7ea4;
              color: white;
              padding: 12px;
              text-align: right;
              font-weight: bold;
            }
            td {
              padding: 12px;
              border-bottom: 1px solid #ddd;
            }
            tr:hover {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${title}</h1>
            <div class="metadata">
              <p>تم التصدير في: ${new Date().toLocaleString("ar-SA")}</p>
              <p>عدد السجلات: ${data.length}</p>
            </div>
            <table>
              <thead>
                <tr>
                  ${keys.map((key) => `<th>${key}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${data
                  .map(
                    (row) => `
                  <tr>
                    ${keys.map((key) => `<td>${row[key] || "-"}</td>`).join("")}
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="footer">
              <p>تم إنشاء هذا التقرير بواسطة نظام متابعة أداء مصنع السلطان</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // حفظ الملف
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, html);

      return fileUri;
    } catch (error) {
      console.error("Error exporting to HTML:", error);
      throw error;
    }
  }

  /**
   * تصدير البيانات من التخزين المحلي مباشرة
   */
  async exportStorageData(
    storageKey: string,
    format: "csv" | "json" | "html" = "json",
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const data = await localStorageService.getAllData(storageKey);

      if (format === "csv") {
        return this.exportToCSV(data, options);
      } else if (format === "json") {
        return this.exportToJSON(data, options);
      } else if (format === "html") {
        return this.exportToHTML(data, options);
      }

      throw new Error("صيغة التصدير غير مدعومة");
    } catch (error) {
      console.error("Error exporting storage data:", error);
      throw error;
    }
  }

  /**
   * إنشاء تقرير شامل من عدة مفاتيح تخزين
   */
  async createComprehensiveReport(
    storageKeys: string[],
    format: "json" | "html" = "json",
    options: ExportOptions = {}
  ): Promise<string> {
    try {
      const report: Record<string, StorageData[]> = {};

      for (const key of storageKeys) {
        report[key] = await localStorageService.getAllData(key);
      }

      if (format === "json") {
        const fileUri = `${FileSystem.documentDirectory}comprehensive_report.json`;
        await FileSystem.writeAsStringAsync(
          fileUri,
          JSON.stringify(
            {
              title: options.title || "تقرير شامل",
              exportedAt: new Date().toISOString(),
              sections: report,
            },
            null,
            2
          )
        );
        return fileUri;
      } else if (format === "html") {
        let html = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <title>${options.title || "تقرير شامل"}</title>
            <style>
              body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; }
              .section { margin-bottom: 40px; page-break-inside: avoid; }
              h2 { color: #0a7ea4; border-bottom: 2px solid #0a7ea4; padding-bottom: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background-color: #0a7ea4; color: white; padding: 10px; text-align: right; }
              td { padding: 10px; border-bottom: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <h1>${options.title || "تقرير شامل"}</h1>
            <p>تم التصدير في: ${new Date().toLocaleString("ar-SA")}</p>
        `;

        for (const [key, data] of Object.entries(report)) {
          if (data.length > 0) {
            const keys = Object.keys(data[0]);
            html += `
              <div class="section">
                <h2>${key}</h2>
                <table>
                  <thead>
                    <tr>${keys.map((k) => `<th>${k}</th>`).join("")}</tr>
                  </thead>
                  <tbody>
                    ${data
                      .map(
                        (row) => `
                      <tr>${keys.map((k) => `<td>${row[k] || "-"}</td>`).join("")}</tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `;
          }
        }

        html += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
              <p>تم إنشاء هذا التقرير بواسطة نظام متابعة أداء مصنع السلطان</p>
            </div>
          </body>
          </html>
        `;

        const fileUri = `${FileSystem.documentDirectory}comprehensive_report.html`;
        await FileSystem.writeAsStringAsync(fileUri, html);
        return fileUri;
      }

      throw new Error("صيغة التصدير غير مدعومة");
    } catch (error) {
      console.error("Error creating comprehensive report:", error);
      throw error;
    }
  }
}

export const exportService = new ExportService();
