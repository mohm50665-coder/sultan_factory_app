import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const screen = readFileSync(resolve(process.cwd(), "app/production-export.tsx"), "utf8");
const service = readFileSync(resolve(process.cwd(), "lib/services/production-export.ts"), "utf8");

describe("Machine production comprehensive report", () => {
  it("loads stopped machines for the selected date and passes them to printing", () => {
    expect(screen).toContain("maintenanceService.getStopped()");
    expect(screen).toContain("stoppedMachines");
    expect(screen).toContain("generateHTML(records, date, stoppedMachines)");
  });

  it("prints working status, reason, start/end times, and work duration", () => {
    expect(service).toContain("تعمل");
    expect(service).toContain("لا تعمل");
    expect(service).toContain("وقت البدء");
    expect(service).toContain("وقت الانتهاء");
    expect(service).toContain("وقت العمل");
    expect(service).toContain("سبب عدم التشغيل");
    expect(service).toContain("formatWorkDuration");
  });
});
