import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const dashboard = read("app/(tabs)/index.tsx");
const usersManagement = read("app/users-management.tsx");
const toolsPermissions = read("app/admin-tools-permissions.tsx");
const comprehensivePanel = read("app/comprehensive-admin-panel.tsx");
const router = read("server/routers.ts");

describe("Permission boundary contract", () => {
  it("uses explicitly saved dashboard sections without role or department fallback", () => {
    expect(dashboard).toContain("hasExplicitAllowedSections");
    expect(dashboard).toContain("return hasExplicitAllowedSections && explicitAllowedSections.has(item.id);");
    expect(dashboard).not.toContain("baseEmployeeItems");
    expect(usersManagement).toContain("ترك جميع الخيارات دون تحديد يعني عدم منح أي قائمة");
  });

  it("treats extra tools as opt-in and never defaults missing permissions to true", () => {
    expect(toolsPermissions).toContain("setUserPermissions(userData.toolPermissions && typeof userData.toolPermissions === \"object\" ? userData.toolPermissions : {});");
    expect(toolsPermissions).toContain("onPress: () => setUserPermissions({})");
    expect(toolsPermissions).not.toContain("defaultPermissions[tool.id] = true");
    expect(comprehensivePanel).toContain("setUserPermissions({});");
    expect(comprehensivePanel).not.toContain("defaults[t.id] = true");
    expect(dashboard).toContain("canRenderExtraTool");
    expect(dashboard).toContain("userToolPermissions[toolId] === true");
  });

  it("protects permission reads and writes on the server and normalizes stored values", () => {
    expect(router).toContain("const normalizeAllowedSections");
    expect(router).toContain("const normalizeToolPermissions");
    expect(router).toContain("getAllUsers: adminProcedure");
    expect(router).toContain("updateToolPermissions: adminProcedure");
    expect(router).toContain("updateAllowedSections: adminProcedure");
    expect(router).toContain("toolPermissions: normalizeToolPermissions(input.toolPermissions)");
    expect(router).toContain("allowedSections: normalizeAllowedSections(input.allowedSections)");
  });

  it("keeps sensitive tools in the dedicated tools-permissions picker and official features in user sections", () => {
    expect(toolsPermissions).not.toContain("id: 'employee_performance'");
    expect(toolsPermissions).toContain("id: 'sample_requests'");
    expect(toolsPermissions).toContain("id: 'mail_center'");
    expect(usersManagement).toContain("Open extra tools permissions");
    expect(usersManagement).toContain('id: "employee_performance"');
  });
});
