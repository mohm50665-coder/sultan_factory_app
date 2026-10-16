import {describe,expect,it,vi} from 'vitest';
vi.mock('react-native',()=>({Platform:{OS:'web'},Share:{share:vi.fn()}}));
vi.mock('../lib/services/api.service',()=>({productionService:{getAll:vi.fn()}}));
import {productionExportService, type ProductionRecord} from '../lib/services/production-export';
import {productionMetrics} from '../shared/operational-report';
const row:ProductionRecord={id:1,date:'2026-10-05',machineNumber:'RS3',productName:'TEST-PRODUCT',productionDozen:13,productionPairs:6,secondGradeDozen:0,secondGradePairs:2,yarnCotton:38,wasteThreadGrams:115,wasteNeedles:3,needlesUsed:4,productionHours:3,productionMinutes:5,shiftStart:'08:00',shiftEnd:'16:00'};
describe('production output shares source quantities',()=>{
 it('includes first and second grade, actual yarn grams, waste and needles in HTML and CSV',()=>{
  const html=productionExportService.generateHTML([row],'2026-10-05');
  const csv=productionExportService.generateCSV([row],'2026-10-05');
  for(const content of [html,csv])for(const label of ['النخب الأول','النخب الثاني','هدر الخيوط','الإبر المستخدمة','الإبر التالفة'])expect(content).toContain(label);
  expect(html).toContain('6156.00');expect(csv).toContain('6156.00');
  expect(html).toContain('3 ساعة و5 دقيقة');expect(html).toContain('1.87');
  expect(productionMetrics([row]).firstPairs).toBe(160);
 });
 it('does not print a product from outside the exact selected date, even if recently modified',()=>{
  const other={...row,id:2,date:'2026-10-06',productName:'OUTSIDE-RANGE',updatedAt:'2026-10-05'};
  expect(productionExportService.generateHTML([row,other],'2026-10-05')).not.toContain('OUTSIDE-RANGE');
  expect(productionExportService.generateCSV([row,other],'2026-10-05')).not.toContain('OUTSIDE-RANGE');
 });
 it('uses the authoritative issued yarn weight for new batches, including nonlegacy yarn names',()=>{
  expect(productionMetrics([{...row,yarnIssuedGrams:10000}]).yarnGrams).toBe(10000);
  expect(productionMetrics([{...row,yarnIssuedGrams:10000}]).wastePercent).toBeCloseTo(1.15,8);
 });
 it('escapes user product text and filters stopped machines by the same date',()=>{
  const html=productionExportService.generateHTML([{...row,productName:'<script>TEST</script>'}],'2026-10-05',[{equipmentName:'OLD-MACHINE',stopDate:'2026-10-01',stopReason:'OUTSIDE'},{equipmentName:'RS1',stopDate:'2026-10-05',stopReason:'مشكلة فنية'}]);
  expect(html).toContain('&lt;script&gt;TEST&lt;/script&gt;');expect(html).not.toContain('OLD-MACHINE');expect(html).toContain('مشكلة فنية');
 });
});
