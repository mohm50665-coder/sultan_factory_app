import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {productionMetrics} from '../shared/operational-report';
const source=readFileSync(resolve(process.cwd(),'app/board-monthly-report.tsx'),'utf8');
const comprehensive=readFileSync(resolve(process.cwd(),'app/daily-summary.tsx'),'utf8');
describe('board report waste formula',()=>{
 it('uses grams, including all extra pairs, rather than dividing grams by pairs',()=>{
  const m=productionMetrics([{productionDozen:13,productionPairs:6,yarnCotton:38,wasteThreadGrams:115}]);
  expect(m.totalPairs).toBe(162);expect(m.yarnGrams).toBe(6156);
  expect(m.wastePercent).toBeCloseTo(115/6156*100,8);
  expect(m.wastePercent).not.toBeCloseTo(115/162*100,2);
  expect(source).toContain('productionMetrics(');
 });
 it('weighs the period ratio and never substitutes zero for an absent denominator',()=>{
  const m=productionMetrics([{productionDozen:1,yarnCotton:10,wasteThreadGrams:6},{productionDozen:1,yarnCotton:30,wasteThreadGrams:6}]);
  expect(m.wastePercent).toBeCloseTo(12/480*100,8);
  expect(productionMetrics([{productionDozen:1,wasteThreadGrams:5}]).wastePercent).toBeNull();
  expect(source).not.toContain('totalWaste / totalProd');
 });
 it('separates zero yarn waste from positive sock waste, with a distinct total waste rate',()=>{
  const m=productionMetrics([
    {productionDozen:10,yarnIssuedGrams:1000,wasteThreadGrams:0,wasteSocksGrams:40},
    {productionPairs:10,yarnIssuedGrams:500,wasteThreadGrams:0,wasteSocksGrams:20},
  ]);
  expect(m.wasteThreadGrams).toBe(0);
  expect(m.wasteSocksGrams).toBe(60);
  expect(m.totalWasteGrams).toBe(60);
  expect(m.threadWastePercent).toBe(0);
  expect(m.wastePercent).toBeCloseTo(4,10);
 });
 it('returns zero rates only when yarn weight is recorded and all waste is truly zero',()=>{
  const m=productionMetrics([{productionPairs:12,yarnIssuedGrams:240,wasteThreadGrams:0,wasteSocksGrams:0}]);
  expect(m.threadWastePercent).toBe(0);
  expect(m.wastePercent).toBe(0);
  const noWeight=productionMetrics([{productionPairs:12,wasteThreadGrams:0,wasteSocksGrams:0}]);
  expect(noWeight.threadWastePercent).toBeNull();
  expect(noWeight.wastePercent).toBeNull();
 });
 it('keeps absent yarn weight explicitly unrecorded in both report views',()=>{
  expect(source).toContain('formatRecordedYarnGrams');
  expect(comprehensive).toContain('recordedYarnGrams');
  expect(comprehensive).toContain('"غير مسجل"');
 });
 it('uses clearly named, distinct yarn and total waste indicators in the board, comprehensive report, and printing',()=>{
  for(const page of [source,comprehensive]){
    expect(page).toContain('نسبة هدر الخيوط');
    expect(page).toContain('نسبة الهدر الإجمالي');
    expect(page).toContain('هدر الجوارب');
  }
  expect(source).toContain('threadWastePercentage');
  expect(source).toContain('totalWastePercentage');
  expect(comprehensive).toContain('threadWastePercentage');
  expect(comprehensive).toContain('recordedWasteGrams');
 });
});
