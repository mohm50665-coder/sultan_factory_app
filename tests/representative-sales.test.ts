import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("representative sales module", () => {
  it("provides the sales icon and customer autofill entry point", () => {
    const performance = read("app/representative-performance.tsx");
    const screen = read("app/representative-sales.tsx");
    expect(performance).toContain('title: "المبيعات"');
    expect(performance).toContain('route: "/representative-sales"');
    expect(screen).toContain("representativeService.customers.list");
    expect(screen).toContain("setSelectedCustomer");
    expect(screen).toContain("customerName");
  });

  it("requires invoice number, amount, date, and preserves invoice attachments", () => {
    const screen = read("app/representative-sales.tsx");
    const router = read("server/representative-router.ts");
    const schema = read("drizzle/schema.ts");
    expect(screen).toContain("رقم الفاتورة *");
    expect(screen).toContain("المبلغ *");
    expect(screen).toContain("تاريخ الفاتورة *");
    expect(screen).toContain("AttachmentPicker");
    expect(router).toContain("sales: router({");
    expect(router).toContain("invoiceNumber: z.string().trim().min(1)");
    expect(router).toContain("amount: z.number().positive()");
    expect(router).toContain("attachments: z.array(attachmentSchema).default([])");
    expect(schema).toContain('mysqlTable("representativeSales"');
  });

  it("includes the new sales records in representative performance totals", () => {
    const router = read("server/representative-router.ts");
    expect(router).toContain("const allSales = await db.select().from(representativeSales)");
    expect(router).toContain("saleRows.reduce");
    expect(router).toContain("sales: saleRows.length");
  });
});
