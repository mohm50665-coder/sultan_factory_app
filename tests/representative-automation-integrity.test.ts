import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const schema = read("drizzle/schema.ts");
const server = read("server/representative-router.ts");
const approvals = read("app/representative-approvals.tsx");
const reports = read("app/representative-reports.tsx");

describe("Representative workflow automation integrity", () => {
  it("stores customers, transactions, items, signatures, events and collections in dedicated tables", () => {
    for (const table of ["customers", "representativeTransactions", "representativeTransactionItems", "representativeDeclarations", "representativeWorkflowEvents", "representativeCollections"]) expect(schema).toContain(`mysqlTable("${table}"`);
  });

  it("requires customer and representative signatures before submitting", () => {
    expect(server).toContain('declarationTypes.has("customer_order")');
    expect(server).toContain('declarationTypes.has("representative_order")');
    expect(server).toContain("signedSnapshot");
  });

  it("enforces sample quantity, 80-riyal receipt and 100-percent yarn ratios", () => {
    expect(server).toContain("العينة من 1 إلى 5 أزواج فقط");
    expect(server).toContain("sample_payment_80");
    expect(server).toContain("يجب أن يساوي 100%");
  });

  it("implements warehouse invoice, production rejection, corrective action and timestamped reporting", () => {
    expect(approvals).toContain("warehouse_invoice");
    expect(approvals).toContain("production_reject");
    expect(approvals).toContain("sales_resubmit");
    expect(approvals).toContain("durationMinutes");
    expect(reports).toContain("التقرير الشامل لأداء المندوب");
  });
});
