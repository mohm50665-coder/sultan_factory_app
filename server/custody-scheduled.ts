import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { custodySettings as settingsTable } from "../drizzle/custody-schema";
import { scanCustodyDelays } from "./custody-service";

/** Platform callback. The signed cron task ID is the sole authority; request body is ignored. */
export async function custodyDelayHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    let actor;
    try { actor = await sdk.authenticateRequest(req); } catch { return res.status(403).json({ error: "cron-only" }); }
    if (!actor.isCron || !actor.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = actor.taskUid;
    const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة");
    const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.scheduleCronTaskUid, taskUid)).limit(1);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const alerts = await scanCustodyDelays(db, taskUid);
    return res.json({ ok: true, emitted: alerts.length });
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error("[custody scheduled]", failure);
    return res.status(500).json({ error: failure.message, stack: failure.stack, context: { url: req.originalUrl, taskUid }, timestamp: new Date().toISOString() });
  }
}
