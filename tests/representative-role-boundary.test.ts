import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "server/representative-router.ts"), "utf8");

describe("Representative role boundary", () => {
  it("excludes managers and supervisors from representative identity", () => {
    expect(source).toContain("const isRepresentativeEmployee");
    expect(source).toContain('["admin", "manager", "supervisor"].includes(role)');
    expect(source).toContain('position.includes("مدير")');
  });

  it("builds performance results from actual representative employees only", () => {
    expect(source).toContain("activeUsers.filter((candidate) => isRepresentativeEmployee(candidate)");
    expect(source).not.toContain("activeUsers.filter((candidate) => matchesDepartment(candidate.department, SALES_NAMES)");
  });
});

