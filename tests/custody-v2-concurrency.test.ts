import { describe, expect, it } from "vitest";
import { releaseCustodyWorkerSession, reserveCustodyWorkerSession } from "../server/custody-service";

type Lock = { userId: number; batchId: string; custodyId: string };

function lockTransaction() {
  const locks = new Map<number, Lock>();
  return {
    locks,
    insert: () => ({
      values: async (value: Lock) => {
        if (locks.has(value.userId)) {
          const error = new Error("Duplicate entry");
          (error as Error & { code?: string }).code = "ER_DUP_ENTRY";
          throw error;
        }
        locks.set(value.userId, value);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => Array.from(locks.values()),
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        locks.delete(9);
      },
    }),
  };
}

const actor = { id: 9, name: "عامل الاختبار", role: "user" } as const;

describe("Custody V2 worker-session concurrency", () => {
  it("allows one global manual session and releases it for another lot only after pause/complete", async () => {
    const tx = lockTransaction();
    await reserveCustodyWorkerSession(tx, actor, "batch-A", "lot-A");
    await expect(reserveCustodyWorkerSession(tx, actor, "batch-B", "lot-B"))
      .rejects.toMatchObject({ message: "لا يمكن بدء أو استئناف أكثر من جلسة عمل يدوية للعامل نفسه عبر العهد" });
    await releaseCustodyWorkerSession(tx, actor, "lot-A");
    await reserveCustodyWorkerSession(tx, actor, "batch-B", "lot-B");
    expect(tx.locks.get(actor.id)).toMatchObject({ batchId: "batch-B", custodyId: "lot-B" });
  });

  it("treats a retry on the same lot as an already-open session rather than opening a second session", async () => {
    const tx = lockTransaction();
    await reserveCustodyWorkerSession(tx, actor, "batch-A", "lot-A");
    await expect(reserveCustodyWorkerSession(tx, actor, "batch-A", "lot-A"))
      .rejects.toMatchObject({ message: "جلسة العمل هذه مفتوحة بالفعل" });
    expect(tx.locks.size).toBe(1);
  });
});
