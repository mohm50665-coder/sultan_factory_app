import ExcelJS from "exceljs";
import { reportExportRows, formatPairs, formatDuration, type CustodyReport } from "../shared/custody-reporting";

export async function createCustodyWorkbook(report: CustodyReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "مصنع السلطان";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("ملخص الفترة", { views: [{ rightToLeft: true, state: "frozen", ySplit: 3 }], pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  summary.addRow(["تقرير العهد والاستلام والتسليم"]);
  summary.addRow(["من", report.range.startDate, "إلى", report.range.endDate, "توقيت الرياض"]);
  summary.addRow(["القسم", "الموظف", "وارد مؤكد (زوج)", "منجز فعلي بالقراءات (زوج)", "صادر مؤكد (زوج)", "مرسل معلق (زوج)", "مسؤولية النهاية (زوج)", "عمل فعلي", "توقف", "إنتاجية السليم زوج/ساعة","منجز سليم","مشتبه","تالف","إعادة عمل","عينات","دقائق/زوج سليم"]);
  for (const group of report.departments) for (const employee of group.employees) summary.addRow([group.department,employee.employeeName,employee.totals.receivedPairs,employee.totals.completedPairs,employee.totals.confirmedOutboundPairs,employee.totals.pendingOutboundPairs,employee.balance.endingLiabilityPairs,formatDuration(employee.totals.timeIncomplete?null:employee.totals.manualWorkMs),formatDuration(employee.totals.timeIncomplete?null:employee.totals.pauseMs),employee.totals.productivityPairsPerHour,employee.totals.goodCompletedPairs,employee.totals.suspectedCompletedPairs,employee.totals.damagedCompletedPairs,employee.totals.reworkCompletedPairs,employee.totals.sampleCompletedPairs,employee.totals.workMinutesPerGoodPair]);
  summary.addRow([]);summary.addRow(["الإنتاج الأصلي مرة واحدة", report.originalProductionPairs]);
  summary.addRow(["الوارد المخزني المعتمد خلال الفترة", report.warehouseFinalStockPairs]);
  summary.addRow(["الإتلاف المنفذ خلال الفترة", report.disposal.executedPairs]);
  for(const warning of report.warnings) summary.addRow(["تنبيه قياس",warning]);
  const detail=workbook.addWorksheet("حركات الموظفين",{views:[{rightToLeft:true,state:"frozen",ySplit:1}],pageSetup:{orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const exports=reportExportRows(report);const headers=exports.length?Object.keys(exports[0]):["القسم","الموظف","رقم الدفعة","الصنف","الكمية (زوج)","الوقت (الرياض)"];
  detail.columns=headers.map(header=>({header,key:header,width:header.includes("ملاحظة")?38:header.includes("الوقت")?25:20}));
  const ordered=[...report.events].sort((a,b)=>a.department.localeCompare(b.department,"ar")||a.actorName.localeCompare(b.actorName,"ar")||(a.at||"").localeCompare(b.at||""));
  // Keep the exact export values; only ordering changes to department then employee.
  const rowByEvent=new Map(report.events.map((event,index)=>[event.id,exports[index]]));
  for(const event of ordered)detail.addRow(rowByEvent.get(event.id));
  for(const sheet of [summary,detail]){
    if(sheet===summary)sheet.columns.forEach(column=>column.width=24);
    sheet.eachRow((row,index)=>{row.eachCell(cell=>{cell.alignment={horizontal:"right",vertical:"top",wrapText:true};cell.font={name:"Arial",size:10};cell.border={bottom:{style:"hair",color:{argb:"FFE2E8F0"}}};});if(index===(sheet===summary?3:1))row.eachCell(cell=>{cell.font={name:"Arial",size:10,bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF075985"}};});});
  }
  detail.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
