import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/custody-batch-entry.tsx"), "utf8");

describe("custody production batch input", () => {
  it("uses selection lists for registered machines and shifts", () => {
    expect(source).toContain('const MACHINE_OPTIONS = ["RB1"');
    expect(source).toContain('DEFAULT_SHIFT_OPTIONS');
    expect(source).toContain('SelectField label={l("الماكينة", "Machine")}');
    expect(source).toContain('SelectField label={l("الوردية", "Shift")}');
  });

  it("builds the item code from name, size and color and makes it read-only", () => {
    expect(source).toContain('const automaticItemCode');
    expect(source).toContain('automaticItemCode(name, size, color)');
    expect(source).toContain('رمز الصنف (يظهر تلقائيًا)');
    expect(source).toContain('editable={false}');
  });

  it("uses calendar and clock pickers for the complete operating window", () => {
    expect(source).toContain('productionEndDate');
    expect(source).toContain('TimeField label={l("وقت بدء العمل", "Work start time")}');
    expect(source).toContain('TimeField label={l("وقت انتهاء العمل", "Work end time")}');
    expect(source).toContain('productionEndDate,');
    expect(source).toContain('workStartTime,');
    expect(source).toContain('workEndTime,');
  });
});
