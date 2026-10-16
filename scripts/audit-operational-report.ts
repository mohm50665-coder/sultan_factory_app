import { writeFile } from 'node:fs/promises';
import { getDb } from '../server/db';
import { production,representativeSales,representativeCollections,representativeTransactions,sales,collection,finishedWarehouseStock,finishedWarehouseMovements } from '../drizzle/schema';
import { businessDate,commercialReport,inReportPeriod,productionMetrics,warehousePeriod,reportRows } from '../shared/operational-report';
async function main(){
 const db=await getDb();if(!db)throw new Error('قاعدة البيانات غير متاحة');
 const [prod,inv,col,tx,oldSale,oldCol,stocks,movements]=await Promise.all([db.select().from(production),db.select().from(representativeSales),db.select().from(representativeCollections),db.select().from(representativeTransactions),db.select().from(sales),db.select().from(collection),db.select().from(finishedWarehouseStock),db.select().from(finishedWarehouseMovements)]);
 const range=(rows:any[],kind:any)=>{const dates=rows.map(row=>businessDate(row,kind)).filter(Boolean).sort();return {count:rows.length,first:dates[0]||null,last:dates.at(-1)||null,missing:rows.length-dates.length};};
 const result:any={readOnly:true,generatedAt:new Date().toISOString(),sources:{production:range(prod,'production'),invoices:range(inv,'sale'),collections:range(col,'collection'),transactions:range(tx,'transaction'),movements:range(movements,'movement'),legacyInvoices:range(oldSale,'sale'),legacyCollections:range(oldCol,'collection')},periods:[]};
 for(const [startDate,endDate] of [['2026-10-05','2026-10-05'],['2026-10-14','2026-10-14'],['2026-10-15','2026-10-15'],['2026-10-01','2026-10-31']]){
  const commercial=commercialReport({sales:inv,legacySales:oldSale,collections:col,legacyCollections:oldCol,transactions:tx,startDate,endDate});
  const warehouse=warehousePeriod({movements,stock:stocks,startDate,endDate});
  const production=productionMetrics(prod.filter(row=>inReportPeriod(row,'production',startDate,endDate)));
  result.periods.push({startDate,endDate,production,salesAmount:commercial.salesAmount,salesCount:commercial.salesRows.length,collectionAmount:commercial.collectionAmount,collectionCount:commercial.collectionRows.length,orders:commercial.orderRows.length,visits:commercial.visitRows.length,warehouse:{...warehouse,movements:warehouse.movements.length}});
 }
 await writeFile('reports/operational-live-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
