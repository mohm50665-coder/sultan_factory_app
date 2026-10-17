import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    const apply = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(apply);
      } else if (value && typeof value === "object") {
        Object.assign(result, value);
      }
    };
    apply(style);
    return result;
  };

  return {
    Platform: { OS: "web" },
    StyleSheet: { flatten },
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    View: "View",
  };
});

vi.mock("@expo/vector-icons", () => ({ MaterialIcons: "MaterialIcons" }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));

import { flattenDateFieldStyle } from "../components/date-field";

describe("flattenDateFieldStyle", () => {
  it("flattens an array StyleProp before it can be assigned to a web CSSStyleDeclaration", () => {
    const style = [
      { color: "#172033", borderColor: "#cbd5e1" },
      false,
      [{ textAlign: "right" }, null],
    ];

    const flattened = flattenDateFieldStyle(style);

    expect(flattened).toEqual({
      color: "#172033",
      borderColor: "#cbd5e1",
      textAlign: "right",
    });
    expect(Object.keys(flattened)).not.toContain("0");
    expect(Object.keys(flattened)).not.toContain("1");

    const cssStyleDeclaration = new Proxy<Record<string, unknown>>({}, {
      set(target, property, value) {
        if (/^\d+$/.test(String(property))) {
          throw new TypeError("Indexed property setter is not supported.");
        }
        target[String(property)] = value;
        return true;
      },
    });

    expect(() => Object.assign(cssStyleDeclaration, flattened)).not.toThrow();
    expect(cssStyleDeclaration).toEqual(flattened);
  });
});
