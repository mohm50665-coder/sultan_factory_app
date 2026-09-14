import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const representative = read("app/representative-performance.tsx");
const orders = read("app/orders-visits.tsx");
const custom = read("app/custom-manufacturing.tsx");
const dashboard = read("app/(tabs)/index.tsx");

describe("Representative workflow contract", () => {
  it("exposes the three representative modules from one official icon", () => {
    expect(dashboard).toContain('id: "representative_performance"');
    expect(representative).toContain('route: "/orders-visits"');
    expect(representative).toContain('route: "/custom-manufacturing"');
    expect(representative).toContain('route: "/collection"');
  });

  it("keeps order, payment, delivery and signature fields in the order record", () => {
    for (const field of ["deliveryDate", "paymentMethod", "paymentAmount", "paymentReceiptNumber", "creditDays", "customerSignature", "representativeSignature", "mapLocation"]) {
      expect(orders).toContain(field);
    }
  });

  it("keeps custom product type, yarn ratios and sample receipt fields", () => {
    for (const field of ["productType", "yarnRatios", "sampleQuantity", "transferReceiptAttachment", "rejectionReason", "resolutionAction"]) {
      expect(custom).toContain(field);
    }
  });
});
