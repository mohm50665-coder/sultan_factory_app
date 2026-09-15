import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const server = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("Administrative icon visibility", () => {
  it("loads a centralized hidden-by-default setting and filters the icon", () => {
    expect(dashboard).toContain('const administrativeIconSettingKey = "show_administrative_icon"');
    expect(dashboard).toContain("useState(false)");
    expect(dashboard).toContain('item.id === "administrative" && !showAdministrativeIcon');
  });

  it("exposes an admin-only show and hide control without deleting the screen", () => {
    expect(dashboard).toContain("toggleAdministrativeIcon");
    expect(dashboard).toContain('user?.role === "admin"');
    expect(dashboard).toContain("إظهار الإدارة");
    expect(dashboard).toContain("إخفاء الإدارة");
  });

  it("protects the global visibility setting on the server", () => {
    expect(server).toContain('input.key === "show_administrative_icon" && ctx.user.role !== "admin"');
    expect(server).toContain("تغيير ظهور الإجراءات الإدارية من صلاحية الأدمن فقط");
  });
});

