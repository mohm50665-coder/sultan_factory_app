import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("Global date picker contract", () => {
  it("uses the shared native/web date picker instead of a text input", () => {
    const shared = read("components/date-field.tsx");
    expect(shared).toContain("@react-native-community/datetimepicker");
    expect(shared).toContain('mode="date"');
    expect(shared).not.toContain("placeholder=\"YYYY-MM-DD\"");
  });

  it("keeps all known operational date fields on DateField", () => {
    const files = [
      "app/production.tsx",
      "app/production-export.tsx",
      "app/production-totals.tsx",
      "app/production-requests.tsx",
      "app/manufacturing-stage.tsx",
      "app/custom-manufacturing.tsx",
      "app/orders-visits.tsx",
      "app/collection.tsx",
      "app/representative-collections.tsx",
      "app/representative-transactions.tsx",
      "app/representative-reports.tsx",
      "app/maintenance-section.tsx",
      "app/board-representative.tsx",
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain("DateField");
      expect(source, file).not.toContain("placeholder=\"YYYY-MM-DD\"");
    }
  });
});
