import { describe, it, expect } from "vitest";

// Mirror the strict dashboard policy in app/(tabs)/index.tsx.
interface DashboardItem {
  id: string;
}

const DASHBOARD_ITEMS: DashboardItem[] = [
  { id: "manufacturing" },
  { id: "tasks" },
  { id: "server_notifications" },
  { id: "production" },
  { id: "sales" },
  { id: "warehouse" },
  { id: "maintenance" },
  { id: "administrative" },
  { id: "board_representative_old" },
  { id: "reports" },
];

function normalizeDepartment(department: string) {
  const value = department.trim().toLowerCase();
  if (["sales", "marketing", "collection", "customer_service", "تسويق", "المبيعات", "التحصيل"].includes(value)) return "sales";
  if (["warehouse", "warehouses", "المستودعات", "مستودعات"].includes(value)) return "warehouse";
  return value;
}

function getVisibleItems(userRole: string, userDepartment: string, position = ""): DashboardItem[] {
  if (userRole === "admin") return DASHBOARD_ITEMS;
  const department = normalizeDepartment(userDepartment);
  const isManager = userRole === "manager" || position.includes("مدير") || position.toLowerCase().includes("manager");
  if (department === "board_representative") {
    return DASHBOARD_ITEMS.filter((item) => ["manufacturing", "tasks", "server_notifications", "board_representative_old"].includes(item.id));
  }
  if (isManager) {
    const departmentIcon = department === "sales" ? "sales" : department;
    return DASHBOARD_ITEMS.filter((item) => ["tasks", "server_notifications", departmentIcon].includes(item.id));
  }
  return DASHBOARD_ITEMS.filter((item) => ["manufacturing", "tasks", "server_notifications"].includes(item.id));
}

describe("Department-based dashboard visibility", () => {
  it("admin sees all dashboard items", () => {
    expect(getVisibleItems("admin", "production").length).toBe(DASHBOARD_ITEMS.length);
  });

  it("regular employee sees only manufacturing, tasks, and notifications", () => {
    const ids = getVisibleItems("user", "production").map((item) => item.id);
    expect(ids).toEqual(["manufacturing", "tasks", "server_notifications"]);
    expect(ids).not.toContain("production");
    expect(ids).not.toContain("sales");
    expect(ids).not.toContain("warehouse");
    expect(ids).not.toContain("reports");
  });

  it("stage employee still sees only the three employee items", () => {
    const ids = getVisibleItems("user", "rosso").map((item) => item.id);
    expect(ids).toEqual(["manufacturing", "tasks", "server_notifications"]);
  });

  it("sales or marketing manager sees tasks, notifications, and sales", () => {
    expect(getVisibleItems("manager", "marketing").map((item) => item.id)).toEqual(["tasks", "server_notifications", "sales"]);
    expect(getVisibleItems("user", "sales", "مدير المبيعات").map((item) => item.id)).toEqual(["tasks", "server_notifications", "sales"]);
  });

  it("warehouse manager sees tasks, notifications, and warehouse only", () => {
    const ids = getVisibleItems("manager", "المستودعات").map((item) => item.id);
    expect(ids).toEqual(["tasks", "server_notifications", "warehouse"]);
    expect(ids).not.toContain("sales");
    expect(ids).not.toContain("reports");
  });

  it("manager does not inherit manually assigned extra tools", () => {
    const ids = getVisibleItems("manager", "warehouse").map((item) => item.id);
    expect(ids).not.toContain("reports");
    expect(ids).not.toContain("administrative");
    expect(ids).not.toContain("production");
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
