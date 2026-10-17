import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { alerts, users, finishedWarehouseStock, finishedWarehouseMovements } from '../drizzle/schema';

export function integerPairs(value:number,label='الكمية'):number {
 if(!Number.isSafeInteger(value)||value<0||value>2147483647) throw new TRPCError({code:'BAD_REQUEST',message:`${label} يجب أن تكون أزواجًا صحيحة غير سالبة ضمن الحد المسموح`});
 return value;
}
export function legacyDozenToPairs(dozen:unknown):number {
 const value=Number(dozen)*12;const rounded=Math.round(value);
 if(!Number.isFinite(value)||Math.abs(value-rounded)>0.00002)throw new TRPCError({code:'PRECONDITION_FAILED',message:'الرصيد التاريخي يحتوي كسر زوج غير قابل للتحويل؛ يلزم محضر تسوية موثق قبل الحركة، دون تعديل الرصيد تلقائيًا'});
 return integerPairs(rounded,'الرصيد');
}
export function stockPairCount(stock:{totalPairs?:number|null;quantityDozen:unknown}):number {
 return stock.totalPairs==null?legacyDozenToPairs(stock.quantityDozen):integerPairs(Number(stock.totalPairs),'الرصيد');
}
// Caller MUST hold a transaction; row-level locks serialize against all warehouse writers.
export async function changeStockPairs(tx:any,stockId:number,delta:number,userId:number,source:{type:string;id?:number;key?:string;notes?:string}){
 if(!Number.isSafeInteger(delta)||!delta)throw new TRPCError({code:'BAD_REQUEST',message:'الحركة تتطلب عدد أزواج صحيحًا غير صفري'});
 if(source.key){const [done]=await tx.select().from(finishedWarehouseMovements).where(eq(finishedWarehouseMovements.sourceKey,source.key)).limit(1);if(done)return {stockId,remainingPairs:undefined,idempotent:true};}
 const [stock]=await tx.select().from(finishedWarehouseStock).where(and(eq(finishedWarehouseStock.id,stockId),eq(finishedWarehouseStock.isActive,1))).limit(1).for('update');
 if(!stock)throw new TRPCError({code:'NOT_FOUND',message:'الصنف غير موجود في مستودع الإنتاج التام'});
 const before=stockPairCount(stock);const after=before+delta;
 if(after<0)throw new TRPCError({code:'BAD_REQUEST',message:`الرصيد غير كافٍ: المتاح ${before} زوجًا والمطلوب ${-delta} زوجًا`});
 integerPairs(after,'الرصيد الناتج');
 await tx.update(finishedWarehouseStock).set({totalPairs:after,quantityDozen:after/12,lastMovementAt:new Date()}).where(eq(finishedWarehouseStock.id,stockId));
 await tx.insert(finishedWarehouseMovements).values({stockId,movementType:delta>0?'receipt':'issue',quantityDozen:Math.abs(delta)/12,totalPairs:Math.abs(delta),sourceType:source.type,sourceId:source.id,sourceKey:source.key,notes:`${source.notes||''}${stock.totalPairs==null?` | تحويل افتتاحي موثق من ${stock.quantityDozen} درزن إلى ${before} زوجًا، دون تغيير الكمية`:''}`,userId,movementAt:new Date()});
 const minimumPairs=Number(stock.minimumDozen??50)*12;
 if(after<minimumPairs && (before>=minimumPairs || (before===0 && delta>0))){
  const active=await tx.select().from(users).where(eq(users.isActive,1));
  const recipients=active.filter((account:any)=>account.role==='admin'||['warehouse','storage','المستودعات','المخازن','المستودع','مرحلة التخزين'].includes(String(account.department||'').trim()));
  if(recipients.length)await tx.insert(alerts).values(recipients.map((account:any)=>({type:'quality_issue',severity:after===0?'critical':'warning',title:'تنبيه انخفاض مخزون الإنتاج التام',message:`${stock.productName} · ${stock.productSize||'—'} · ${stock.productColor||'—'}: الرصيد ${after} زوجًا (${Math.floor(after/12)} درزن و${after%12} زوج) دون الحد ${minimumPairs} زوجًا.`,userId:Number(account.id),data:{stockId,barcode:stock.barcode,remainingPairs:after,minimumPairs,sourceKey:source.key,route:'/finished-warehouse-inventory'}})));
 }
 return {stockId,remainingPairs:after,remainingDozen:after/12,idempotent:false};
}
export interface CustodyStockReceipt {custodyId:string;batchId:string;barcode:string;productName:string;productSize:string;productColor:string;productCode?:string;qualityGrade:'first'|'second';pairs:number;packagePairs:number;userId:number;}
export async function recordCustodyStockReceipt(tx:any,input:CustodyStockReceipt){
 integerPairs(input.pairs);integerPairs(input.packagePairs,'عدد الأزواج في العبوة');
 if(input.pairs<1||input.packagePairs<1||!input.barcode.trim()||input.barcode.length>64)throw new TRPCError({code:'BAD_REQUEST',message:'الباركود والكمية ومعامل العبوة الصحيح مطلوبة لاعتماد الإدخال النهائي'});
 if(!['first','second'].includes(input.qualityGrade))throw new TRPCError({code:'BAD_REQUEST',message:'التالف والعينات لا يدخلان مخزون البيع'});
 const sourceKey=`custodyV2:${input.custodyId}`;
 const [done]=await tx.select().from(finishedWarehouseMovements).where(eq(finishedWarehouseMovements.sourceKey,sourceKey)).limit(1);
 if(done)return {stockId:done.stockId,idempotent:true};
 const [stock]=await tx.select().from(finishedWarehouseStock).where(eq(finishedWarehouseStock.barcode,input.barcode.trim())).limit(1).for('update');
 let stockId:number;
 if(stock){
  if(stock.productName!==input.productName||String(stock.productSize||'')!==input.productSize||String(stock.productColor||'')!==input.productColor||stock.qualityGrade!==input.qualityGrade||(stock.productCode&&input.productCode&&stock.productCode!==input.productCode)||Number(stock.packagePairs||1)!==input.packagePairs)throw new TRPCError({code:'CONFLICT',message:'الباركود مرتبط بصنف أو مقاس أو لون أو نخب أو معامل عبوة مختلف. اختر باركودًا منفصلًا مطابقًا'});
  if(!stock.isActive)throw new TRPCError({code:'CONFLICT',message:'الباركود مرتبط برصيد معطل؛ فعّله بإجراء معتمد قبل التخزين'});
  stockId=stock.id;
 }else{
  const result=await tx.insert(finishedWarehouseStock).values({barcode:input.barcode.trim(),productName:input.productName,productSize:input.productSize,productColor:input.productColor,productCode:input.productCode,qualityGrade:input.qualityGrade,quantityDozen:0,totalPairs:0,packagePairs:input.packagePairs,createdBy:input.userId});stockId=Number(result[0].insertId);
 }
 return changeStockPairs(tx,stockId,input.pairs,input.userId,{type:'custody_v2',key:sourceKey,notes:`اعتماد إدخال نهائي | دفعة ${input.batchId} | عهدة ${input.custodyId} | ${input.pairs} زوجًا | نخب ${input.qualityGrade} | ${input.packagePairs} زوج/عبوة`});
}
