import { beforeEach, describe, expect, it, vi } from "vitest";

const storage: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((key) => delete storage[key]);
      return Promise.resolve();
    }),
  },
}));

describe("استعادة جلسة التقارير", () => {
  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
    vi.clearAllMocks();
  });

  it("يعيد إنشاء معرف الجلسة من ملف المستخدم النشط المحفوظ", async () => {
    const { getLocalSessionId, SESSION_STORAGE_KEY, USER_STORAGE_KEY } = await import("../lib/local-session");
    storage[USER_STORAGE_KEY] = JSON.stringify({ id: 27, isActive: 1, name: "موظف اختبار" });

    await expect(getLocalSessionId()).resolves.toBe("27");
    expect(storage[SESSION_STORAGE_KEY]).toBe("27");
  });

  it("لا يرسل معرف جلسة لحساب معطّل أو ملف مستخدم غير صالح", async () => {
    const { getLocalSessionId, USER_STORAGE_KEY } = await import("../lib/local-session");
    storage[USER_STORAGE_KEY] = JSON.stringify({ id: 27, isActive: 0 });
    await expect(getLocalSessionId()).resolves.toBeNull();

    storage[USER_STORAGE_KEY] = "not-json";
    await expect(getLocalSessionId()).resolves.toBeNull();
  });

  it("يحافظ على معرف الجلسة الصحيح الموجود ولا يستبدله", async () => {
    const { getLocalSessionId, SESSION_STORAGE_KEY, USER_STORAGE_KEY } = await import("../lib/local-session");
    storage[SESSION_STORAGE_KEY] = "14";
    storage[USER_STORAGE_KEY] = JSON.stringify({ id: 27, isActive: 1 });

    await expect(getLocalSessionId()).resolves.toBe("14");
    expect(storage[SESSION_STORAGE_KEY]).toBe("14");
  });
});
