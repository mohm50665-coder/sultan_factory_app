import { describe, expect, it } from "vitest";

import { calculateAchievementPercentage, getPerformanceRating } from "../shared/performance";

describe("employee performance calculation", () => {
  it("calculates achievement from target and completed quantity", () => {
    expect(calculateAchievementPercentage(100, 82)).toBe(82);
    expect(calculateAchievementPercentage(80, 100)).toBe(125);
  });

  it("does not calculate invalid or zero targets", () => {
    expect(calculateAchievementPercentage(0, 10)).toBe(0);
    expect(calculateAchievementPercentage(100, -1)).toBe(0);
  });

  it("assigns deterministic ratings", () => {
    expect(getPerformanceRating(100)).toBe("excellent");
    expect(getPerformanceRating(93)).toBe("very_good");
    expect(getPerformanceRating(80)).toBe("good");
    expect(getPerformanceRating(65)).toBe("acceptable");
    expect(getPerformanceRating(40)).toBe("needs_improvement");
  });
});
