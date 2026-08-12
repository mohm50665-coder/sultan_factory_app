import { describe, expect, it } from "vitest";

import {
  getCustomManufacturingWorkflowStatus,
  isCustomManufacturingEntryOverdue,
} from "../lib/services/custom-manufacturing.utils";

describe("custom manufacturing workflow utilities", () => {
  it("derives the workflow status in the expected order", () => {
    expect(getCustomManufacturingWorkflowStatus({})).toBe("pending");
    expect(getCustomManufacturingWorkflowStatus({ salesApprovalStatus: "approved" })).toBe("approved");
    expect(getCustomManufacturingWorkflowStatus({ salesApprovalStatus: "approved", productionProgress: 50 })).toBe("in_progress");
    expect(getCustomManufacturingWorkflowStatus({ productionApprovalStatus: "completed" })).toBe("completed");
    expect(getCustomManufacturingWorkflowStatus({ salesApprovalStatus: "rejected", productionProgress: 100 })).toBe("rejected");
  });

  it("marks only unfinished requests past their delivery date as overdue", () => {
    const now = new Date("2026-08-12T12:00:00Z").getTime();
    expect(isCustomManufacturingEntryOverdue({ deliveryDate: "2026-08-11", salesApprovalStatus: "approved" }, now)).toBe(true);
    expect(isCustomManufacturingEntryOverdue({ deliveryDate: "2026-08-12", salesApprovalStatus: "approved" }, now)).toBe(false);
    expect(isCustomManufacturingEntryOverdue({ deliveryDate: "2026-08-11", productionApprovalStatus: "completed" }, now)).toBe(false);
    expect(isCustomManufacturingEntryOverdue({ deliveryDate: "2026-08-11", salesApprovalStatus: "rejected" }, now)).toBe(false);
  });
});
