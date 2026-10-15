import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { businessMilliseconds, buildCustodyReport, reportPrintHtml } from "../shared/custody-reporting";
import { createCustodyWorkbook } from "../server/custody-export";
import type { CustodyBatch, CustodySettings } from "../shared/custody-contract";

const mockCall=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/services/api.service",()=>({trpcCall:mockCall}));
const {custodyService}=await import("../lib/services/custody.service");
const settings:CustodySettings={enabled:true,stageLimits:{},shifts:[{name:"ليل",start:"22:00",end:"06:00",days:[0,1,2,3,4,5,6]}],holidays:[]};
const fixture=():CustodyBatch=>({id:"b",trackingNumber:"B",version:1,product:{code:"=1+1",name:"صنف",size:"M",color:"أبيض",antiSlip:false,yarns:[{name:"قطن",percentage:100}],yarnWeightGrams:1000,pairWeightGrams:10},purpose:"sale",productionDate:"2026-10-15",machineNumber:"M1",shift:"صباح",firstPairs:125,secondPairs:0,totalPairs:125,createdBy:1,createdByName:"موظف",responsibleUserId:1,createdAt:"2026-10-14T21:00:00Z",custodies:[{id:"l",batchId:"b",ownerId:1,ownerName:"موظف",stage:"production",quality:"first",pairs:125,status:"received",receivedAt:"2026-10-15T05:00:00Z",progressPairs:0}],transfers:[],sessions:[],progress:[],disposals:[],events:[]});

describe("Custody final integration contracts and real file formats",()=>{
 it("calls the actual accounts endpoint and rejects a malformed response instead of manufacturing an empty list",async()=>{
  mockCall.mockResolvedValueOnce([{id:1,name:"موظف",department:"production",role:"manager"}]);expect(await custodyService.accounts.list()).toHaveLength(1);expect(mockCall).toHaveBeenLastCalledWith("custodyV2.accounts",undefined,"query");
  mockCall.mockResolvedValueOnce({items:[]});await expect(custodyService.accounts.list()).rejects.toThrow("استجابة");
  const router=readFileSync("server/custody-router.ts","utf8");expect(router).toContain("accounts: protectedProcedure.query");
 });
 it("counts the previous day's overnight shift at the range start",()=>{
  expect(businessMilliseconds("2026-10-14T21:00:00Z","2026-10-14T23:00:00Z",settings).businessMs).toBe(2*3600000);
 });
 it("unions overlapping shifts rather than creating more hours than the interval",()=>{
  const overlapping={...settings,shifts:[{name:"أ",start:"08:00",end:"16:00",days:[4]},{name:"ب",start:"10:00",end:"18:00",days:[4]}]};
  expect(businessMilliseconds("2026-10-15T05:00:00Z","2026-10-15T15:00:00Z",overlapping).businessMs).toBe(10*3600000);
 });
 it("removes the holiday segment of an overnight shift",()=>{
  expect(businessMilliseconds("2026-10-14T19:00:00Z","2026-10-15T03:00:00Z",{...settings,holidays:["2026-10-15"]}).businessMs).toBe(2*3600000);
 });
 it("does not infer delivery time from work completion and does not count samples as sale production",()=>{
  const batch=fixture();batch.custodies[0].completedAt="2026-10-15T06:00:00Z";const report=buildCustodyReport({batches:[batch],accounts:[],settings,filters:{startDate:"2026-10-15",endDate:"2026-10-15"}});const complete=report.events.find(e=>e.action==="complete");expect(complete?.timing?.custodyDuration.calendarMs).toBeNull();
  const sample={...batch,id:"sample",purpose:"sample" as const};expect(buildCustodyReport({batches:[batch,sample],accounts:[],filters:{startDate:"2026-10-15",endDate:"2026-10-15"}}).originalProductionPairs).toBe(125);
 });
 it("keeps past-period open liability even if its stock approval happened later",()=>{
  const batch=fixture();batch.custodies[0]={...batch.custodies[0],stage:"storage",status:"stored"};batch.events=[{id:"stock",batchId:batch.id,custodyId:"l",actorId:1,actorName:"موظف",stage:"storage",action:"stock_stored",pairs:125,at:"2026-10-16T06:00:00Z"}];
  const before=buildCustodyReport({batches:[batch],accounts:[],filters:{startDate:"2026-10-15",endDate:"2026-10-15"}});expect(before.departments[0].employees[0].balance.endingLiabilityPairs).toBe(125);expect(before.warehouseFinalStockPairs).toBe(0);
  const after=buildCustodyReport({batches:[batch],accounts:[],filters:{startDate:"2026-10-16",endDate:"2026-10-16"}});expect(after.departments[0].employees[0].balance.endingLiabilityPairs).toBe(0);expect(after.warehouseFinalStockPairs).toBe(125);
 });
 it("produces a genuine RTL XLSX with numbers, grouped people and matching report counts",async()=>{
  const report=buildCustodyReport({batches:[fixture()],accounts:[],filters:{startDate:"2026-10-15",endDate:"2026-10-15"}});const buffer=await createCustodyWorkbook(report);expect(buffer.subarray(0,2).toString()).toBe("PK");const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Uint8Array.from(buffer).buffer);expect(workbook.worksheets).toHaveLength(2);expect(workbook.worksheets[0].views[0].rightToLeft).toBe(true);expect(workbook.worksheets[0].getCell("C4").value).toBe(125);expect(reportPrintHtml(report)).toContain("الموظف: موظف");
 });
});
