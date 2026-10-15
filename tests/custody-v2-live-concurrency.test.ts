import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "../server/db";
import { custodyWorkerLocks } from "../drizzle/custody-schema";
import { reserveCustodyWorkerSession } from "../server/custody-service";
import { mkdirSync, writeFileSync } from "node:fs";

const run=process.env.CUSTODY_LIVE_TEST==="1"?describe:describe.skip;
run("actual MySQL concurrent worker lock",()=>{
 let db:any;
 afterAll(async()=>{if(db?.$client?.end)await db.$client.end();});
 it("allows only one concurrent worker session and cleans its isolated test marker",async()=>{
  db=await getDb();if(!db)throw new Error("قاعدة البيانات غير متاحة");
  // Real employee IDs are positive AUTO_INCREMENT; the isolated negative ID cannot be a real account.
  const actor={id:-1_000_000_000-Math.floor(Math.random()*100_000_000),name:"__CUSTODY_CONCURRENCY_TEST__",username:"__test__",role:"worker",department:"production"};
  const batchId=randomUUID(),oneId=randomUUID(),twoId=randomUUID();
  let ready!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>ready=resolve);const unblock=new Promise<void>(resolve=>release=resolve);
  let first:Promise<unknown>|undefined,second:Promise<unknown>|undefined;
  let results:PromiseSettledResult<unknown>[]=[];let remaining=0;
  try {
   first=db.transaction(async(tx:any)=>{await reserveCustodyWorkerSession(tx,actor,batchId,oneId);ready();await unblock;return "first";});
   await entered;
   second=db.transaction(async(tx:any)=>{await reserveCustodyWorkerSession(tx,actor,batchId,twoId);return "second";});
   // Both requests are live concurrently; first now commits and unique userId rejects the second.
   release();results=await Promise.allSettled([first!,second!]);
   expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
   const failure=results.find(result=>result.status==="rejected") as PromiseRejectedResult;
   expect(failure.reason.message).toContain("لا يمكن بدء");
  } finally {
   release?.();if(first||second)await Promise.allSettled([first,second].filter(Boolean) as Promise<unknown>[]);
   await db.delete(custodyWorkerLocks).where(and(eq(custodyWorkerLocks.userId,actor.id),eq(custodyWorkerLocks.batchId,batchId)));
   remaining=(await db.select().from(custodyWorkerLocks).where(eq(custodyWorkerLocks.userId,actor.id))).length;
   mkdirSync("reports",{recursive:true});writeFileSync("reports/custody-live-concurrency.json",JSON.stringify({at:new Date().toISOString(),database:"actual MySQL/TiDB",fulfilled:results.filter(result=>result.status==="fulfilled").length,rejected:results.filter(result=>result.status==="rejected").length,remainingTestMarkers:remaining,noRealAccountsTouched:true},null,2)+"\n");
  }
  expect(remaining).toBe(0);
 },60000);
});
