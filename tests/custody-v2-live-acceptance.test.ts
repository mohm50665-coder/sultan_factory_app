import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { createCustodyBatch, actOnCustody, listCustodyBatches } from "../server/custody-service";
import { users, finishedWarehouseStock, finishedWarehouseMovements } from "../drizzle/schema";
import { custodySampleOrders } from "../drizzle/custody-samples-schema";
import { createIntakePayload, transitionSampleOrder } from "../server/custody-samples";
import { buildCustodyReport } from "../shared/custody-reporting";
import type { CustodyBatch, CustodyStage, CustodyActionInput, CustodyProduct } from "../shared/custody-contract";

// Explicit opt-in: all synthetic records are created inside one rollback-only transaction.
const live = process.env.CUSTODY_LIVE_TEST === "1";
(live ? describe : describe.skip)("Custody V2 — live MySQL rollback-only acceptance", () => {
  it("executes the actual service with exact pairs and leaves no synthetic factory data", async () => {
    const db: any = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const marker = `__CUSTODY_TEST_${randomUUID().slice(0,8)}`;
    const checks: Array<{name:string;status:string}> = [];
    const check = (name:string) => { checks.push({name,status:"passed"});console.log(`قبول: ${name}`); };
    const rollback = new Error("EXPECTED_ACCEPTANCE_ROLLBACK");
    let executionError: unknown; let rolledBack = false;
    const before = await db.execute(sql`SELECT COUNT(*) AS n FROM custodyBatches`);
    try {
      await db.transaction(async (tx:any) => {
        const accounts: Record<string, any> = {};
        for (const stage of ["production","rosso","qalb","antislip","kawiya","inspection","packing","storage","followup","customer_service","admin"]) {
          const role = stage === "admin" ? "admin" : ["production","followup"].includes(stage) ? "manager" : "user";
          const insert = await tx.insert(users).values({openId:randomUUID(),username:`${marker}_${stage}`,name:`${marker} ${stage}`,department:stage,role,isActive:1,email:`${marker}_${stage}@example.invalid`,password:"disabled-test-only",phone:"0000000000",position:"اختبار قبول",loginMethod:"test"});
          accounts[stage]={id:Number(insert[0].insertId),name:`${marker} ${stage}`,department:stage,role};
        }
        const actor=accounts.production;
        const product: CustodyProduct = {code:marker,name:marker,size:"M",color:"WHITE",antiSlip:false,yarns:[{name:"قطن",percentage:80},{name:"نايلون",percentage:20}],yarnWeightGrams:5000,pairWeightGrams:40};
        const fetchBatch=async(id:string):Promise<CustodyBatch> => (await listCustodyBatches(tx,accounts.admin,{batchId:id}))[0];
        const act=async(a:any,batchId:string,input:Omit<CustodyActionInput,"operationKey"|"batchId">) => actOnCustody(tx,a,{...input,batchId,operationKey:randomUUID()});
        const create=async(pairs:number,antiSlip=false,sampleRequestId?:number) => {
          const result=await createCustodyBatch(tx,actor,{operationKey:randomUUID(),product:{...product,antiSlip},productionDate:"2026-10-15",machineNumber:"TEST-1",shift:"وردية قبول",purpose:sampleRequestId?"sample":"sale",firstPairs:pairs,secondPairs:0,responsibleUserId:actor.id,sampleRequestId,wasteThreadGrams:1.25,wasteSocksGrams:0});
          return fetchBatch(result.batchId);
        };
        const finish=async(a:any,id:string,lotId:string) => {
          let b=await fetchBatch(id);const l=b.custodies.find(l=>l.id===lotId)!;
          await act(a,id,{action:"start",custodyId:lotId});
          await act(a,id,{action:"progress",custodyId:lotId,pairs:l.pairs});
          await act(a,id,{action:"complete",custodyId:lotId});
        };
        const transfer=async(b:CustodyBatch,source:any,lotId:string,to:CustodyStage,quality="first",pairs?:number) => {
          const lot=b.custodies.find(l=>l.id===lotId)!;
          await act(source,b.id,{action:"send",custodyId:lotId,pairs:lot.pairs,allocations:[{toStage:to,toUserId:accounts[to].id,quality:quality as any,pairs:pairs??lot.pairs}]});
          b=await fetchBatch(b.id);const t=b.transfers.at(-1)!;
          expect(b.custodies.find(l=>l.id===lotId)?.status).toBe("sent");
          await act(accounts[to],b.id,{action:"receive",transferId:t.id,actualPairs:t.pairs});
          b=await fetchBatch(b.id);expect(b.transfers.find(x=>x.id===t.id)?.status).toBe("confirmed");
          return {b,lot:b.custodies.at(-1)!};
        };
        let b=await create(125);let lot=b.custodies[0];
        await expect(act(actor,b.id,{action:"send",custodyId:lot.id,allocations:[{toStage:"rosso",toUserId:accounts.rosso.id,quality:"first",pairs:125}]})).rejects.toThrow(/إكمال/);
        check("منع التسليم قبل إكمال كامل العمل");
        await finish(actor,b.id,lot.id);
        for(const n of [124,126]) await expect(act(actor,b.id,{action:"send",custodyId:lot.id,pairs:n,allocations:[{toStage:"rosso",toUserId:accounts.rosso.id,quality:"first",pairs:n}]})).rejects.toThrow();
        check("رفض نقص وزيادة الكمية دون إنشاء حركة");
        await expect(act(actor,b.id,{action:"send",custodyId:lot.id,allocations:[{toStage:"rosso",toUserId:actor.id,quality:"first",pairs:125}]})).rejects.toThrow(/نفسه/);
        check("منع التسليم للحساب نفسه");
        let step=await transfer(await fetchBatch(b.id),actor,lot.id,"rosso");b=step.b;lot=step.lot;
        const newBatch=await create(120);await finish(actor,newBatch.id,newBatch.custodies[0].id);
        const second=await transfer(await fetchBatch(newBatch.id),actor,newBatch.custodies[0].id,"rosso");
        expect((await fetchBatch(b.id)).custodies.filter(l=>l.ownerId===accounts.rosso.id)).toHaveLength(1);
        await act(accounts.rosso,b.id,{action:"start",custodyId:lot.id});
        await expect(act(accounts.rosso,second.b.id,{action:"start",custodyId:second.lot.id})).rejects.toThrow(/جلسة عمل/);
        await act(accounts.rosso,b.id,{action:"pause",custodyId:lot.id,reason:"فحص وقت التوقف"});
        await act(accounts.rosso,second.b.id,{action:"start",custodyId:second.lot.id});
        await act(accounts.rosso,second.b.id,{action:"progress",custodyId:second.lot.id,pairs:120});
        await act(accounts.rosso,second.b.id,{action:"complete",custodyId:second.lot.id});
        await act(accounts.rosso,b.id,{action:"resume",custodyId:lot.id});
        await act(accounts.rosso,b.id,{action:"progress",custodyId:lot.id,pairs:125});
        await act(accounts.rosso,b.id,{action:"complete",custodyId:lot.id});
        check("استلام عدة عهد مع منع ازدواج جلسة العمل اليدوي وتسجيل توقف واستئناف");
        step=await transfer(await fetchBatch(b.id),accounts.rosso,lot.id,"qalb");b=step.b;lot=step.lot;
        for(const [source,to] of [["qalb","kawiya"],["kawiya","inspection"],["inspection","packing"],["packing","storage"]] as const){
          await finish(accounts[source],b.id,lot.id);step=await transfer(await fetchBatch(b.id),accounts[source],lot.id,to);b=step.b;lot=step.lot;
        }
        check("مسار البيع بدون مانع انزلاق حتى استلام المخازن");
        const barcode=`TEST-${randomUUID()}`;
        expect(await tx.select().from(finishedWarehouseStock).where(eq(finishedWarehouseStock.barcode,barcode))).toHaveLength(0);
        const command:CustodyActionInput={operationKey:randomUUID(),batchId:b.id,custodyId:lot.id,action:"store",barcode,packagePairs:12,pairs:125};
        await actOnCustody(tx,accounts.storage,command);await actOnCustody(tx,accounts.storage,command);
        const stocks=await tx.select().from(finishedWarehouseStock).where(eq(finishedWarehouseStock.barcode,barcode));
        expect(stocks).toHaveLength(1);expect(stocks[0].totalPairs).toBe(125);
        const moves=await tx.select().from(finishedWarehouseMovements).where(eq(finishedWarehouseMovements.sourceKey,`custodyV2:${lot.id}`));expect(moves).toHaveLength(1);expect(moves[0].totalPairs).toBe(125);
        await expect(actOnCustody(tx,accounts.storage,{...command,packagePairs:1})).rejects.toThrow(/مفتاح/);
        await expect(actOnCustody(tx,accounts.storage,{...command,operationKey:randomUUID()})).rejects.toThrow();
        check("125 زوجًا محفوظة كاملة — لا وارد عند الاستلام ووارد واحد عند الاعتماد مع منع التكرار");
        b=await create(120,true);lot=b.custodies[0];
        for(const [source,to] of [["production","rosso"],["rosso","qalb"],["qalb","antislip"]] as const){await finish(accounts[source],b.id,lot.id);step=await transfer(await fetchBatch(b.id),accounts[source],lot.id,to);b=step.b;lot=step.lot;}
        await finish(accounts.antislip,b.id,lot.id);
        const allocate=(pairs:number)=>[{toStage:"kawiya" as const,toUserId:accounts.kawiya.id,quality:"first" as const,pairs},{toStage:"inspection" as const,toUserId:accounts.inspection.id,quality:"suspected" as const,pairs:5}];
        await expect(act(accounts.antislip,b.id,{action:"send",custodyId:lot.id,allocations:allocate(114),reason:"اختبار",defectType:"اشتباه"})).rejects.toThrow();
        const bad=allocate(115);bad[1].toUserId=actor.id;
        await expect(act(accounts.antislip,b.id,{action:"send",custodyId:lot.id,allocations:bad,reason:"اختبار",defectType:"اشتباه"})).rejects.toThrow();
        expect((await fetchBatch(b.id)).transfers.filter(t=>t.sourceCustodyId===lot.id)).toHaveLength(0);
        await act(accounts.antislip,b.id,{action:"send",custodyId:lot.id,allocations:allocate(115),reason:"اشتباه موثق",defectType:"خلل طبقة مانع الانزلاق"});
        b=await fetchBatch(b.id);const branches=b.transfers.filter(t=>t.sourceCustodyId===lot.id);expect(branches.map(t=>t.pairs).reduce((a,n)=>a+n,0)).toBe(120);
        for(const t of branches) await act(accounts[t.toStage],b.id,{action:"receive",transferId:t.id,actualPairs:t.pairs});
        b=await fetchBatch(b.id);const suspect=b.custodies.find(l=>l.stage==="inspection" && l.quality==="suspected")!;
        await finish(accounts.inspection,b.id,suspect.id);
        await expect(act(accounts.inspection,b.id,{action:"send",custodyId:suspect.id,allocations:[{toStage:"packing",toUserId:accounts.packing.id,quality:"first",pairs:5}],reason:"لا يسمح"})).rejects.toThrow(/ثاني/);
        await act(accounts.inspection,b.id,{action:"send",custodyId:suspect.id,allocations:[{toStage:"packing",toUserId:accounts.packing.id,quality:"second",pairs:5}],reason:"صالح كنخب ثانٍ"});
        check("مسار مانع الانزلاق وتوزيع 115 + 5 ذري — مشتبه التلف لا يعتمد نخبًا أول");
        b=second.b;lot=second.lot;
        for(const [source,to] of [["rosso","qalb"],["qalb","kawiya"],["kawiya","inspection"]] as const){if(source!=="rosso")await finish(accounts[source],b.id,lot.id);step=await transfer(await fetchBatch(b.id),accounts[source],lot.id,to);b=step.b;lot=step.lot;}
        await finish(accounts.inspection,b.id,lot.id);
        await act(accounts.inspection,b.id,{action:"send",custodyId:lot.id,reason:"قرار فحص",defectType:"تمزق",allocations:[{toStage:"packing",toUserId:accounts.packing.id,quality:"first",pairs:110},{toStage:"packing",toUserId:accounts.packing.id,quality:"second",pairs:8},{toStage:"followup",toUserId:accounts.followup.id,quality:"damaged",pairs:2}]});
        b=await fetchBatch(b.id);const damaged=b.transfers.find(t=>t.toStage==="followup")!;
        await act(accounts.followup,b.id,{action:"receive",transferId:damaged.id,actualPairs:2});b=await fetchBatch(b.id);lot=b.custodies.at(-1)!;
        await expect(act(accounts.followup,b.id,{action:"execute_disposal",custodyId:lot.id,reason:"إتلاف",method:"إتلاف موثق",attachments:[{url:"test-evidence"}]})).rejects.toThrow(/اعتماد/);
        await expect(act(actor,b.id,{action:"approve_disposal",custodyId:lot.id,reason:"غير مخول"})).rejects.toThrow();
        await act(accounts.followup,b.id,{action:"approve_disposal",custodyId:lot.id,reason:"اعتماد إتلاف غير قابل للاستفادة"});
        await act(accounts.followup,b.id,{action:"execute_disposal",custodyId:lot.id,reason:"تم التنفيذ",method:"إتلاف موثق",attachments:[{url:"test-evidence"}]});
        expect((await fetchBatch(b.id)).disposals[0].status).toBe("executed");
        check("توزيع الفحص 110 + 8 + 2 — التالف لا يتلف قبل الاستلام والاعتماد والتنفيذ المثبت");
        for(const slip of [false,true]) {
          const op=randomUUID();const prod={...product,antiSlip:slip};
          let payload=createIntakePayload({operationKey:op,clientName:marker,requirements:"اختبار عينة",requestedPairs:3,actor:accounts.customer_service});
          let order:any={id:0,referenceCode:marker+slip,requesterId:accounts.customer_service.id,payload,status:"intake",batchId:null,version:1};
          order={...order,...transitionSampleOrder(order,{kind:"set_specs",operationKey:randomUUID(),product:prod,actor}),version:2};
          order={...order,...transitionSampleOrder(order,{kind:"order",operationKey:randomUUID(),actor:accounts.customer_service}),version:3};
          const insert=await tx.insert(custodySampleOrders).values({referenceCode:marker+slip,requesterId:accounts.customer_service.id,payload:order.payload,status:order.status,version:3});const sampleId=Number(insert[0].insertId);
          b=await create(3,slip,sampleId);lot=b.custodies[0];
          await finish(actor,b.id,lot.id);step=await transfer(await fetchBatch(b.id),actor,lot.id,slip?"antislip":"customer_service");b=step.b;lot=step.lot;
          if(slip){await finish(accounts.antislip,b.id,lot.id);step=await transfer(await fetchBatch(b.id),accounts.antislip,lot.id,"customer_service");b=step.b;lot=step.lot;}
          expect(b.sampleStatus).toBe("ready_for_customer");
          await expect(act(accounts.customer_service,b.id,{action:"deliver_sample",custodyId:lot.id,receiver:"عميل",method:"رابط"})).rejects.toThrow(/إثبات/);
          await act(accounts.customer_service,b.id,{action:"deliver_sample",custodyId:lot.id,receiver:"مستلم اختبار",method:"يدوي",proof:"إيصال اختبار"});
          expect((await fetchBatch(b.id)).sampleStatus).toBe("delivered");
        }
        check("مسارا العينة مع وبدون مانع انزلاق — إغلاقها بإثبات فقط دون مخزون بيع");
        const batches=await listCustodyBatches(tx,accounts.admin,{});
        const report=buildCustodyReport({batches,accounts:Object.values(accounts),filters:{startDate:"2026-01-01",endDate:"2027-12-31"}});
        expect(report.warehouseFinalStockPairs).toBe(125);expect(report.disposal.executedPairs).toBe(2);
        check("التقرير يقرأ الوارد النهائي والإتلاف الفعلي دون جمع انتقالات المراحل كإنتاج جديد");
        throw rollback;
      });
    } catch(error) { if(error===rollback)rolledBack=true;else executionError=error; }
    const after=await db.execute(sql`SELECT COUNT(*) AS n FROM custodyBatches`);
    const leftovers=await db.select().from(users).where(sql`${users.username} LIKE ${marker+"%"}`);
    expect(leftovers).toHaveLength(0);
    mkdirSync("reports",{recursive:true});writeFileSync("reports/custody-live-acceptance.json",JSON.stringify({at:new Date().toISOString(),database:"MySQL/TiDB actual service",checks,rolledBack,leftoverTestAccounts:leftovers.length,batchCountBefore:before[0][0].n,batchCountAfter:after[0][0].n,error:executionError instanceof Error?executionError.message:executionError?String(executionError):null},null,2)+"\n");
    if(executionError)throw executionError;expect(rolledBack).toBe(true);
  }, 600000);
});
