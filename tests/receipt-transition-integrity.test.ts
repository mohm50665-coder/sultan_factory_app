import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routersSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const stageSource = readFileSync(resolve(process.cwd(), "app/manufacturing-stage.tsx"), "utf8");

describe("Receipt and handover integrity", () => {
  it("marks the delivered source record as received before creating the next-stage custody", () => {
    expect(routersSource).toContain('set({ movementStatus: "received", receivedBy: receiverName, receivedAt');
    expect(routersSource).toContain('stageName: destinationStage');
    expect(routersSource).toContain('movementStatus: "received"');
  });

  it("keeps the full mandatory manufacturing route in the server transition rules", () => {
    expect(routersSource).toContain('machines: ["rosso"]');
    expect(routersSource).toContain('rosso: ["qalb"]');
    expect(routersSource).toContain('qalb: ["kawiya"]');
    expect(routersSource).toContain('kawiya: ["inspection"]');
  });

  it("allows the receiver to confirm by display name or username", () => {
    expect(stageSource).toContain("samePersonName(product.expectedReceiver, (user as any)?.username)");
    expect(routersSource).toContain("samePersonName(expectedReceiver, receiverUsername)");
  });
});

export {};
            
