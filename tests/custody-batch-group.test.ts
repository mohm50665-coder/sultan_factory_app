import { describe, expect, it } from "vitest";
import { custodyBatches, custodyEvents, custodyOperations } from "../drizzle/custody-schema";
import { production, users } from "../drizzle/schema";
import { custodyBatchGroupInputSchema, custodyRouter } from "../server/custody-router";
import {
  createCustodyBatchGroup,
  deriveCustodyBatchGroupOperationKey,
} from "../server/custody-service";
import type { CustodyBatchGroupInput, CustodyProduct } from "../shared/custody-contract";

const actor = { id: 7, name: "مدير الإنتاج", department: "production", role: "manager" } as const;
const product: CustodyProduct = {
  code: "SOCK-42-BLK",
  name: "جورب رياضي",
  size: "42",
  color: "أسود",
  antiSlip: false,
  yarns: [{ name: "قطن", percentage: 80 }, { name: "نايلون", percentage: 20 }],
  yarnWeightGrams: 30,
  pairWeightGrams: 40,
};

function group(overrides: Partial<CustodyBatchGroupInput> = {}): CustodyBatchGroupInput {
  return {
    operationKey: "group-operation-key-0001",
    productionDate: "2026-10-15",
    productionEndDate: "2026-10-15",
    workStartTime: "08:00",
    workEndTime: "16:00",
    machineNumber: "RB1",
    shift: "morning",
    manufacturingOrder: "MO-42",
    responsibleUserId: actor.id,
    purpose: "sale",
    products: [
      { product, firstPairs: 24, secondPairs: 0 },
      { product: { ...product, code: "SOCK-40-WHT", size: "40", color: "أبيض" }, firstPairs: 12, secondPairs: 2 },
    ],
    ...overrides,
  };
}

type PersistedState = {
  batches: any[];
  events: any[];
  operations: any[];
  productions: any[];
};

/**
 * Minimal transactional Drizzle double for the creation path. transaction() clones
 * state and commits only after the callback resolves, making rollback observable.
 */
function custodyGroupDb() {
  const state: PersistedState = { batches: [], events: [], operations: [], productions: [] };
  let transactionCount = 0;

  const scope = (draft: PersistedState): any => ({
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === users ? [{ ...actor, isActive: 1 }] : [],
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: any) => {
        if (table === production) {
          draft.productions.push(values);
          return [{ insertId: draft.productions.length }];
        }
        const target = table === custodyBatches
          ? draft.batches
          : table === custodyEvents
            ? draft.events
            : table === custodyOperations
              ? draft.operations
              : undefined;
        if (!target) throw new Error("unexpected custody group write");
        target.push(...(Array.isArray(values) ? values : [values]));
        return [];
      },
    }),
  });

  return {
    state,
    get transactionCount() { return transactionCount; },
    ...scope(state),
    transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
      transactionCount += 1;
      const draft = structuredClone(state);
      const result = await callback(scope(draft));
      state.batches.splice(0, state.batches.length, ...draft.batches);
      state.events.splice(0, state.events.length, ...draft.events);
      state.operations.splice(0, state.operations.length, ...draft.operations);
      state.productions.splice(0, state.productions.length, ...draft.productions);
      return result;
    },
  };
}

describe("custodyV2.createBatchGroup", () => {
  it("registers the protected group route and enforces max five plus the one-product sample boundary", () => {
    expect((custodyRouter as any)._def.procedures.createBatchGroup).toBeDefined();
    expect(custodyBatchGroupInputSchema.safeParse(group()).success).toBe(true);
    expect(custodyBatchGroupInputSchema.safeParse(group({ products: Array.from({ length: 6 }, () => group().products[0]) })).success).toBe(false);
    expect(custodyBatchGroupInputSchema.safeParse(group({
      purpose: "sample",
      products: [
        { ...group().products[0], sampleRequestId: 123 },
        group().products[1],
      ],
    })).success).toBe(false);
  });

  it("creates separate batches/custodies with shared production data in one transaction and server-derived unique keys", async () => {
    const db = custodyGroupDb();
    const input = group();
    const result = await createCustodyBatchGroup(db, actor, input);

    expect(db.transactionCount).toBe(1);
    expect(result.batchIds).toHaveLength(2);
    expect(new Set(result.batchIds).size).toBe(2);
    expect(db.state.batches).toHaveLength(2);
    expect(db.state.productions).toHaveLength(2);
    expect(db.state.batches.map((row: any) => row.payload.custodies.every((custody: any) => custody.stage === "production"))).toEqual([true, true]);
    expect(db.state.batches.map((row: any) => row.payload.machineNumber)).toEqual(["RB1", "RB1"]);
    expect(db.state.batches.map((row: any) => row.payload.manufacturingOrder)).toEqual(["MO-42", "MO-42"]);

    const derivedKeys = db.state.operations
      .map((operation: any) => operation.operationKey)
      .filter((operationKey: string) => operationKey !== input.operationKey);
    expect(derivedKeys).toEqual([
      deriveCustodyBatchGroupOperationKey(input.operationKey, 0),
      deriveCustodyBatchGroupOperationKey(input.operationKey, 1),
    ]);
    expect(new Set(derivedKeys).size).toBe(2);
  });

  it("rolls back the entire group when a later product is invalid", async () => {
    const db = custodyGroupDb();
    await expect(createCustodyBatchGroup(db, actor, group({
      products: [group().products[0], { ...group().products[1], firstPairs: 0, secondPairs: 0 }],
    }))).rejects.toThrow(/إجمالي الدفعة/);

    expect(db.transactionCount).toBe(1);
    expect(db.state).toEqual({ batches: [], events: [], operations: [], productions: [] });
  });
});
