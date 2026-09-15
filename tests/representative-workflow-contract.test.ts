import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const representative = read("app/representative-performance.tsx");
const transactions = read("app/representative-transactions.tsx");
const customers = read("app/representative-customers.tsx");
const approvals = read("app/representative-approvals.tsx");
const server = read("server/representative-router.ts");
const dashboard = read("app/(tabs)/index.tsx");

describe("Representative workflow contract", () => {
  it("exposes the five operational modules from one official icon", () => {
    expect(dashboard).toContain('id: "representative_performance"');
    expect(representative).toContain('route: "/representative-customers"');
    expect(representative).toContain('pathname: "/representative-transactions"');
    expect(representative).toContain('route: "/representative-collections"');
    expect(representative).toContain('route: "/representative-approvals"');
  });

  it("keeps order, payment, delivery and signature fields in the order record", () => {
    for (const field of ["deliveryDate", "paymentMethod", "paymentAmount", "receiptNumber", "creditDays", "customerSignature", "representativeSignature"]) {
      expect(transactions).toContain(field);
    }
    expect(customers).toContain("CustomerMapPicker");
  });

  it("keeps custom product type, yarn ratios and sample receipt fields", () => {
    for (const field of ["productType", "yarnRatios", "samplePaymentFiles", "sample_payment_80"]) {
      expect(transactions).toContain(field);
    }
    expect(approvals).toContain("correctiveAction");
    expect(server).toContain("PENDING_SALES_RESOLUTION");
  });
});
