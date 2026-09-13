import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("Active receiver directory contract", () => {
  it("uses the server eligible-account source for production and stage receiver lists", () => {
    const router = read("server/routers.ts");
    const production = read("app/production.tsx");
    const stage = read("app/manufacturing-stage.tsx");

    expect(router).toContain("manufacturingWorkers: router");
    expect(router).toContain("eligible: protectedProcedure");
    expect(router).toContain("eq(usersTable.isActive, 1)");
    expect(router).toContain("STAGE_DEPARTMENT_ALIASES");
    expect(production).toContain('manufacturingWorkersService.eligible("rosso")');
    expect(stage).toContain("manufacturingWorkersService.eligible(stage)");
    expect(stage).toContain("manufacturingWorkersService.eligible(stageId)");
  });

  it("does not keep the removed static Qalb worker in active receiver UI sources", () => {
    const stage = read("app/manufacturing-stage.tsx");
    const manufacturing = read("app/manufacturing.tsx");

    expect(stage).not.toContain("حسين السوري");
    expect(manufacturing).not.toContain("حسين السوري");
    expect(manufacturing).not.toContain("Hussein Al-Suri");
  });
});
