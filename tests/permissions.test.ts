import { describe, it, expect } from "vitest";

// Helper function to check tool permissions
const canAccessTool = (
  toolId: string,
  userPermissions: Record<string, boolean> | undefined
): boolean => {
  if (!userPermissions) return false;
  return userPermissions[toolId] === true;
};

describe("Tool Permissions System", () => {
  it("should return false when user has no permissions", () => {
    const result = canAccessTool("reports", undefined);
    expect(result).toBe(false);
  });

  it("should return false when tool permission is not granted", () => {
    const permissions = { reports: false, notifications_center: true };
    const result = canAccessTool("reports", permissions);
    expect(result).toBe(false);
  });

  it("should return true when tool permission is granted", () => {
    const permissions = { reports: true, notifications_center: false };
    const result = canAccessTool("reports", permissions);
    expect(result).toBe(true);
  });

  it("should handle multiple tools correctly", () => {
    const permissions = {
      reports: true,
      notifications_center: true,
      export_data: false,
      activity_log: true,
      production_export: false,
      waste_alerts: true,
      reports_analytics: true,
      section_reports: false,
      users_management: true,
      employee_performance: false,
      backup_restore: true,
      machines_comparison: true,
      share_reports: false,
    };

    expect(canAccessTool("reports", permissions)).toBe(true);
    expect(canAccessTool("notifications_center", permissions)).toBe(true);
    expect(canAccessTool("export_data", permissions)).toBe(false);
    expect(canAccessTool("activity_log", permissions)).toBe(true);
    expect(canAccessTool("production_export", permissions)).toBe(false);
    expect(canAccessTool("waste_alerts", permissions)).toBe(true);
    expect(canAccessTool("reports_analytics", permissions)).toBe(true);
    expect(canAccessTool("section_reports", permissions)).toBe(false);
    expect(canAccessTool("users_management", permissions)).toBe(true);
    expect(canAccessTool("employee_performance", permissions)).toBe(false);
    expect(canAccessTool("backup_restore", permissions)).toBe(true);
    expect(canAccessTool("machines_comparison", permissions)).toBe(true);
    expect(canAccessTool("share_reports", permissions)).toBe(false);
  });

  it("should return false for non-existent tool", () => {
    const permissions = { reports: true };
    const result = canAccessTool("non_existent_tool", permissions);
    expect(result).toBe(false);
  });

  it("should return false when permissions object is empty", () => {
    const permissions = {};
    const result = canAccessTool("reports", permissions);
    expect(result).toBe(false);
  });
});
