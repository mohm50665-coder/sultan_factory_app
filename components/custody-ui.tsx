import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { businessMilliseconds } from "../shared/custody-reporting";
import type {
  CustodyBatch,
  CustodyLot,
  CustodySettings,
  CustodyStage,
  CustodyStatus,
  CustodyTransfer,
} from "../shared/custody-contract";
import {
  CUSTODY_QUALITY_LABELS,
  CUSTODY_STAGE_LABELS,
  CUSTODY_STATUS_LABELS,
} from "../shared/custody-contract";

export const CUSTODY_STAGES: CustodyStage[] = ["production", "rosso", "qalb", "antislip", "kawiya", "inspection", "packing", "storage", "followup", "customer_service"];

export function formatPairs(pairs: number | undefined | null): string {
  const safePairs = Math.max(0, Math.trunc(Number(pairs) || 0));
  return `${Math.floor(safePairs / 12)} درزن + ${safePairs % 12} زوج`;
}

export function formatRiyadh(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

export function stageLabel(stage?: CustodyStage): string {
  return stage ? CUSTODY_STAGE_LABELS[stage] : "—";
}

export function statusLabel(status?: CustodyStatus): string {
  return status ? CUSTODY_STATUS_LABELS[status] : "—";
}

export function qualityLabel(quality?: keyof typeof CUSTODY_QUALITY_LABELS): string {
  return quality ? CUSTODY_QUALITY_LABELS[quality] : "—";
}

export type WorkbenchCounts = {
  pendingReceive: number;
  held: number;
  working: number;
  completed: number;
  sent: number;
  overdue: number;
  disputed: number;
};

function hasConfiguredOverdue(lot: CustodyLot, settings?: CustodySettings): boolean {
  const rule = settings?.stageLimits?.[lot.stage];
  if (!rule || !["received", "working", "paused"].includes(lot.status)) return false;
  const limitHours = rule.workHours;
  if (!Number.isFinite(limitHours) || limitHours <= 0) return false;
  const baseline = lot.receivedAt;
  if (!baseline) return false;
  const elapsed = businessMilliseconds(baseline, new Date().toISOString(), settings);
  return elapsed.businessMs !== null && elapsed.businessMs > limitHours * 60 * 60 * 1000;
}

/** Derives metrics only from server records; an absent policy can never create an overdue count. */
export function selectWorkbenchCounts(
  batches: CustodyBatch[],
  userId: number | undefined,
  settings?: CustodySettings,
): WorkbenchCounts {
  const counts: WorkbenchCounts = { pendingReceive: 0, held: 0, working: 0, completed: 0, sent: 0, overdue: 0, disputed: 0 };
  if (!userId) return counts;

  for (const batch of batches) {
    for (const transfer of batch.transfers) {
      if (transfer.toUserId === userId && transfer.status === "pending") {
        counts.pendingReceive += 1;
        const limit = settings?.stageLimits[transfer.toStage]?.confirmationHours;
        if (limit && Date.now() - Date.parse(transfer.sentAt) > limit * 3_600_000) counts.overdue += 1;
      }
      if ((transfer.toUserId === userId || transfer.fromUserId === userId) && transfer.status === "disputed") counts.disputed += 1;
    }
    for (const lot of batch.custodies) {
      if (lot.ownerId !== userId) continue;
      if (lot.status === "received" || lot.status === "paused") counts.held += 1;
      if (lot.status === "working") counts.working += 1;
      if (lot.status === "completed") counts.completed += 1;
      if (lot.status === "sent") counts.sent += 1;
      if (lot.status === "disputed") counts.disputed += 1;
      if (hasConfiguredOverdue(lot, settings)) counts.overdue += 1;
    }
  }
  return counts;
}

export type WorkbenchRow =
  | { kind: "lot"; id: string; batch: CustodyBatch; lot: CustodyLot }
  | { kind: "incoming"; id: string; batch: CustodyBatch; transfer: CustodyTransfer }
  | { kind: "outgoing"; id: string; batch: CustodyBatch; transfer: CustodyTransfer };

export function selectWorkbenchRows(
  batches: CustodyBatch[],
  userId: number | undefined,
  filters: { search: string; status?: string },
): WorkbenchRow[] {
  if (!userId) return [];
  const needle = filters.search.trim().toLocaleLowerCase("ar-SA");
  const rows: WorkbenchRow[] = [];
  const matches = (batch: CustodyBatch, text: string, status: string) => {
    const searchText = `${batch.trackingNumber} ${batch.product.code} ${batch.product.name} ${text}`.toLocaleLowerCase("ar-SA");
    return (!needle || searchText.includes(needle)) && (!filters.status || filters.status === status);
  };

  for (const batch of batches) {
    for (const lot of batch.custodies) {
      if (lot.ownerId === userId && matches(batch, `${lot.ownerName} ${stageLabel(lot.stage)}`, lot.status)) {
        rows.push({ kind: "lot", id: `lot:${batch.id}:${lot.id}`, batch, lot });
      }
    }
    for (const transfer of batch.transfers) {
      if (transfer.toUserId === userId && ["pending", "disputed", "rejected"].includes(transfer.status) && matches(batch, `${transfer.fromName} ${stageLabel(transfer.fromStage)}`, transfer.status)) {
        rows.push({ kind: "incoming", id: `incoming:${batch.id}:${transfer.id}`, batch, transfer });
      }
      if (transfer.fromUserId === userId && ["pending", "disputed", "rejected"].includes(transfer.status) && matches(batch, `${transfer.toName} ${stageLabel(transfer.toStage)}`, transfer.status)) {
        rows.push({ kind: "outgoing", id: `outgoing:${batch.id}:${transfer.id}`, batch, transfer });
      }
    }
  }
  return rows;
}

const STATUS_COLORS: Record<string, { background: string; foreground: string }> = {
  received: { background: "#e0f2fe", foreground: "#075985" },
  working: { background: "#dcfce7", foreground: "#166534" },
  paused: { background: "#fef3c7", foreground: "#92400e" },
  completed: { background: "#ede9fe", foreground: "#5b21b6" },
  sent: { background: "#dbeafe", foreground: "#1d4ed8" },
  closed: { background: "#ecfdf5", foreground: "#047857" },
  stored: { background: "#dcfce7", foreground: "#166534" },
  destroyed: { background: "#fee2e2", foreground: "#991b1b" },
  disputed: { background: "#fee2e2", foreground: "#b91c1c" },
  pending: { background: "#dbeafe", foreground: "#1d4ed8" },
  confirmed: { background: "#ecfdf5", foreground: "#047857" },
  rejected: { background: "#fee2e2", foreground: "#b91c1c" },
};

export function StatusPill({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const color = STATUS_COLORS[status] || { background: "#f1f5f9", foreground: "#475569" };
  const label = status in CUSTODY_STATUS_LABELS ? statusLabel(status as CustodyStatus) : ({ pending: "بانتظار الاستلام", confirmed: "مؤكد", rejected: "مرفوض" }[status] || status);
  return <View style={[styles.pill, { backgroundColor: color.background }, style]}><Text style={[styles.pillText, { color: color.foreground }]}>{label}</Text></View>;
}

export function MessageBanner({
  tone = "info",
  message,
  onDismiss,
}: {
  tone?: "info" | "success" | "error";
  message?: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  const tones = {
    info: { background: "#eff6ff", border: "#bfdbfe", color: "#1e3a8a" },
    success: { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" },
    error: { background: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  }[tone];
  return <View accessibilityRole="alert" style={[styles.message, { backgroundColor: tones.background, borderColor: tones.border }]}><Text style={[styles.messageText, { color: tones.color }]}>{message}</Text>{onDismiss ? <Text onPress={onDismiss} style={[styles.dismiss, { color: tones.color }]}>إخفاء</Text> : null}</View>;
}

export function BusyLabel({ label = "جارٍ التنفيذ…" }: { label?: string }) {
  return <View style={styles.busy}><ActivityIndicator size="small" color="#fff" /><Text style={styles.busyText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  message: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 10 },
  messageText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18, textAlign: "right" },
  dismiss: { fontSize: 11, fontWeight: "800" },
  busy: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7 },
  busyText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
