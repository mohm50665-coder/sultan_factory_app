/** Single business-source contract for all operational reports. No writes or synthetic records. */
export type ReportKind = "production" | "sale" | "collection" | "transaction" | "movement" | "general";
export const REPORT_TIMEZONE = "Asia/Riyadh";
export function reportRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ["items", "rows", "data", "results"]) if (Array.isArray(value?.[key])) return value[key];
  return [];
}
export function riyadhDate(value: Date = new Date()): string {
  if (!Number.isFinite(value.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: REPORT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (key: string) => parts.find(p => p.type === key)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value ? value : "";
}
export function reportDate(value: unknown): string {
  if (value instanceof Date) return riyadhDate(value);
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  // ISO instants have an explicit zone. MySQL date/datetime business strings do not.
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return riyadhDate(new Date(raw));
  const sql = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|[ T]\d{2}:\d{2})/);
  if (sql) return validDay(sql[1]);
  const legacy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return legacy ? validDay(`${legacy[3]}-${legacy[2].padStart(2,"0")}-${legacy[1].padStart(2,"0")}`) : "";
}
const dateFields: Record<ReportKind, string[]> = {
  // Every entry is an operational/business-event field. `createdAt` and `updatedAt` are audit
  // timestamps only, and are deliberately excluded from every report-period calculation.
  production: ["productionDate", "date"], sale: ["invoiceDate", "saleDate", "date"],
  collection: ["collectionDate", "receiptDate", "date"], transaction: ["orderDate", "visitDate", "date"],
  movement: ["movementDate", "movementAt", "deliveredAt", "receivedAt"],
  general: ["date", "reportDate", "entryDate", "requestDate", "submissionDate", "expenseDate", "maintenanceDate", "stopDate", "orderDate", "visitDate", "invoiceDate", "collectionDate", "createdDate", "completedDate", "actionDate"],
};
export function businessDate(row: any, kind: ReportKind): string {
  const source = { ...(row?.data && typeof row.data === "object" ? row.data : {}), ...row };
  for (const key of dateFields[kind]) if (source?.[key] != null && source[key] !== "") return reportDate(source[key]);
  // An entry without a business event date must never be included merely because it was saved
  // today. The caller can show it as "needs review", but it cannot inflate a daily report.
  return "";
}
export function inReportPeriod(row: any, kind: ReportKind, start: string, end: string, allDates = false): boolean {
  if (allDates) return true;
  const a = reportDate(start), b = reportDate(end || start), date = businessDate(row, kind);
  if (!a || !b || !date) return false;
  return date >= (a < b ? a : b) && date <= (a < b ? b : a);
}
const number = (value: any, fallback = 0): number => value == null || value === "" ? fallback : Number(value);
function wholePairs(value: number): number {
  const rounded = Math.round(value);
  return Number.isFinite(value) && Number.isSafeInteger(rounded) && value >= 0 && Math.abs(value-rounded) <= 0.00002 ? rounded : NaN;
}
export type PairKind = "production" | "second" | "item" | "stock" | "movement" | "handover";
export function exactPairs(row: any, kind: PairKind): number {
  if (!row) return NaN;
  if (kind === "production") return wholePairs(number(row.productionDozen)*12+number(row.productionPairs));
  if (kind === "second") return wholePairs(number(row.secondGradeDozen)*12+number(row.secondGradePairs));
  if ((kind === "stock" || kind === "movement") && row.totalPairs != null) return wholePairs(Number(row.totalPairs));
  if (kind === "item") {
    if (row.quantityDozen != null || row.quantityPair != null || row.quantityPairs != null)
      return wholePairs(number(row.quantityDozen)*12+number(row.quantityPair ?? row.quantityPairs));
    if (row.quantity != null && ["dozen","pair"].includes(row.quantityUnit)) return wholePairs(number(row.quantity)*(row.quantityUnit === "dozen" ? 12 : 1));
    return NaN;
  }
  if ((kind === "stock" || kind === "movement") && row.quantityDozen == null) return NaN;
  return wholePairs(number(row.quantityDozen)*12+number(row.quantityPairs ?? row.quantityPair));
}
export function pairLabel(pairs: number): string {
  if (!Number.isSafeInteger(pairs)) return "كمية غير صالحة — تحتاج مراجعة";
  const sign = pairs < 0 ? "−" : ""; const value = Math.abs(pairs);
  return `${sign}${Math.floor(value/12).toLocaleString("ar-SA")} درزن + ${value%12} زوج`;
}
export const YARN_FIELDS = ["yarnRubber","yarnSpandex","yarnNylon","yarnCotton","yarnBamboo","yarnSpan"] as const;
export function productionMetrics(rows: any[]) {
  const totals = { totalPairs:0,firstPairs:0,secondPairs:0,yarnGrams:0,wasteThreadGrams:0,wasteSocksGrams:0,needlesUsed:0,wasteNeedles:0, invalidQuantityCount:0 };
  for (const row of rows) {
    const pairs = exactPairs(row,"production"), second = exactPairs(row,"second");
    if (!Number.isFinite(pairs) || !Number.isFinite(second) || second>pairs) totals.invalidQuantityCount++;
    totals.totalPairs += pairs; totals.secondPairs += second; totals.firstPairs += pairs-second;
    totals.yarnGrams += row.yarnIssuedGrams != null ? number(row.yarnIssuedGrams) : YARN_FIELDS.reduce((sum,key)=>sum+number(row[key]),0)*pairs;
    totals.wasteThreadGrams += number(row.wasteThreadGrams); totals.wasteSocksGrams += number(row.wasteSocksGrams);
    totals.needlesUsed += number(row.needlesUsed); totals.wasteNeedles += number(row.wasteNeedles);
  }
  return { ...totals, wastePercent:totals.yarnGrams>0?(totals.wasteThreadGrams+totals.wasteSocksGrams)/totals.yarnGrams*100:null,
    threadWastePercent:totals.yarnGrams>0?totals.wasteThreadGrams/totals.yarnGrams*100:null };
}
function sourced(rows: any[], source: string): any[] {
  const seen = new Set<string>();
  return rows.filter(row=>{if(row?.deletedAt)return false;const key=String(row?.id??row?.referenceCode??"");if(!key)return true;if(seen.has(key))return false;seen.add(key);return true;}).map(row=>({...row,reportSource:source}));
}
export type CommercialInput = { sales:any[];legacySales:any[];collections:any[];legacyCollections:any[];transactions:any[];legacyTransactions?:any[];startDate:string;endDate:string;allDates?:boolean };
export function commercialReport(input: CommercialInput) {
  const within = (kind:ReportKind)=>(row:any)=>inReportPeriod(row,kind,input.startDate,input.endDate,!!input.allDates);
  const salesRows = [...sourced(input.sales,"مبيعات أداء المندوب"),...sourced(input.legacySales,"سجل المبيعات السابق")].filter(within("sale"));
  const collectionRows = [...sourced(input.collections,"تحصيل أداء المندوب"),...sourced(input.legacyCollections,"سجل التحصيل السابق")].filter(within("collection"));
  const transactions = [...sourced(input.transactions,"طلبات وزيارات أداء المندوب"),...sourced(input.legacyTransactions||[],"الطلبات والزيارات السابقة")].filter(within("transaction"));
  const type = (row:any)=>String(row.transactionType||row.customerStatus||row.type||"").toLowerCase();
  return { salesRows,collectionRows,orderRows:transactions.filter(row=>["order","طلب"].includes(type(row))),visitRows:transactions.filter(row=>["visit","زيارة"].includes(type(row))),
    otherTransactionRows:transactions.filter(row=>!["order","طلب","visit","زيارة"].includes(type(row))),
    salesAmount:salesRows.reduce((sum,row)=>sum+number(row.amount),0), collectionAmount:collectionRows.reduce((sum,row)=>sum+number(row.collectedAmount??row.amount),0) };
}
export function transactionStatusLabel(status:unknown,type?:string):string {
  if(type==="visit")return "زيارة مسجلة — معلومات فقط";
  const labels:Record<string,string>={DRAFT:"مسودة",RECORDED:"مسجل",PENDING_SALES_APPROVAL:"بانتظار اعتماد مدير التسويق",REJECTED_SALES:"مرفوض من التسويق",PENDING_WAREHOUSE_ISSUE:"معتمد — بانتظار المستودعات",WAREHOUSE_EXECUTED:"تم التنفيذ",WAREHOUSE_PARTIAL:"تم التنفيذ الجزئي",WAREHOUSE_NOT_EXECUTED:"لم يتم التنفيذ",WAREHOUSE_NOT_AVAILABLE:"غير متاح",PENDING_REPRESENTATIVE_REPLY:"بانتظار رد المندوب",REPRESENTATIVE_REPLIED:"رد المندوب — بانتظار التنفيذ",REPRESENTATIVE_CLOSED:"أغلقه المندوب",CLOSED:"مغلق",CLOSED_REJECTED:"مغلق — مرفوض"};
  const raw=String(status||"");return labels[raw]||raw||"لم تسجل الحالة";
}
export function visitText(value:unknown):string {
  if(value==null||value==="")return "—";
  let data:any=value;if(typeof value==="string"){try{data=JSON.parse(value);}catch{return value;}}
  if(data&&typeof data==="object"){
    const action=({follow_up:"متابعة",product_presentation:"عرض منتج",product_offer:"عرض منتج",presentation:"عرض منتج"} as Record<string,string>)[data.action]||data.action||"";
    return [action,data.notes??data.report??data.observations].filter(Boolean).join(" — ")||"—";
  }
  return String(value);
}
function signedMovement(row:any):number {
  const raw=number(row.totalPairs??number(row.quantityDozen,NaN)*12,NaN);
  if(row.movementType==="adjustment") {
    const explicit = row.signedPairs ?? row.adjustmentPairs ?? (raw<0?raw:undefined);
    return explicit==null?NaN:Number(explicit);
  }
  const pairs=exactPairs(row,"movement");
  return row.movementType==="receipt"?pairs:row.movementType==="issue"?-pairs:NaN;
}
export function warehousePeriod(input:{movements:any[];stock:any[];startDate:string;endDate:string;allDates?:boolean}) {
  const all = sourced(input.movements,"دفتر إنتاج تام");
  const movements = all.filter(row=>inReportPeriod(row,"movement",input.startDate,input.endDate,!!input.allDates));
  const a=reportDate(input.startDate), b=reportDate(input.endDate||input.startDate), end=a>b?a:b;
  const currentPairs=input.stock.reduce((sum,row)=>sum+exactPairs(row,"stock"),0);
  let receiptPairs=0,issuePairs=0,adjustmentPairs=0,invalidQuantityCount=0;
  for(const row of movements){const delta=signedMovement(row);if(!Number.isFinite(delta))invalidQuantityCount++;
    if(row.movementType==="receipt")receiptPairs+=delta;else if(row.movementType==="issue")issuePairs-=delta;else adjustmentPairs+=delta;}
  const netPairs=receiptPairs-issuePairs+adjustmentPairs;
  // Reconstruct a point-in-time balance, never label today's snapshot as a historical balance.
  const later=all.filter(row=>{const date=businessDate(row,"movement");return !input.allDates&&date&&date>end;});
  const laterNet=later.reduce((sum,row)=>sum+signedMovement(row),0);
  const incomplete=all.some(row=>!businessDate(row,"movement")) || !Number.isFinite(currentPairs) || !Number.isFinite(laterNet) || !Number.isFinite(netPairs);
  const closingPairs=incomplete?null:currentPairs-laterNet;
  const openingPairs=closingPairs==null?null:closingPairs-netPairs;
  return {movements,receiptPairs,issuePairs,adjustmentPairs,netPairs,openingPairs,closingPairs,currentPairs,invalidQuantityCount};
}
