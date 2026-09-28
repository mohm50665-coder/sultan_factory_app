import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAX_REPRESENTATIVE_ITEMS,
  canAddRepresentativeItem,
  getCustomerAttachmentType,
  hasRequiredCustomerAttachments,
} from "../lib/services/representative-form.utils";

const transactionsScreen = readFileSync(resolve(process.cwd(), "app/representative-transactions.tsx"), "utf8");

describe("Representative transaction form", () => {
  it("allows up to ten products and blocks the eleventh", () => {
    expect(MAX_REPRESENTATIVE_ITEMS).toBe(10);
    expect(canAddRepresentativeItem(9)).toBe(true);
    expect(canAddRepresentativeItem(10)).toBe(false);
    expect(canAddRepresentativeItem(11)).toBe(false);
  });

  it("classifies the required customer attachments", () => {
    expect(getCustomerAttachmentType("السجل التجاري.pdf")).toBe("commercial_register");
    expect(getCustomerAttachmentType("national-address.png")).toBe("national_address");
    expect(getCustomerAttachmentType("other.pdf")).toBe("customer_document");
  });

  it("requires both the commercial register and national address", () => {
    expect(hasRequiredCustomerAttachments(["commercial_register"])).toBe(false);
    expect(hasRequiredCustomerAttachments(["national_address"])).toBe(false);
    expect(hasRequiredCustomerAttachments(["commercial_register", "national_address"])).toBe(true);
  });

  it("matches the attached order-products table layout", () => {
    expect(transactionsScreen).toContain('type === "order" ?');
    expect(transactionsScreen).toContain(">م</Text>");
    expect(transactionsScreen).toContain(">اسم المنتج</Text>");
    expect(transactionsScreen).toContain(">اللون</Text>");
    expect(transactionsScreen).toContain(">المقاس</Text>");
    expect(transactionsScreen).toContain(">درزن</Text>");
    expect(transactionsScreen).toContain(">زوج</Text>");
    expect(transactionsScreen).toContain("orderProductHeaderRow");
    expect(transactionsScreen).toContain("orderQuantityHeader");
  });
});
