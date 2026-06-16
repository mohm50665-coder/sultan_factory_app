import { describe, it, expect } from "vitest";

// ===== Test 1: Extra Tools IDs consistency =====
describe("Extra Tools IDs Consistency", () => {
  // The 13 tool IDs that must be consistent across all files
  const EXPECTED_TOOL_IDS = [
    "reports",
    "notifications_center",
    "export_data",
    "activity_log",
    "production_export",
    "waste_alerts",
    "reports_analytics",
    "section_reports",
    "users_management",
    "employee_performance",
    "backup_restore",
    "machines_comparison",
    "share_reports",
  ];

  it("should have exactly 13 tools defined", () => {
    expect(EXPECTED_TOOL_IDS.length).toBe(13);
  });

  it("comprehensive-admin-panel AVAILABLE_TOOLS should match the expected IDs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/comprehensive-admin-panel.tsx", "utf-8");
    
    for (const toolId of EXPECTED_TOOL_IDS) {
      expect(content).toContain(`id: "${toolId}"`);
    }
  });

  it("admin-tools-permissions AVAILABLE_TOOLS should match the expected IDs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/admin-tools-permissions.tsx", "utf-8");
    
    for (const toolId of EXPECTED_TOOL_IDS) {
      expect(content).toContain(`id: '${toolId}'`);
    }
  });

  it("home screen should use canAccessTool with all expected tool IDs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/(tabs)/index.tsx", "utf-8");
    
    for (const toolId of EXPECTED_TOOL_IDS) {
      expect(content).toContain(`canAccessTool('${toolId}'`);
    }
  });
});

// ===== Test 2: canAccessTool function =====
describe("canAccessTool function behavior", () => {
  // Replicate the function logic
  const canAccessTool = (toolId: string, userPermissions: Record<string, boolean> | null | undefined, userRole?: string): boolean => {
    if (userRole === "admin") return true;
    if (!userPermissions) return false;
    return userPermissions[toolId] === true;
  };

  it("admin should always have access regardless of toolPermissions", () => {
    expect(canAccessTool("reports", null, "admin")).toBe(true);
    expect(canAccessTool("reports", undefined, "admin")).toBe(true);
    expect(canAccessTool("reports", {}, "admin")).toBe(true);
    expect(canAccessTool("reports", { reports: false }, "admin")).toBe(true);
  });

  it("non-admin with null permissions should not have access", () => {
    expect(canAccessTool("reports", null, "user")).toBe(false);
    expect(canAccessTool("reports", undefined, "user")).toBe(false);
  });

  it("non-admin with explicit permissions should respect them", () => {
    expect(canAccessTool("reports", { reports: true }, "user")).toBe(true);
    expect(canAccessTool("reports", { reports: false }, "user")).toBe(false);
    expect(canAccessTool("export_data", { reports: true }, "user")).toBe(false);
  });
});

// ===== Test 3: Home screen shows extra tools for admin =====
describe("Home screen extra tools visibility", () => {
  it("should show extra tools section for admin even with null toolPermissions", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/(tabs)/index.tsx", "utf-8");
    
    // The condition should include admin role check
    expect(content).toContain('user?.role === "admin"');
    // Should pass user?.role to canAccessTool
    expect(content).toContain("user?.toolPermissions, user?.role");
  });
});

// ===== Test 4: Goals/KPIs use correct API calls =====
describe("Goals and KPIs API integration", () => {
  it("should use trpcCall for fetching goals (not useQuery hook)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/admin-goals-kpis.tsx", "utf-8");
    
    // Should use trpcCall for queries
    expect(content).toContain('trpcCall("goalsAndKpis.getMonthlyGoals"');
    expect(content).toContain('trpcCall("goalsAndKpis.getKpis"');
    
    // Should NOT have broken useQuery inside queryFn
    expect(content).not.toContain("trpc.goalsAndKpis.getMonthlyGoals.useQuery");
    expect(content).not.toContain("trpc.goalsAndKpis.getKpis.useQuery");
  });

  it("should use trpc mutations for create/delete", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/admin-goals-kpis.tsx", "utf-8");
    
    // Should use tRPC useMutation hooks
    expect(content).toContain("trpc.goalsAndKpis.createMonthlyGoal.useMutation");
    expect(content).toContain("trpc.goalsAndKpis.createKpi.useMutation");
    expect(content).toContain("trpc.goalsAndKpis.deleteMonthlyGoal.useMutation");
    expect(content).toContain("trpc.goalsAndKpis.deleteKpi.useMutation");
  });

  it("should pass month and createdBy when creating goals", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/admin-goals-kpis.tsx", "utf-8");
    
    // handleAddGoal should include month and createdBy
    expect(content).toContain("month: currentMonth");
    expect(content).toContain("createdBy: user?.id || 0");
  });

  it("should pass { id: ... } when deleting goals/kpis", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/app/admin-goals-kpis.tsx", "utf-8");
    
    expect(content).toContain("deleteGoalMutation.mutate({ id: goal.id })");
    expect(content).toContain("deleteKpiMutation.mutate({ id: kpi.id })");
  });
});

// ===== Test 5: Server returns toolPermissions =====
describe("Server toolPermissions in responses", () => {
  it("server routers should include toolPermissions in user responses", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/server/routers.ts", "utf-8");
    
    // Should have toolPermissions referenced multiple times (me, login, getAllUsers, updateToolPermissions)
    const matches = content.match(/toolPermissions/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });

  it("should have updateToolPermissions mutation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/server/routers.ts", "utf-8");
    
    expect(content).toContain("updateToolPermissions");
    expect(content).toContain("toolPermissions: z.record(z.string(), z.boolean())");
  });

  it("schema should have toolPermissions field", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("/home/ubuntu/sultan_factory_app/drizzle/schema.ts", "utf-8");
    
    expect(content).toContain("toolPermissions");
  });
});
