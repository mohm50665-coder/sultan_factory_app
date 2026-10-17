import { trpcCall } from "@/lib/services/api.service";
import type { CustodyReportFilters } from "../../shared/custody-reporting";
import type {
  CustodyAccount,
  CustodyActionInput,
  CustodyAllocation,
  CustodyBatch,
  CustodyBatchGroupInput,
  CustodyBatchGroupResult,
  CustodyBatchInput,
  CustodyQuality,
  CustodySettings,
  CustodyStage,
} from "../../shared/custody-contract";

export type CustodyListInput = { stage?: CustodyStage; batchId?: string };
const uuidFallback = () => {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Creates a UUID once per user intent; callers keep it for retries until the server answers. */
export function createCustodyOperationKey(): string {
  const generator = globalThis.crypto?.randomUUID;
  return generator ? generator.call(globalThis.crypto) : uuidFallback();
}

/** The only ordinary manufacturing route. Split stages are resolved through full allocations. */
export function nextCustodyStage(
  stage: CustodyStage,
  antiSlip: boolean,
  purpose: "sale" | "sample",
): CustodyStage | null {
  if (purpose === "sample") {
    if (stage === "production") return antiSlip ? "antislip" : "customer_service";
    if (stage === "antislip") return "customer_service";
    return null;
  }

  switch (stage) {
    case "production": return "rosso";
    case "rosso": return "qalb";
    case "qalb": return antiSlip ? "antislip" : "kawiya";
    case "kawiya": return "inspection";
    case "packing": return "storage";
    default: return null;
  }
}

export function isAllocationAllowed(
  sourceStage: CustodyStage,
  allocation: Pick<CustodyAllocation, "toStage" | "quality">,
): boolean {
  if (sourceStage === "antislip") {
    return (
      (allocation.toStage === "kawiya" && (allocation.quality === "first" || allocation.quality === "second")) ||
      (allocation.toStage === "inspection" && allocation.quality === "suspected")
    );
  }
  if (sourceStage === "inspection") {
    return (
      (allocation.toStage === "packing" && (allocation.quality === "first" || allocation.quality === "second")) ||
      (allocation.toStage === "followup" && allocation.quality === "damaged")
    );
  }
  return false;
}

export type AllocationValidation = { valid: boolean; total: number; message?: string };

/** Client-side clarity only; the server remains the final transactional route and quantity authority. */
export function validateFullAllocations(
  sourceStage: CustodyStage,
  expectedPairs: number,
  allocations: CustodyAllocation[],
): AllocationValidation {
  const total = allocations.reduce((sum, allocation) => sum + (Number.isInteger(allocation.pairs) ? allocation.pairs : 0), 0);
  if (!Number.isInteger(expectedPairs) || expectedPairs <= 0) {
    return { valid: false, total, message: "كمية العهدة غير صالحة للتحقق." };
  }
  if (allocations.length === 0 || allocations.some((allocation) => (
    !Number.isInteger(allocation.toUserId) || allocation.toUserId <= 0 ||
    !Number.isInteger(allocation.pairs) || allocation.pairs <= 0 ||
    !isAllocationAllowed(sourceStage, allocation)
  ))) {
    return { valid: false, total, message: "أكمل وجهة ومستلمًا وكمية صحيحة لكل توزيع مسموح." };
  }
  if (total !== expectedPairs) {
    const difference = Math.abs(expectedPairs - total);
    return {
      valid: false,
      total,
      message: total < expectedPairs
        ? `مجموع التوزيع أقل من العهدة بمقدار ${difference} زوجًا.`
        : `مجموع التوزيع يزيد على العهدة بمقدار ${difference} زوجًا.`,
    };
  }
  return { valid: true, total };
}

function confirmed<T extends { success?: boolean }>(result: T | undefined, fallback: string): T {
  if (!result?.success) throw new Error(fallback);
  return result;
}

export const custodyService = {
  accounts: {
    list: async (): Promise<CustodyAccount[]> => {
      // The fixed V2 contract deliberately takes no input; active receiver selection is scoped by returned accounts.
      const result = await trpcCall("custodyV2.accounts", undefined, "query");
      if (!Array.isArray(result)) throw new Error("استجابة قائمة الموظفين غير صالحة؛ لم يتم إخفاء خطأ الاتصال كقائمة فارغة.");
      return result as CustodyAccount[];
    },
  },
  list: async (input?: CustodyListInput): Promise<CustodyBatch[]> => {
    const result = await trpcCall("custodyV2.list", input, "query");
    if (!Array.isArray(result)) throw new Error("استجابة قائمة العهد غير صالحة؛ حاول التحديث أو راجع الاتصال.");
    return result as CustodyBatch[];
  },
  createBatch: async (input: CustodyBatchInput): Promise<{ success: true; batchId: string; trackingNumber: string }> => {
    const result = await trpcCall("custodyV2.createBatch", input);
    return confirmed(result, "لم يؤكد الخادم إنشاء الدفعة.") as { success: true; batchId: string; trackingNumber: string };
  },
  createBatchGroup: async (input: CustodyBatchGroupInput): Promise<CustodyBatchGroupResult> => {
    const result = await trpcCall("custodyV2.createBatchGroup", input);
    return confirmed(result, "لم يؤكد الخادم إنشاء مجموعة الدفعات.") as CustodyBatchGroupResult;
  },
  act: async (input: CustodyActionInput): Promise<{ success: true; batchId: string; replayed?: boolean; message?: string }> => {
    const result = await trpcCall("custodyV2.act", input);
    return confirmed(result, "لم يؤكد الخادم تنفيذ الإجراء.") as { success: true; batchId: string; replayed?: boolean; message?: string };
  },
  settings: async (): Promise<CustodySettings> => {
    const result = await trpcCall("custodyV2.settings", undefined, "query");
    if (!result || typeof result !== "object") throw new Error("تعذر تحميل إعدادات العهد.");
    return result as CustodySettings;
  },
  saveSettings: async (input: CustodySettings): Promise<{ success: true }> => {
    const result = await trpcCall("custodyV2.saveSettings", input);
    return confirmed(result, "لم يؤكد الخادم حفظ إعدادات العهد.") as { success: true };
  },
  exportExcel: async (filters: CustodyReportFilters): Promise<{ success: true; name: string; base64: string }> => {
    const result = await trpcCall("custodyV2.exportExcel", filters);
    return confirmed(result, "تعذر إنشاء ملف Excel.") as { success: true; name: string; base64: string };
  },
};
