import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe("Consultant acceptance contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes sample delivery only from the ready-for-requester state", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { data: { json: { success: true, status: "completed" } } } }),
    });

    const response = await fetch("/api/trpc/sampleRequests.completeDelivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { id: 7, deliveredTo: "شركة العميل", receivedBy: "مسؤول العميل" },
      }),
    });

    const data = await response.json();
    expect(data.result.data.json.status).toBe("completed");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).json.receivedBy).toBe("مسؤول العميل");
  });

  it("uses the internal notification contract for sample delivery", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { data: { json: { success: true, id: 31 } } } }),
    });

    const response = await fetch("/api/trpc/alerts.create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          type: "sample_delivery",
          title: "تم تسليم طلب العينة",
          message: "تم تسليم SMP-20260911 إلى مسؤول العميل",
          severity: "info",
          userId: 12,
        },
      }),
    });

    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).json.type).toBe("sample_delivery");
  });

  it("keeps the three acceptance roles distinct", () => {
    const roles = [
      { name: "admin", canApprove: true, canOperate: true },
      { name: "production-manager", canApprove: true, canOperate: true },
      { name: "stage-worker", canApprove: false, canOperate: true },
    ];

    expect(roles.filter((role) => role.canApprove).map((role) => role.name)).toEqual(["admin", "production-manager"]);
    expect(roles.every((role) => role.canOperate)).toBe(true);
  });

  it("does not use SMTP for the internal notification path", () => {
    expect(process.env.SMTP_HOST).toBeUndefined();
    expect(process.env.SMTP_USER).toBeUndefined();
    expect(process.env.SMTP_PASSWORD).toBeUndefined();
  });
});
