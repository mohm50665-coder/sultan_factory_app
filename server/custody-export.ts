import ExcelJS from "exceljs";
import {
  formatDuration,
  reportExportRows,
  reportStageTotalRows,
  reportTransferRows,
  type CustodyReport,
} from "../shared/custody-reporting";

function styleSheet(sheet: ExcelJS.Worksheet, headerRows: number[]) {
  sheet.eachRow((row, index) => {
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "right", vertical: "top", wrapText: true };
      cell.font = { name: "Arial", size: 10 };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
    });
    if (headerRows.includes(index)) {
      row.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF075985" },
        };
      });
    }
  });
}

function addObjectTable(
  sheet: ExcelJS.Worksheet,
  rows: Record<string, string | number | null>[],
  emptyHeaders: string[],
) {
  const headers = rows.length ? Object.keys(rows[0]!) : emptyHeaders;
  sheet.addRow(headers);
  for (const row of rows)
    sheet.addRow(headers.map((header) => row[header] ?? null));
  return { headers, headerRow: sheet.rowCount - rows.length };
}

/**
 * True XLSX export. Stage ledger and immutable one-row transfer facts use the same shared
 * reporting selectors as the printable HTML/PDF; no second export-specific calculation exists.
 */
export async function createCustodyWorkbook(
  report: CustodyReport,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "مصنع السلطان";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("ملخص المراحل", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  summary.addRow(["تقرير العهد والاستلام والتسليم"]);
  summary.addRow([
    "من",
    report.range.startDate,
    "إلى",
    report.range.endDate,
    "توقيت الرياض",
  ]);
  // Employee detail stays first for compatibility with prior real XLSX exports. Stage totals
  // below are the authoritative aggregate and share the same report facts as HTML/PDF.
  const employeeHeaderRow = summary.rowCount + 1;
  summary.addRow([
    "القسم",
    "الموظف",
    "وارد مؤكد (زوج)",
    "منجز فعلي بالقراءات (زوج)",
    "صادر مؤكد (زوج)",
    "مرسل معلق (زوج)",
    "مسؤولية النهاية (زوج)",
    "عمل فعلي",
    "توقف",
    "إنتاجية السليم زوج/ساعة",
    "منجز سليم",
    "مشتبه",
    "تالف",
    "إعادة عمل",
    "عينات",
    "دقائق/زوج سليم",
  ]);
  for (const group of report.departments)
    for (const employee of group.employees) {
      summary.addRow([
        group.department,
        employee.employeeName,
        employee.totals.receivedPairs,
        employee.totals.completedPairs,
        employee.totals.confirmedOutboundPairs,
        employee.totals.pendingOutboundPairs,
        employee.balance.endingLiabilityPairs,
        formatDuration(
          employee.totals.timeIncomplete ? null : employee.totals.manualWorkMs,
        ),
        formatDuration(
          employee.totals.timeIncomplete ? null : employee.totals.pauseMs,
        ),
        employee.totals.productivityPairsPerHour,
        employee.totals.goodCompletedPairs,
        employee.totals.suspectedCompletedPairs,
        employee.totals.damagedCompletedPairs,
        employee.totals.reworkCompletedPairs,
        employee.totals.sampleCompletedPairs,
        employee.totals.workMinutesPerGoodPair,
      ]);
    }
  summary.addRow([]);
  summary.addRow(["إجماليات المراحل — عهدة وحركة وليست إنتاجاً جديداً"]);
  const stage = addObjectTable(summary, reportStageTotalRows(report), [
    "المرحلة",
    "رصيد البداية (زوج)",
    "وارد مؤكد (زوج)",
    "صادر مؤكد (زوج)",
    "مرسل معلق (زوج)",
    "إغلاق موثق (زوج)",
    "المتبقي / المسؤولية (زوج)",
    "كميات غير صالحة",
  ]);
  summary.addRow([
    "إنتاج أصلي (مرة واحدة)",
    report.originalProductionPairs,
    "وارد مخزني معتمد",
    report.warehouseFinalStockPairs,
    "إتلاف منفذ",
    report.disposal.executedPairs,
  ]);
  if (report.warnings.length) {
    summary.addRow([]);
    for (const warning of report.warnings)
      summary.addRow(["تنبيه قياس", warning]);
  }

  const detail = workbook.addWorksheet("التحويلات والحركات", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  detail.addRow(["جدول التحويلات الموحد — صف واحد لكل معرف تحويل"]);
  const transfer = addObjectTable(detail, reportTransferRows(report), [
    "رقم التحويل",
    "رقم الدفعة",
    "قسم المرسل",
    "اسم المرسل",
    "قسم المستلم",
    "اسم المستلم",
    "الصنف",
    "المقاس",
    "اللون",
    "النخب",
    "الوردية",
    "الماكينة",
    "المرسل (زوج)",
    "الفعلي (زوج)",
    "الفرق الفعلي - المرسل (زوج)",
    "وقت الإرسال (الرياض)",
    "وقت الاستلام (الرياض)",
    "المدة",
    "الحالة",
    "سبب/ملاحظة",
  ]);
  detail.autoFilter = {
    from: { row: transfer.headerRow, column: 1 },
    to: { row: transfer.headerRow, column: transfer.headers.length },
  };
  detail.addRow([]);
  detail.addRow(["الأحداث الداعمة — ليست صفوف تحويل إضافية"]);
  const events = addObjectTable(
    detail,
    reportExportRows(report).filter(
      (row) => row["نوع الحركة"] !== "تحويل عهدة — تسليم واستلام",
    ),
    [
      "القسم / المرحلة",
      "الموظف / المسؤول",
      "رقم الدفعة",
      "الصنف",
      "نوع الحركة",
      "الكمية المرسلة (زوج)",
      "وقت الحركة (الرياض)",
      "الحالة",
      "ملاحظة",
    ],
  );

  for (const sheet of [summary, detail]) {
    sheet.columns.forEach((column) => {
      column.width = 22;
    });
  }
  styleSheet(summary, [employeeHeaderRow, stage.headerRow]);
  styleSheet(detail, [transfer.headerRow, events.headerRow]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
