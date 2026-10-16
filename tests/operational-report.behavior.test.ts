import { describe,it,expect } from 'vitest';
import { businessDate,commercialReport,exactPairs,inReportPeriod,pairLabel,productionMetrics,reportDate,warehousePeriod,visitText,transactionStatusLabel } from '../shared/operational-report';
describe('Unified operational report accounting',()=>{
 it('invoices alone count as sales; visits and orders retain independent details',()=>{
  const input={sales:[{id:1,invoiceDate:'2026-10-05',amount:'150.75'},{id:1,invoiceDate:'2026-10-05',amount:'150.75'}],legacySales:[{id:1,date:'2026-10-05',amount:25}],collections:[{id:2,collectionDate:'2026-10-05',collectedAmount:'80'}],legacyCollections:[{id:1,date:'2026-10-05',amount:20}],transactions:[{id:1,transactionType:'order',orderDate:'2026-10-05',paymentAmount:99999,items:[{quantity:3,quantityUnit:'dozen'}]},{id:2,transactionType:'visit',orderDate:'2026-10-05',paymentAmount:500}],startDate:'2026-10-05',endDate:'2026-10-05'};
  const report=commercialReport(input);expect(report.salesAmount).toBe(175.75);expect(report.collectionAmount).toBe(100);expect(report.salesRows).toHaveLength(2);expect(report.orderRows).toHaveLength(1);expect(report.visitRows).toHaveLength(1);expect(exactPairs(report.orderRows[0].items[0],'item')).toBe(36);
 });
 it('uses each domain date and never includes an old operation merely updated within range',()=>{
  const row={orderDate:'2026-10-04',invoiceDate:'2026-10-05',collectionDate:'2026-10-06',deliveryDate:'2026-10-15',createdAt:'2026-10-07',updatedAt:'2026-10-15'};
  expect(businessDate(row,'transaction')).toBe('2026-10-04');expect(businessDate(row,'sale')).toBe('2026-10-05');expect(businessDate(row,'collection')).toBe('2026-10-06');expect(inReportPeriod(row,'transaction','2026-10-15','2026-10-15')).toBe(false);
 });
 it('handles Riyadh midnight correctly but preserves date-only SQL business values',()=>{
  expect(reportDate('2026-10-04T22:30:00Z')).toBe('2026-10-05');expect(reportDate(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05');expect(reportDate('2026-10-04 22:30:00')).toBe('2026-10-04');expect(reportDate('05/10/2026')).toBe('2026-10-05');expect(reportDate('2026-02-30')).toBe('');
 });
 it('excludes missing/invalid business date instead of substituting an updated or due date',()=>{
  expect(inReportPeriod({orderDate:'bad',createdAt:'2026-10-05'},'transaction','2026-10-05','2026-10-05')).toBe(false);expect(inReportPeriod({deliveryDate:'2026-10-05'},'transaction','2026-10-05','2026-10-05')).toBe(false);expect(inReportPeriod({date:'2026-10-05'},'general','2026-10-06','2026-10-04')).toBe(true);
 });
 it('preserves units and zero extra-pairs for items, stocks and second grade',()=>{
  expect(exactPairs({quantity:3,quantityUnit:'dozen'},'item')).toBe(36);expect(exactPairs({quantity:38,quantityUnit:'pair'},'item')).toBe(38);expect(exactPairs({quantityDozen:3,quantityPair:0,quantity:999},'item')).toBe(36);expect(exactPairs({totalPairs:125,quantityDozen:10},'stock')).toBe(125);expect(exactPairs({quantityDozen:10.416667},'stock')).toBe(125);expect(exactPairs({secondGradeDozen:2,secondGradePairs:3},'second')).toBe(27);expect(pairLabel(38)).toContain('2 زوج');expect(exactPairs({quantityDozen:0.2},'stock')).toBeNaN();
 });
 it('normalizes dozens and preserves decimal grams in the weighted waste ratio',()=>{
  const result=productionMetrics([{productionDozen:13,productionPairs:6,secondGradeDozen:1,secondGradePairs:2,yarnCotton:37.96,wasteThreadGrams:115,wasteSocksGrams:0,needlesUsed:12,wasteNeedles:1}]);
  expect(result.totalPairs).toBe(162);expect(result.firstPairs).toBe(148);expect(result.secondPairs).toBe(14);expect(result.yarnGrams).toBeCloseTo(6149.52);expect(result.wastePercent).toBeCloseTo(1.8700659563);expect(result.wastePercent).toBeLessThan(2);expect(result.needlesUsed).toBe(12);
 });
 it('does not return a fictitious zero percentage with missing denominator',()=>{expect(productionMetrics([{productionDozen:1,wasteThreadGrams:3}]).wastePercent).toBeNull();});
 it('does not clamp contradictory grades and flags a source discrepancy',()=>{const m=productionMetrics([{productionPairs:5,secondGradePairs:6}]);expect(m.firstPairs).toBe(-1);expect(m.invalidQuantityCount).toBe(1);});
 it('reconstructs period balances and does not count storage custody again',()=>{
  const ledger=[{id:1,stockId:1,movementType:'receipt',totalPairs:125,createdAt:'2026-10-05T10:00:00Z',sourceKey:'custodyV2:1'},{id:1,stockId:1,movementType:'receipt',totalPairs:125,createdAt:'2026-10-05T10:00:00Z',sourceKey:'custodyV2:1'},{id:2,stockId:1,movementType:'issue',totalPairs:36,createdAt:'2026-10-06T10:00:00Z'}];
  const m=warehousePeriod({movements:ledger,stock:[{totalPairs:89}],startDate:'2026-10-05',endDate:'2026-10-05'});expect(m.movements).toHaveLength(1);expect(m.receiptPairs).toBe(125);expect(m.openingPairs).toBe(0);expect(m.closingPairs).toBe(125);expect(m.currentPairs).toBe(89);
 });
 it('keeps uncertain stock adjustments unknown, never silently fixes the ledger',()=>{const m=warehousePeriod({movements:[{id:1,movementType:'adjustment',quantityDozen:3,createdAt:'2026-10-05'}],stock:[{totalPairs:100}],startDate:'2026-10-05',endDate:'2026-10-05'});expect(m.closingPairs).toBeNull();expect(m.invalidQuantityCount).toBe(1);});
 it('prints information-only visits and human-readable notes',()=>{expect(transactionStatusLabel('PENDING_SALES_APPROVAL','visit')).toContain('معلومات فقط');expect(visitText('{"action":"follow_up","notes":"زيارة العميل"}')).toBe('متابعة — زيارة العميل');});
});
