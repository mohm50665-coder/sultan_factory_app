import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findMaintenanceMachine,
  MAINTENANCE_MACHINE_INVENTORY,
  maintenanceMachineLabel,
} from "../lib/constants/maintenance-machine-inventory";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Maintenance equipment name list", () => {
  it("includes the names of the approved production machines, utilities, air conditioners, computers, and printers", () => {
    expect(MAINTENANCE_MACHINE_INVENTORY.length).toBeGreaterThanOrEqual(40);
    for (const legacyReference of ["RS.01", "RB.09", "KN-010", "CLS-03", "MK-01", "CMP-01", "AC-20", "PC-09", "PRN-06"]) {
      expect(findMaintenanceMachine(legacyReference), `missing ${legacyReference}`).toBeTruthy();
    }
  });

  it("uses the equipment name only as the visible and printed maintenance value", () => {
    const machine = findMaintenanceMachine("RS.01");
    expect(machine).toBeTruthy();
    expect(maintenanceMachineLabel(machine!, "ar")).toBe("ماكينة حياكة RC-U7FN-1");
    expect(maintenanceMachineLabel(machine!, "en")).toBe("RC-U7FN-1 knitting machine");
    expect(maintenanceMachineLabel(machine!, "ar")).not.toContain("RS.01");
    expect(maintenanceMachineLabel(machine!, "ar")).not.toContain("الإنتاج");
  });

  it("uses the shared searchable multi-selector in periodic and stopped-device reports and persists selected names", () => {
    const source = read("app/maintenance-section.tsx");
    expect(source).toContain("MaintenanceMachineSelector");
    expect(source).toContain("selectedMachines");
    expect(source).toContain("machineItems: selectedMachines");
    expect(source).toContain("serializeMaintenanceMachines(selectedMachines, \"ar\")");
    expect(source).toContain("اختر ماكينة أو أكثر من قائمة الحصر المعتمدة قبل الحفظ");
  });

  it("shows a bounded, numbered name-only list and supports removing any selected machine", () => {
    const source = read("components/maintenance-machine-selector.tsx");
    expect(source).toContain("sequence: index + 1");
    expect(source).toContain("{sequence}. {maintenanceMachineLabel(option, language)}");
    expect(source).toContain("اكتب اسم الآلة أو الجهاز");
    expect(source).not.toContain("option.code} ·");
    expect(source).not.toContain("option.locationAr");
    expect(source).toContain("maxHeight: 250");
    expect(source).toContain("accessibilityRole=\"checkbox\"");
    expect(source).toContain("onChange(value.filter((selected) => selected.code !== item.code))");
  });
});
