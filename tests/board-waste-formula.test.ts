import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';
import {productionMetrics} from '../shared/operational-report';
const source=readFileSync(resolve(process.cwd(),'app/board-monthly-report.tsx'),'utf8');
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
 it('shows yarn waste quantity and both clearly named waste rates in the summary and export',()=>{
  expect(source).toContain('هدر الخيوط — جرام');expect(source).toContain('نسبة هدر الخيوط');expect(source).toContain('نسبة الهدر');
 });
});
