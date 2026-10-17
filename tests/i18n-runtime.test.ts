import { describe, expect, it } from "vitest";
import {
  custodyQualityEnglish,
  custodyStageEnglish,
  custodyStatusEnglish,
  departmentEnglish,
  displayData,
  englishDataDisplay,
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "../lib/i18n/runtime";

describe("runtime localization helpers", () => {
  it("switches fixed interface copy without falling back to Arabic", () => {
    expect(localize("en", "دفعة إنتاج جديدة", "New production batch")).toBe("New production batch");
    expect(localize("ar", "دفعة إنتاج جديدة", "New production batch")).toBe("دفعة إنتاج جديدة");
    expect(isEnglish("en")).toBe(true);
    expect(isEnglish("ar")).toBe(false);
  });

  it("uses the matching reading direction and alignment", () => {
    expect(writingDirection("en")).toBe("ltr");
    expect(textAlignFor("en")).toBe("left");
    expect(writingDirection("ar")).toBe("rtl");
    expect(textAlignFor("ar")).toBe("right");
  });

  it("translates stable custody codes while preserving user-entered names", () => {
    expect(custodyStageEnglish.storage).toBe("Storage & Finished Goods");
    expect(custodyStatusEnglish.stored).toBe("Stored in finished goods");
    expect(custodyQualityEnglish.second).toBe("Second grade");
    expect(departmentEnglish.customer_service).toBe("Customer Service");
  });

  it("renders legacy Arabic data in English mode without changing its source value", () => {
    const sourceName = "أحمد علي";
    expect(englishDataDisplay("أبيض")).toBe("White");
    expect(displayData("en", "خدمة العملاء")).toBe("Customer Service");
    expect(displayData("en", sourceName)).not.toMatch(/[\u0600-\u06ff]/);
    expect(displayData("ar", sourceName)).toBe(sourceName);
    expect(sourceName).toBe("أحمد علي");
  });
});
