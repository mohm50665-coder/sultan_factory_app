export type CustomManufacturingWorkflowStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "completed"
  | "rejected";

export interface CustomManufacturingStatusEntry {
  salesApprovalStatus?: string;
  productionApprovalStatus?: string;
  productionProgress?: number;
  status?: string;
  deliveryDate?: string;
}

export function getCustomManufacturingWorkflowStatus(
  entry: CustomManufacturingStatusEntry,
): CustomManufacturingWorkflowStatus {
  if (entry.salesApprovalStatus === "rejected") return "rejected";
  if (
    entry.status === "completed" ||
    entry.productionApprovalStatus === "completed" ||
    entry.productionProgress !== undefined && entry.productionProgress >= 100
  ) {
    return "completed";
  }
  if (
    entry.status === "in_progress" ||
    entry.productionApprovalStatus === "in_progress" ||
    entry.productionProgress !== undefined && entry.productionProgress >= 50
  ) {
    return "in_progress";
  }
  if (entry.salesApprovalStatus === "approved") return "approved";
  return "pending";
}

export function isCustomManufacturingEntryOverdue(
  entry: CustomManufacturingStatusEntry,
  now = Date.now(),
): boolean {
  const workflowStatus = getCustomManufacturingWorkflowStatus(entry);
  if (!entry.deliveryDate || workflowStatus === "completed" || workflowStatus === "rejected") {
    return false;
  }
  const deadline = new Date(`${entry.deliveryDate}T23:59:59`).getTime();
  return Number.isFinite(deadline) && deadline < now;
}
