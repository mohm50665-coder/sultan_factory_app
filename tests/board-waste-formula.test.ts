import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/board-monthly-report.tsx"), "utf8");

describe("board report waste formula", () => {
  it("calculates yarn weight from per-pair yarn fields and production pairs", () => {
    expect(source).toContain("let totalDozen = 0, totalPairs = 0, totalYarnWeight = 0");
    expect(source).toContain("const productionPairs = (parseFloat(item.productionDozen || \"0\") * 12) + parseFloat(item.productionPairs || \"0\")");
    expect(source).toContain("totalYarnWeight += yarnWeightPerPair * productionPairs");
  });

  it("divides waste grams by yarn grams, never by pair count", () => {
    expect(source).toContain("const wastePercentage = totalYarnWeight > 0 ? (totalWaste / totalYarnWeight) * 100 : 0");
    expect(source).not.toContain("const wastePercentage = totalProd > 0 ? (totalWaste / totalProd) * 100 : 0");
    expect(source).toContain("yarnWeight: totalYarnWeight");
  });
});
