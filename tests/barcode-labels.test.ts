import { describe, expect, it } from "vitest";
import { chooseLabelSize, code128Pattern, LABEL_SIZES, makeProductBarcode } from "../lib/barcode-labels";

describe("barcode labels", () => {
  it("provides the eleven requested sizes", () => {
    expect(LABEL_SIZES.map((size) => size.key)).toEqual([
      "25x15", "30x20", "40x25", "50x25", "50x30", "50x40", "60x40", "70x50", "100x50", "100x100", "100x150",
    ]);
  });

  it("selects a larger label as data density increases", () => {
    expect(chooseLabelSize("", "", "", "")).toBe("25x15");
    expect(chooseLabelSize("ECO", "أسود", "1", "قطعة")).toBe("50x25");
    expect(chooseLabelSize("منتج طويل جداً للاختبار مع مواصفات إضافية", "أزرق داكن", "100", "درزن")).toBe("60x40");
  });

  it("generates an S-prefixed product barcode and a Code128 pattern", () => {
    const barcode = makeProductBarcode("ECO", "أسود");
    expect(barcode).toMatch(/^S\d{9}$/);
    expect(code128Pattern(barcode)).toMatch(/^[01]+1110011101011$/);
    expect(code128Pattern(barcode).length).toBeGreaterThan(100);
  });
});
