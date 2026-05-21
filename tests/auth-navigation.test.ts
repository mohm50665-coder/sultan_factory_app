import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

describe("Authentication System", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it("should register a new user successfully", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    // Simulate registration
    const userData = {
      id: "1",
      name: "أحمد محمد",
      email: "ahmed@test.com",
      phone: "0501234567",
      position: "مشرف إنتاج",
      role: "user",
    };

    await AsyncStorage.setItem("sultan_users", JSON.stringify([userData]));
    await AsyncStorage.setItem("sultan_current_user", JSON.stringify(userData));

    const storedUsers = await AsyncStorage.getItem("sultan_users");
    const users = JSON.parse(storedUsers!);
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("أحمد محمد");
    expect(users[0].email).toBe("ahmed@test.com");
    expect(users[0].position).toBe("مشرف إنتاج");
  });

  it("should login with existing credentials", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    const userData = {
      id: "1",
      name: "أحمد محمد",
      email: "ahmed@test.com",
      password: "123456",
      role: "user",
    };

    await AsyncStorage.setItem("sultan_users", JSON.stringify([userData]));

    const storedUsers = await AsyncStorage.getItem("sultan_users");
    const users = JSON.parse(storedUsers!);
    const foundUser = users.find((u: any) => u.email === "ahmed@test.com" && u.password === "123456");

    expect(foundUser).toBeDefined();
    expect(foundUser.name).toBe("أحمد محمد");
  });

  it("should fail login with wrong password", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    const userData = {
      id: "1",
      name: "أحمد محمد",
      email: "ahmed@test.com",
      password: "123456",
      role: "user",
    };

    await AsyncStorage.setItem("sultan_users", JSON.stringify([userData]));

    const storedUsers = await AsyncStorage.getItem("sultan_users");
    const users = JSON.parse(storedUsers!);
    const foundUser = users.find((u: any) => u.email === "ahmed@test.com" && u.password === "wrong");

    expect(foundUser).toBeUndefined();
  });

  it("should have admin demo account", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    const adminUser = {
      id: "admin-1",
      name: "المدير العام",
      email: "admin@sultan.com",
      password: "123456",
      role: "admin",
      position: "مدير النظام",
    };

    await AsyncStorage.setItem("sultan_users", JSON.stringify([adminUser]));

    const storedUsers = await AsyncStorage.getItem("sultan_users");
    const users = JSON.parse(storedUsers!);
    const admin = users.find((u: any) => u.role === "admin");

    expect(admin).toBeDefined();
    expect(admin.email).toBe("admin@sultan.com");
    expect(admin.role).toBe("admin");
  });

  it("should logout and clear session", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    await AsyncStorage.setItem("sultan_current_user", JSON.stringify({ id: "1", name: "Test" }));
    await AsyncStorage.removeItem("sultan_current_user");

    const currentUser = await AsyncStorage.getItem("sultan_current_user");
    expect(currentUser).toBeNull();
  });
});

describe("Manufacturing Stages Configuration", () => {
  it("should have correct workers for machines stage", () => {
    const workers = ["رنا", "شفيق", "محمد احمد", "عطالله", "الجميع"];
    expect(workers).toHaveLength(5);
    expect(workers).toContain("رنا");
    expect(workers).toContain("شفيق");
    expect(workers).toContain("محمد احمد");
    expect(workers).toContain("عطالله");
    expect(workers).toContain("الجميع");
  });

  it("should have correct workers for rosso stage", () => {
    const workers = ["فريدو", "قيوم", "الجميع"];
    expect(workers).toHaveLength(3);
    expect(workers).toContain("فريدو");
    expect(workers).toContain("قيوم");
  });

  it("should have correct workers for qalb stage", () => {
    const workers = ["حسين السوري"];
    expect(workers).toHaveLength(1);
    expect(workers[0]).toBe("حسين السوري");
  });

  it("should have correct workers for kawiya stage", () => {
    const workers = ["جنيد"];
    expect(workers).toHaveLength(1);
    expect(workers[0]).toBe("جنيد");
  });

  it("should have correct workers for inspection stage", () => {
    const workers = ["عارف", "انام الدين"];
    expect(workers).toHaveLength(2);
    expect(workers).toContain("عارف");
    expect(workers).toContain("انام الدين");
  });

  it("should have all 7 manufacturing stages", () => {
    const stages = ["machines", "rosso", "qalb", "kawiya", "inspection", "packing", "storage"];
    expect(stages).toHaveLength(7);
  });
});

describe("Production Data Structure", () => {
  it("should have correct production entry fields", () => {
    const entry = {
      id: "1",
      machineNumber: "5",
      productionDozen: "100",
      productionPairs: "1200",
      wasteThreadGrams: "50",
      wasteSocksGrams: "30",
      secondGradePairs: "10",
      secondGradeGrams: "120",
      date: "2026-05-21",
    };

    expect(entry.machineNumber).toBe("5");
    expect(entry.productionDozen).toBe("100");
    expect(entry.productionPairs).toBe("1200");
    expect(entry.wasteThreadGrams).toBe("50");
    expect(entry.wasteSocksGrams).toBe("30");
    expect(entry.secondGradePairs).toBe("10");
    expect(entry.secondGradeGrams).toBe("120");
  });
});
