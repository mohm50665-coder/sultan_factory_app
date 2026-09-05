export type PerformanceRating = "excellent" | "very_good" | "good" | "acceptable" | "needs_improvement";

export function calculateAchievementPercentage(targetQuantity: number, achievedQuantity: number): number {
  const target = Number(targetQuantity);
  const achieved = Number(achievedQuantity);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(achieved) || achieved < 0) return 0;
  return Math.round((achieved / target) * 10000) / 100;
}

export function getPerformanceRating(percentage: number): PerformanceRating {
  if (percentage >= 100) return "excellent";
  if (percentage >= 90) return "very_good";
  if (percentage >= 75) return "good";
  if (percentage >= 60) return "acceptable";
  return "needs_improvement";
}

export function getPerformanceRatingLabel(rating: PerformanceRating, language: "ar" | "en" = "ar"): string {
  const labels = {
    excellent: { ar: "ممتاز", en: "Excellent" },
    very_good: { ar: "جيد جداً", en: "Very Good" },
    good: { ar: "جيد", en: "Good" },
    acceptable: { ar: "مقبول", en: "Acceptable" },
    needs_improvement: { ar: "يحتاج تحسين", en: "Needs Improvement" },
  } as const;
  return labels[rating][language];
}
