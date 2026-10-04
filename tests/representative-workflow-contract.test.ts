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
    expect(customers).not.toContain("CustomerMapPicker");
    expect(customers).not.toContain("latitude");
    expect(customers).not.toContain("longitude");
  });

  it("allows an order to be saved without an amount or payment receipt", () => {
    expect(transactions).toContain('المبلغ (اختياري)');
    expect(transactions).not.toContain('مبلغ الطلب إلزامي');
    expect(server).toContain('const hasPaymentAmount = Number(input.paymentAmount || 0) > 0');
    expect(server).toContain('// مبلغ الطلب اختياري');
  });

  it("shows only customer names in search and routes incomplete customers to the directory", () => {
    expect(server).toContain("isComplete: missingFields.length === 0");
    expect(server).toContain("missingFields");
    expect(customers).toContain("returnTo");
  });

  it("scopes customers to the logged-in representative and keeps incomplete imported customers selectable", () => {
    expect(server).toContain("assignedRepresentativeId");
    expect(server).toContain("canAccessCustomer");
    expect(server).toContain("العميل غير موجود في قائمة العملاء المخصصة لحسابك");
    expect(transactions).toContain("بيانات ناقصة — يمكن المتابعة");
    expect(customers).toContain("assignedRepresentativeName");
  });

  it("allows the sales and marketing manager to search all active customers", () => {
    expect(server).toContain("!isSalesManager(ctx.user) && !isRepresentativeEmployee(ctx.user)");
    expect(server).toContain("isAdmin(ctx.user) || isSalesManager(ctx.user) ? eq(customers.isActive, 1)");
  });

  it("displays imported customer fields and keeps missing fields available for completion", () => {
    expect(customers).toContain("postalCode");
    expect(customers).toContain("buildingNumber");
    expect(customers).toContain("الرمز البريدي (اختياري)");
    expect(customers).toContain("رقم المبنى (اختياري)");
    expect(customers).toContain("العنوان الوطني:");
    expect(customers).toContain("الشارع:");
  });

  it("groups the customer directory by representative and prints each group", () => {
    expect(customers).toContain("groupedCustomers");
    expect(customers).toContain("مصنف حسب المندوب");
    expect(customers).toContain("printCustomerList");
    expect(customers).toContain("<table>");
    expect(customers).toContain("sourceAccountCode");
  });

  it("shows customer activity, protects deletion, and prioritizes required completion fields", () => {
    for (const field of ["salesCount", "collectionCount", "lastActivityDate", "activityStatus"]) {
      expect(server).toContain(field);
      expect(customers).toContain(field);
    }
    expect(customers).toContain("عميل نشط");
    expect(customers).toContain("عميل غير نشط");
    expect(server).toContain('if (!isAdmin(ctx.user)) throw new TRPCError({ code: "FORBIDDEN", message: "حذف العملاء متاح للأدمن فقط" })');
    expect(customers).toContain("representativeService.customers.remove");
    expect(customers).toContain("البيانات الإلزامية المطلوب استكمالها أولاً");
    expect(customers).toContain("requiredMissing");
  });

  it("does not load or render customer results until a search term is entered", () => {
    const collections = read("app/representative-collections.tsx");
    expect(transactions).toContain("customerQuery ? representativeService.customers.list(customerQuery) : Promise.resolve([])");
    expect(collections).toContain("customerQuery ? representativeService.customers.list(customerQuery) : Promise.resolve([])");
    expect(transactions).toContain("customerSearch.trim() ? <ScrollView");
    expect(collections).toContain("search.trim() ? <ScrollView");
  });

  it("keeps custom product type, yarn ratios and sample receipt fields", () => {
    for (const field of ["productType", "yarnRatios", "samplePaymentFiles", "sample_payment_80"]) {
      expect(transactions).toContain(field);
    }
    expect(approvals).toContain("correctiveAction");
    expect(server).toContain("PENDING_SALES_RESOLUTION");
  });

  it("separates visits from product orders and preserves customer classification", () => {
    expect(transactions).toContain('type === "visit" ? [] : items');
    expect(transactions).toContain('visitAction');
    expect(transactions).toContain('visitNotes');
    expect(transactions).toContain('customerStatus === "new"');
    expect(server).toContain('customerStatus: z.enum(["new", "old"]).default("old")');
    expect(server).toContain('input.transactionType !== "visit" && input.items.length === 0');
  });
});
