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

describe("Maintenance machine inventory and multi-selection", () => {
  it("includes the approved production, facilities, air-conditioning, IT, and printing inventory", () => {
    expect(MAINTENANCE_MACHINE_INVENTORY.length).toBeGreaterThanOrEqual(75);
    for (const code of ["RS.01", "RB.09", "KN-010", "CLS-03", "MK-01", "CMP-01", "AC-20", "PC-09", "PRN-06"]) {
      expect(findMaintenanceMachine(code), `missing ${code}`).toBeTruthy();
    }
  });

  it("keeps the inventory reference code, name, and location visible", () => {
    const machine = findMaintenanceMachine("RS.01");
    expect(machine).toBeTruthy();
    expect(maintenanceMachineLabel(machine!, "ar")).toContain("RS.01");
    expect(maintenanceMachineLabel(machine!, "ar")).toContain("الإنتاج");
    expect(maintenanceMachineLabel(machine!, "en")).toContain("RS.01");
    expect(maintenanceMachineLabel(machine!, "en")).toContain("Production");
  });

  it("uses the shared searchable multi-selector in periodic and stopped-device reports and persists selected items", () => {
    const source = read("app/maintenance-section.tsx");
    expect(source).toContain("MaintenanceMachineSelector");
    expect(source).toContain("selectedMachines");
    expect(source).toContain("machineItems: selectedMachines");
    expect(source).toContain("serializeMaintenanceMachines(selectedMachines, \"ar\")");
    expect(source).toContain("اختر ماكينة أو أكثر من قائمة الحصر المعتمدة قبل الحفظ");
  });

  it("shows a bounded searchable list and supports removing any selected machine", () => {
    const source = read("components/maintenance-machine-selector.tsx");
    expect(source).toContain("maxHeight: 250");
    expect(source).toContain("accessibilityRole=\"checkbox\"");
    expect(source).toContain("onChange(value.filter((selected) => selected.code !== item.code))");
    expect(source).toContain("إزالة الكل");
  });
});
