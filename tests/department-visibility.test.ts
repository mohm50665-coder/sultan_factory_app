import { describe, it, expect } from "vitest";

// Replicate the DASHBOARD_ITEMS departments logic from index.tsx
interface DashboardItem {
  id: string;
  departments: string[];
  isShared?: boolean;
}

const DASHBOARD_ITEMS: DashboardItem[] = [
  { id: "production", departments: ["production"] },
  { id: "manufacturing", departments: ["production"] },
  { id: "sales", departments: ["sales"] },
  { id: "warehouse", departments: ["warehouse"] },
  { id: "maintenance", departments: ["maintenance"] },
  { id: "financial", departments: ["administrative"] },
  { id: "administrative", departments: ["administrative"] },
  { id: "tasks", departments: [], isShared: true },
];

function getVisibleItems(userRole: string, userDepartment: string): DashboardItem[] {
  return DASHBOARD_ITEMS.filter((item) => {
    if (userRole === "admin") return true;
    if (userDepartment === "board_representative") {
      return item.isShared || item.id === "tasks";
    }
    if (item.isShared) return true;
    if (item.departments.length === 0) return true;
    return item.departments.includes(userDepartment);
  });
}

describe("Department-based dashboard visibility", () => {
  it("admin sees all items", () => {
    const items = getVisibleItems("admin", "board_representative");
    expect(items.length).toBe(8);
  });

  it("production department sees production + manufacturing + tasks", () => {
    const items = getVisibleItems("user", "production");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("production");
    expect(ids).toContain("manufacturing");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("sales");
    expect(ids).not.toContain("warehouse");
    expect(ids).not.toContain("maintenance");
    expect(ids).not.toContain("financial");
    expect(ids).not.toContain("administrative");
  });

  it("sales department sees sales + tasks only", () => {
    const items = getVisibleItems("user", "sales");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("sales");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("warehouse");
  });

  it("warehouse department sees warehouse + tasks only", () => {
    const items = getVisibleItems("user", "warehouse");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("warehouse");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("sales");
  });

  it("maintenance department sees maintenance + tasks only", () => {
    const items = getVisibleItems("user", "maintenance");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("maintenance");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("sales");
  });

  it("administrative department sees financial + administrative + tasks", () => {
    const items = getVisibleItems("user", "administrative");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("financial");
    expect(ids).toContain("administrative");
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("sales");
  });

  it("board representative sees only tasks", () => {
    const items = getVisibleItems("user", "board_representative");
    const ids = items.map((i) => i.id);
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("sales");
    expect(ids).not.toContain("warehouse");
    expect(ids).not.toContain("maintenance");
    expect(ids).not.toContain("financial");
    expect(ids).not.toContain("administrative");
  });

  it("tasks icon is shared and visible to all departments", () => {
    const departments = ["production", "sales", "warehouse", "maintenance", "administrative", "board_representative"];
    for (const dept of departments) {
      const items = getVisibleItems("user", dept);
      const ids = items.map((i) => i.id);
      expect(ids).toContain("tasks");
    }
  });
});

describe("Task filtering by assigned user", () => {
  interface TaskData {
    id: number;
    assignedEmployee: string;
    assignedUsername?: string;
  }

  const tasks: TaskData[] = [
    { id: 1, assignedEmployee: "production_manager", assignedUsername: "ahmed" },
    { id: 2, assignedEmployee: "warehouse_manager", assignedUsername: "khalid" },
    { id: 3, assignedEmployee: "sales_manager", assignedUsername: "omar" },
    { id: 4, assignedEmployee: "production_manager", assignedUsername: undefined },
  ];

  function filterTasksForUser(allTasks: TaskData[], isAdmin: boolean, username: string, role: string): TaskData[] {
    return allTasks.filter((t) => {
      if (isAdmin) return true;
      const isAssignedToMe =
        t.assignedUsername === username ||
        t.assignedEmployee === username ||
        t.assignedEmployee === role;
      return isAssignedToMe;
    });
  }

  it("admin sees all tasks", () => {
    const result = filterTasksForUser(tasks, true, "admin", "admin");
    expect(result.length).toBe(4);
  });

  it("user ahmed sees only tasks assigned to him by username", () => {
    const result = filterTasksForUser(tasks, false, "ahmed", "user");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it("user khalid sees only his tasks", () => {
    const result = filterTasksForUser(tasks, false, "khalid", "user");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });

  it("user with role production_manager sees tasks assigned to that role (legacy)", () => {
    const result = filterTasksForUser(tasks, false, "someone", "production_manager");
    // Tasks 1 and 4 have assignedEmployee = "production_manager"
    expect(result.length).toBe(2);
  });

  it("user with no matching assignment sees no tasks", () => {
    const result = filterTasksForUser(tasks, false, "nobody", "user");
    expect(result.length).toBe(0);
  });
});
