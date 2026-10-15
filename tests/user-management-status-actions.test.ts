import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/users-management.tsx"), "utf8");

describe("User management status actions", () => {
  it("offers filters for all, active, disabled, and pending accounts", () => {
    expect(source).toContain('"all" | "active" | "inactive" | "pending"');
    expect(source).toContain("كل الموظفين");
    expect(source).toContain("بانتظار التفعيل");
    expect(source).toContain('setStatusFilter("pending")');
  });

  it("shows explicit activation and deletion actions", () => {
    expect(source).toContain('"تفعيل"');
    expect(source).toContain('"تعطيل"');
    expect(source).toContain('"حذف"');
    expect(source).toContain("حذف نهائي");
    expect(source).toContain("لا يمكن التراجع عن هذا الإجراء");
  });
});

export {};
