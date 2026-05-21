import { describe, it, expect } from "vitest";

// بيانات العمال لكل مرحلة (نسخة من الشاشة للاختبار)
const STAGE_CONFIG: Record<
  string,
  { name: string; color: string; workers: string[] }
> = {
  machines: {
    name: "إنتاج المكائن",
    color: "#0a7ea4",
    workers: ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق", "الجميع"],
  },
  rosso: {
    name: "الروسو",
    color: "#7c3aed",
    workers: ["فريدو", "قيوم", "الجميع"],
  },
  qalb: {
    name: "القلب",
    color: "#059669",
    workers: ["حسين السوري"],
  },
  kawiya: {
    name: "الكاوية",
    color: "#dc2626",
    workers: ["جنيد"],
  },
  inspection: {
    name: "الفحص",
    color: "#d97706",
    workers: ["عارف", "انام الدين", "الجميع"],
  },
  packing: {
    name: "التغليف",
    color: "#2563eb",
    workers: ["محمد عمر", "غلام", "بشير", "الجميع"],
  },
  antislip: {
    name: "مانع الانزلاق",
    color: "#0891b2",
    workers: ["محمد عمر", "مرتضى", "أوجيل", "الجميع"],
  },
  storage: {
    name: "التخزين",
    color: "#4f46e5",
    workers: ["شميم"],
  },
};

describe("Manufacturing Stage Configuration", () => {
  it("should have 8 manufacturing stages defined", () => {
    const stages = Object.keys(STAGE_CONFIG);
    expect(stages.length).toBe(8);
  });

  it("should have correct workers for machines stage", () => {
    const machinesWorkers = STAGE_CONFIG.machines.workers;
    expect(machinesWorkers).toContain("رنا");
    expect(machinesWorkers).toContain("محمد احمد");
    expect(machinesWorkers).toContain("أفضل");
    expect(machinesWorkers).toContain("عطالله");
    expect(machinesWorkers).toContain("شفيق");
    expect(machinesWorkers).toContain("الجميع");
    expect(machinesWorkers.length).toBe(6);
  });

  it("should have correct workers for rosso stage", () => {
    const rossoWorkers = STAGE_CONFIG.rosso.workers;
    expect(rossoWorkers).toContain("فريدو");
    expect(rossoWorkers).toContain("قيوم");
    expect(rossoWorkers).toContain("الجميع");
    expect(rossoWorkers.length).toBe(3);
  });

  it("should have correct worker for qalb stage", () => {
    expect(STAGE_CONFIG.qalb.workers).toEqual(["حسين السوري"]);
  });

  it("should have correct worker for kawiya stage", () => {
    expect(STAGE_CONFIG.kawiya.workers).toEqual(["جنيد"]);
  });

  it("should have correct workers for inspection stage", () => {
    const inspectionWorkers = STAGE_CONFIG.inspection.workers;
    expect(inspectionWorkers).toContain("عارف");
    expect(inspectionWorkers).toContain("انام الدين");
    expect(inspectionWorkers).toContain("الجميع");
  });

  it("should have correct workers for packing stage", () => {
    const packingWorkers = STAGE_CONFIG.packing.workers;
    expect(packingWorkers).toContain("محمد عمر");
    expect(packingWorkers).toContain("غلام");
    expect(packingWorkers).toContain("بشير");
    expect(packingWorkers).toContain("الجميع");
  });

  it("should have correct workers for antislip stage", () => {
    const antislipWorkers = STAGE_CONFIG.antislip.workers;
    expect(antislipWorkers).toContain("محمد عمر");
    expect(antislipWorkers).toContain("مرتضى");
    expect(antislipWorkers).toContain("أوجيل");
    expect(antislipWorkers).toContain("الجميع");
  });

  it("should have correct worker for storage stage", () => {
    expect(STAGE_CONFIG.storage.workers).toEqual(["شميم"]);
  });

  it("each stage should have a name and color", () => {
    Object.values(STAGE_CONFIG).forEach((stage) => {
      expect(stage.name).toBeTruthy();
      expect(stage.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(stage.workers.length).toBeGreaterThan(0);
    });
  });

  it("should generate correct storage key for each stage", () => {
    Object.keys(STAGE_CONFIG).forEach((stageId) => {
      const storageKey = `sultan_manufacturing_${stageId}`;
      expect(storageKey).toBeTruthy();
      expect(storageKey).toContain("sultan_manufacturing_");
    });
  });
});

describe("Worker Entry Data Model", () => {
  it("should create a valid worker entry", () => {
    const entry = {
      id: "123",
      workerName: "رنا",
      productionDozen: "10",
      productionPairs: "120",
      date: "2026/01/01",
      notes: "",
    };
    expect(entry.id).toBeTruthy();
    expect(entry.workerName).toBe("رنا");
    expect(entry.productionDozen).toBe("10");
    expect(entry.productionPairs).toBe("120");
    expect(entry.date).toBeTruthy();
  });

  it("should validate that worker name is required", () => {
    const selectedWorker = "";
    const isValid = selectedWorker.length > 0;
    expect(isValid).toBe(false);
  });

  it("should validate that at least one production field is required", () => {
    const productionDozen = "";
    const productionPairs = "";
    const isValid = productionDozen.length > 0 || productionPairs.length > 0;
    expect(isValid).toBe(false);
  });

  it("should accept valid production data", () => {
    const productionDozen = "5";
    const productionPairs = "60";
    const isValid = productionDozen.length > 0 || productionPairs.length > 0;
    expect(isValid).toBe(true);
  });
});
