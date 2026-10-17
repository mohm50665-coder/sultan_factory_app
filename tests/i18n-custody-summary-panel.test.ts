import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  resolve(process.cwd(), "components/custody-summary-panel.tsx"),
  "utf8",
);

describe("CustodySummaryPanel i18n", () => {
  it("uses the shared language context and runtime direction helpers", () => {
    expect(panel).toContain(
      'import { useLanguage } from "@/lib/language-context"',
    );
    expect(panel).toContain("const { language } = useLanguage();");
    expect(panel).toContain("isEnglish");
    expect(panel).toContain("textAlignFor");
    expect(panel).toContain("writingDirection");
    expect(panel).toContain("localize");
  });

  it("defines English copy for the principal fixed interface text", () => {
    [
      "Receipt and handover — new connected cycle",
      "Details, print and Excel",
      "Production for these batches is retained in the production data above",
      "Confirmed receipt",
      "Stage totals — same figures as the full report",
      "Opening balance + confirmed inbound",
      "This source could not be loaded: ",
      "There are no movements in the new cycle for this period.",
      "Invalid quantity",
    ].forEach((englishText) => expect(panel).toContain(englishText));

    expect(panel).toContain(
      "? custodyStageEnglish[stage.stage] || stage.stage",
    );
    expect(panel).toContain(
      'const rowDirection = english ? "row" : "row-reverse"',
    );
    expect(panel).toContain(
      "const textStyle = { textAlign, writingDirection: direction }",
    );
  });

  it("does not render principal fixed Arabic labels directly in the English branch", () => {
    expect(panel).not.toContain(
      "<Text style={styles.title}>\n          الاستلام والتسليم",
    );
    expect(panel).not.toContain(
      "<Text style={styles.buttonText}>التفاصيل والطباعة وExcel</Text>",
    );
    expect(panel).not.toContain(
      "<Text style={styles.sectionTitle}>\n            إجماليات المراحل",
    );
  });
});
