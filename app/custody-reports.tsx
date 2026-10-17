import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useRouter, useLocalSearchParams } from "expo-router";
import { reportDate } from "@shared/operational-report";

import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  custodyQualityEnglish,
  custodyStageEnglish,
  custodyStatusEnglish,
  departmentEnglish,
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "@/lib/i18n/runtime";
import { custodyService } from "@/lib/services/custody.service";
import {
  CUSTODY_QUALITY_LABELS,
  CUSTODY_STAGE_LABELS,
  CUSTODY_STATUS_LABELS,
  type CustodyAccount,
  type CustodyBatch,
  type CustodyQuality,
  type CustodySettings,
  type CustodyStage,
  type CustodyStatus,
} from "@shared/custody-contract";
import {
  buildCustodyReport,
  formatDuration,
  arabicDepartment,
  formatPairs,
  formatRiyadh,
  reportCsv,
  reportPrintHtml,
  type CustodyReport,
  type CustodyReportEvent,
  type CustodyReportFilters,
  type ReportPeriod,
} from "@shared/custody-reporting";

const STAGES = Object.entries(CUSTODY_STAGE_LABELS) as [CustodyStage, string][];
const QUALITIES = Object.entries(CUSTODY_QUALITY_LABELS) as [
  CustodyQuality,
  string,
][];
const STATUSES = Object.entries(CUSTODY_STATUS_LABELS) as [
  CustodyStatus,
  string,
][];
const EMPTY_SETTINGS: CustodySettings = {
  enabled: false,
  scheduleCronTaskUid: null,
  stageLimits: {},
  shifts: [],
  holidays: [],
};

type DrillMetric =
  | "received"
  | "completed"
  | "confirmed"
  | "pending"
  | "open"
  | null;

function riyadhToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce(
      (acc, part) => ({ ...acc, [part.type]: part.value }),
      {} as Record<string, string>,
    );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, amount: number): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

type ScreenLanguage = "ar" | "en";

function rowDirection(language: ScreenLanguage): "row" | "row-reverse" {
  return isEnglish(language) ? "row" : "row-reverse";
}

function pairsFor(value: number | null | undefined, language: ScreenLanguage): string {
  if (!isEnglish(language)) return formatPairs(value);
  if (value == null || !Number.isFinite(value)) return "Invalid quantity — review required";
  const dozens = value >= 0 ? Math.floor(value / 12) : Math.ceil(value / 12);
  const remainder = Math.abs(value - dozens * 12);
  return `${value.toLocaleString("en-US")} pairs (${dozens.toLocaleString("en-US")} dozen and ${remainder.toLocaleString("en-US")} pairs)`;
}

function durationFor(value: number | null | undefined, language: ScreenLanguage): string {
  if (!isEnglish(language)) return formatDuration(value ?? null);
  if (value == null || !Number.isFinite(value)) return "Incomplete time data";
  const minutes = Math.round(value / 60_000);
  return `${Math.floor(minutes / 60).toLocaleString("en-US")} hr ${Math.abs(minutes % 60).toLocaleString("en-US")} min`;
}

function timeFor(value: string | undefined, language: ScreenLanguage): string {
  if (!isEnglish(language)) return formatRiyadh(value);
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Incomplete time";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(date);
}

function stageFor(stage: string | undefined, language: ScreenLanguage): string {
  if (!stage) return localize(language, "غير محدد", "Unspecified");
  return isEnglish(language)
    ? custodyStageEnglish[stage] || stage
    : CUSTODY_STAGE_LABELS[stage as CustodyStage] || stage;
}

function qualityFor(quality: string | undefined, language: ScreenLanguage): string {
  if (!quality) return "—";
  return isEnglish(language)
    ? custodyQualityEnglish[quality] || quality
    : CUSTODY_QUALITY_LABELS[quality as CustodyQuality] || quality;
}

function statusLabel(status: string | undefined, language: ScreenLanguage): string {
  if (!status) return "—";
  if (isEnglish(language)) return custodyStatusEnglish[status] || status;
  if (status === "pending") return "بانتظار التأكيد";
  if (status === "confirmed") return "مؤكد";
  if (status === "rejected") return "مرفوض";
  if (status === "disputed") return "اختلاف قيد المراجعة";
  return CUSTODY_STATUS_LABELS[status as CustodyStatus] || status;
}

function departmentFor(department: string | undefined, language: ScreenLanguage): string {
  if (!department) return "—";
  const arabic = arabicDepartment(department);
  if (!isEnglish(language)) return arabic;
  const stage = Object.entries(CUSTODY_STAGE_LABELS).find(([, label]) => label === arabic)?.[0];
  return stage ? departmentEnglish[stage] || stage : department;
}

function actionFor(action: string | undefined, fallback: string, language: ScreenLanguage): string {
  if (!isEnglish(language)) return fallback;
  const labels: Record<string, string> = {
    receive: "Receipt confirmed", received: "Received", start: "Work started", pause: "Paused",
    resume: "Work resumed", progress: "Progress recorded", complete: "Work completed",
    send: "Delivered / sent", sent: "Delivered / sent", confirm: "Next recipient confirmed",
    confirmed: "Next recipient confirmed", dispute: "Quantity discrepancy recorded",
    rejected: "Movement rejected", resolve: "Discrepancy resolved", store: "Stored in finished goods",
    approve_disposal: "Disposal record approved", execute_disposal: "Disposal executed",
    deliver_sample: "Sample delivery documented", correct: "Documented correction",
    rework: "Rework", transfer: "Custody transfer — delivery and receipt",
    transfer_disputed: "Quantity discrepancy", transfer_rejected: "Movement rejected",
    transfer_resolved_to_pending: "Discrepancy resolved", stock_stored: "Stored in finished goods",
    sample_delivered: "Sample delivered", batch_correction_recorded: "Documented version correction",
    rework_override_sent: "Rework decision",
  };
  return labels[action || ""] || fallback;
}

function systemWarningFor(warning: string, language: ScreenLanguage): string {
  return isEnglish(language) ? "Measurement safety warning. Review the relevant report record." : warning;
}

function periodFor(period: ReportPeriod, language: ScreenLanguage): string {
  const arabic: Record<ReportPeriod, string> = {
    daily: "يومي",
    weekly: "أسبوعي",
    monthly: "شهري",
    custom: "مخصص",
  };
  const english: Record<ReportPeriod, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    custom: "Custom",
  };
  return localize(language, arabic[period], english[period]);
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined")
    window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SelectButtons<T extends string>({
  value,
  onChange,
  options,
  label,
  allowAll = false,
}: {
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly (readonly [T, string])[];
  label: string;
  allowAll?: boolean;
}) {
  const { language } = useLanguage();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  return (
    <View style={styles.filterBlock}>
      <Text style={[styles.filterLabel, textStyle]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chipScroll, { flexDirection: rowDirection(language) }]}
        style={styles.horizontalScroll}
      >
        {allowAll ? (
          <TouchableOpacity
            onPress={() => onChange("")}
            style={[styles.chip, !value && styles.chipActive]}
          >
            <Text style={[styles.chipText, !value && styles.chipTextActive, textStyle]}>
              {localize(language, "الكل", "All")}
            </Text>
          </TouchableOpacity>
        ) : null}
        {options.map(([id, text]) => (
          <TouchableOpacity
            key={id}
            onPress={() => onChange(id)}
            style={[styles.chip, value === id && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, value === id && styles.chipTextActive, textStyle]}
            >
              {text}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function MetricCard({
  label,
  value,
  onPress,
  selected,
  tone = "blue",
}: {
  label: string;
  value: string;
  onPress?: () => void;
  selected?: boolean;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const { language } = useLanguage();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  const content = (
    <>
      <Text
        style={[
          styles.metricValue,
          tone === "green" && styles.greenText,
          tone === "amber" && styles.amberText,
          tone === "red" && styles.redText,
          textStyle,
        ]}
      >
        {value}
      </Text>
      <Text style={[styles.metricLabel, textStyle]}>{label}</Text>
      {onPress ? <Text style={[styles.drillHint, textStyle]}>{localize(language, "اضغط للتفاصيل", "Tap for details")}</Text> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.metric,
        { alignItems: isEnglish(language) ? "flex-start" : "flex-end" },
        selected && styles.metricSelected,
      ]}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View
      style={[
        styles.metric,
        { alignItems: isEnglish(language) ? "flex-start" : "flex-end" },
      ]}
    >
      {content}
    </View>
  );
}

function EventTable({
  events,
  title,
}: {
  events: CustodyReportEvent[];
  title?: string;
}) {
  const { language } = useLanguage();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  const columns = isEnglish(language)
    ? ["Movement / time", "Batch and product", "Quantity / grade", "Route and status", "Times and notes"]
    : ["الحركة / الوقت", "الدفعة والصنف", "الكمية / النخب", "المسار والحالة", "الأوقات والملاحظات"];
  return (
    <View style={styles.tableCard}>
      {title ? <Text style={[styles.tableTitle, textStyle]}>{title}</Text> : null}
      <View style={[styles.compactHeading, { flexDirection: rowDirection(language) }]}>
        {columns.map((label) => (
          <Text key={label} style={[styles.compactHeadCell, textStyle]}>
            {label}
          </Text>
        ))}
      </View>
      {!events.length ? (
        <Text style={[styles.emptyText, textStyle]}>{localize(language, "لا توجد حركات مطابقة.", "No matching movements.")}</Text>
      ) : (
        events.map((event) => (
          <View key={event.id} style={[styles.compactRow, { flexDirection: rowDirection(language) }]}>
            <View style={styles.compactCell}>
              <Text style={[styles.eventAction, textStyle]}>{actionFor(event.action, event.actionLabel, language)}</Text>
              <Text style={[styles.eventTime, textStyle]}>{timeFor(event.at, language)}</Text>
            </View>
            <View style={styles.compactCell}>
              <Text style={[styles.eventBatch, textStyle]}>
                {event.product} · {event.productSize} · {event.productColor}
              </Text>
              <Text style={[styles.eventInfo, textStyle]}>
                {event.trackingNumber} · {localize(language, "ماكينة", "Machine")} {event.machineNumber || "—"} ·{" "}
                {event.shift || localize(language, "الوردية غير مسجلة", "Shift not recorded")}
              </Text>
            </View>
            <View style={styles.compactCell}>
              <Text style={[styles.eventBatch, textStyle]}>
                {event.expectedPairs == null
                  ? event.pairs == null
                    ? "—"
                    : pairsFor(event.pairs, language)
                  : `${localize(language, "مرسل", "Sent")} ${pairsFor(event.expectedPairs, language)}`}
              </Text>
              {event.actualPairs !== undefined ? (
                <Text style={[styles.eventInfo, textStyle]}>
                  {localize(language, "فعلي", "Actual")} {pairsFor(event.actualPairs, language)} · {localize(language, "فرق", "Difference")}{" "}
                  {pairsFor(event.quantityDifferencePairs, language)}
                </Text>
              ) : null}
              <Text style={[styles.eventInfo, textStyle]}>
                {qualityFor(event.quality, language)}
              </Text>
            </View>
            <View style={styles.compactCell}>
              {event.sourceName || event.destinationName ? (
                <>
                  <Text style={[styles.eventInfo, textStyle]}>
                    {localize(language, "سلّم", "Delivered by")}: {departmentFor(event.sourceDepartment || event.department, language)} —{" "}
                    {event.sourceName || event.actorName}
                  </Text>
                  <Text style={[styles.eventInfo, textStyle]}>
                    {localize(language, "استلم", "Received by")}: {departmentFor(event.destinationDepartment, language)} —{" "}
                    {event.destinationName || "—"}
                  </Text>
                </>
              ) : (
                <Text style={[styles.eventInfo, textStyle]}>
                  {event.counterparty || "—"}
                  {event.counterpartyDepartment
                    ? ` · ${departmentFor(event.counterpartyDepartment, language)}`
                    : ""}
                </Text>
              )}
              <Text style={[styles.eventInfo, textStyle]}>{statusLabel(event.status, language)}</Text>
            </View>
            <View style={styles.compactCell}>
              {event.sentAt ? (
                <Text style={[styles.eventInfo, textStyle]}>
                  {localize(language, "الإرسال", "Sent")}: {timeFor(event.sentAt, language)} · {localize(language, "الاستلام", "Received")}:{" "}
                  {event.receivedAt
                    ? timeFor(event.receivedAt, language)
                    : localize(language, "بانتظار الاستلام", "Awaiting receipt")}{" "}
                  · {localize(language, "المدة", "Duration")}:{" "}
                  {durationFor(event.handoverDuration?.calendarMs ?? null, language)}
                </Text>
              ) : null}
              {event.reason ? (
                <Text style={[styles.eventWarning, textStyle]}>{event.reason}</Text>
              ) : null}
              {event.progress ? (
                <Text style={[styles.eventInfo, textStyle]}>
                  {localize(language, "قراءة تراكمية", "Cumulative reading")} {pairsFor(event.progress.cumulativePairs, language)}; {localize(language, "الفرق", "change")} {pairsFor(event.progress.deltaPairs, language)} {localize(language, "منذ", "since")}{" "}
                  {event.progress.intervalStartAt
                    ? timeFor(event.progress.intervalStartAt, language)
                    : localize(language, "أول قراءة", "first reading")}
                </Text>
              ) : null}
              {event.timing ? (
                <Text style={[styles.eventInfo, textStyle]}>
                  {localize(language, "العهدة", "Custody")} {durationFor(event.timing.custodyDuration.calendarMs, language)} ·
                  {localize(language, "انتظار التأكيد", "Awaiting confirmation")} {durationFor(event.timing.awaitingConfirmation.calendarMs, language)} ·
                  {localize(language, "العمل", "Work")} {durationFor(event.timing.manualWork.calendarMs, language)} ·
                  {localize(language, "التوقف", "Paused")} {durationFor(event.timing.pause.calendarMs, language)}
                </Text>
              ) : null}
              {event.legacySourceId ? (
                <Text style={[styles.eventWarning, textStyle]}>
                  {localize(language, "افتتاحي تاريخي", "Historical opening")} #{event.legacySourceId} — {localize(language, "لا تقاس إنتاجيته", "productivity is not measured")}
                </Text>
              ) : null}
              {event.incomplete ? (
                <Text style={[styles.eventWarning, textStyle]}>{localize(language, "بيانات وقت غير مكتملة", "Incomplete time data")}</Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function StageTotalsTable({ report }: { report: CustodyReport }) {
  const { language } = useLanguage();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  const headers = isEnglish(language)
    ? ["Stage", "Opening balance", "Confirmed inbound", "Confirmed outbound", "Pending sent", "Documented closure", "Remaining / liability"]
    : ["المرحلة", "رصيد البداية", "وارد مؤكد", "صادر مؤكد", "مرسل معلق", "إغلاق موثق", "المتبقي / المسؤولية"];
  return (
    <View style={styles.tableCard}>
      <Text style={styles.tableTitle}>
        {localize(language, "إجماليات كل مرحلة — عهدة وحركة وليست إنتاجاً جديداً", "Totals by stage — custody movement, not new production")}
      </Text>
      <Text style={styles.tableNotice}>
        {localize(language, "رصيد البداية + الوارد المؤكد − الصادر المؤكد − الإغلاق الموثق = المتبقي. المرسل المعلق لا يخصم قبل تأكيد الاستلام.", "Opening balance + confirmed inbound − confirmed outbound − documented closure = remaining. Pending sent quantities are not deducted until receipt is confirmed.")}
      </Text>
      <View style={styles.compactHeading}>
        {headers.map((label) => (
          <Text key={label} style={styles.compactHeadCell}>
            {label}
          </Text>
        ))}
      </View>
      {report.stageTotals.map((total) => (
        <View key={total.stage} style={styles.compactRow}>
          <Text style={styles.compactHeadCell}>
            {stageFor(total.stage, language)}
            {total.invalidQuantityCount
              ? ` · ${localize(language, "كمية غير صالحة", "Invalid quantity")} (${total.invalidQuantityCount.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA")})`
              : ""}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.openingPairs, language)}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.confirmedInboundPairs, language)}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.confirmedOutboundPairs, language)}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.pendingOutboundPairs, language)}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.releasedPairs, language)}
          </Text>
          <Text style={styles.compactHeadCell}>
            {pairsFor(total.remainingPairs, language)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TransferTable({ events }: { events: CustodyReportEvent[] }) {
  const { language } = useLanguage();
  return (
    <EventTable
      title={localize(language, "جدول التحويلات الموحد — صف واحد لكل معرف تحويل", "Unified transfer table — one row per transfer ID")}
      events={events}
    />
  );
}

function SettingsPanel({
  settings,
  onChange,
  onSave,
  saving,
}: {
  settings: CustodySettings;
  onChange: (settings: CustodySettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { language } = useLanguage();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  const updateLimit = (
    stage: CustodyStage,
    field: "workHours" | "confirmationHours",
    raw: string,
  ) => {
    const numeric = Number(raw);
    const current = settings.stageLimits[stage] || {
      workHours: 0,
      confirmationHours: 0,
    };
    onChange({
      ...settings,
      stageLimits: {
        ...settings.stageLimits,
        [stage]: {
          ...current,
          [field]: Number.isFinite(numeric) ? numeric : 0,
        },
      },
    });
  };
  const updateShift = (
    index: number,
    field: "name" | "start" | "end" | "days",
    raw: string,
  ) => {
    const shifts = settings.shifts.map((shift, current) =>
      current !== index
        ? shift
        : {
            ...shift,
            [field]:
              field === "days"
                ? raw
                    .split(",")
                    .map((item) => Number(item.trim()))
                    .filter(
                      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
                    )
                : raw,
          },
    );
    onChange({ ...settings, shifts });
  };
  return (
    <View style={styles.settingsCard}>
      <Text style={[styles.sectionTitle, textStyle]}>{localize(language, "إعدادات قياس الوقت", "Time measurement settings")}</Text>
      <Text style={[styles.settingNotice, textStyle]}>
        {localize(language, "لا تُفترض ورديات أو عطلات. الزمن ضمن الدوام لا يظهر إلا من الإعدادات الصحيحة المحفوظة.", "No shifts or holidays are assumed. Business time appears only from valid saved settings.")}
      </Text>
      <TouchableOpacity
        style={[
          styles.outlineButton,
          {
            alignSelf: isEnglish(language) ? "flex-start" : "flex-end",
            flexDirection: rowDirection(language),
          },
        ]}
        onPress={() => onChange({ ...settings, enabled: !settings.enabled })}
      >
        <Text style={[styles.outlineText, textStyle]}>
          {settings.enabled
            ? localize(language, "سياسة التنبيهات مفعلة — اضغط للإيقاف", "Alert policy is enabled — tap to disable")
            : localize(language, "سياسة التنبيهات متوقفة — اضغط للتفعيل", "Alert policy is disabled — tap to enable")}
        </Text>
      </TouchableOpacity>
      <Text style={[styles.schedulePending, textStyle]}>
        {localize(language, "تنبيهات الخلفية تتطلب نشر النسخة وربط المجدول؛ حفظ الحدود وحده لا يفعّل التنبيهات.", "Background alerts require a deployed build and a connected scheduler; saving limits alone does not enable alerts.")}
      </Text>
      <Text style={[styles.subheading, textStyle]}>
        {localize(language, "حدود كل مرحلة (ساعات العمل / تأكيد الاستلام)", "Limits by stage (work hours / receipt confirmation)")}
      </Text>
      {STAGES.map(([stage, label]) => {
        const limit = settings.stageLimits[stage] || {
          workHours: 0,
          confirmationHours: 0,
        };
        return (
          <View
            key={stage}
            style={[styles.settingRow, { flexDirection: rowDirection(language) }]}
          >
            <Text style={[styles.settingStage, textStyle]}>{stageFor(stage, language)}</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={String(limit.workHours)}
              onChangeText={(text) => updateLimit(stage, "workHours", text)}
              style={styles.smallInput}
              placeholder={localize(language, "عمل", "Work")}
            />
            <TextInput
              keyboardType="decimal-pad"
              value={String(limit.confirmationHours)}
              onChangeText={(text) =>
                updateLimit(stage, "confirmationHours", text)
              }
              style={styles.smallInput}
              placeholder={localize(language, "تأكيد", "Confirm")}
            />
          </View>
        );
      })}
      <Text style={[styles.subheading, textStyle]}>
        {localize(language, "الورديات (الأيام: 0 الأحد إلى 6 السبت)", "Shifts (days: 0 Sunday to 6 Saturday)")}
      </Text>
      {settings.shifts.map((shift, index) => (
        <View style={styles.shiftBox} key={`${shift.name}-${index}`}>
          <View
            style={[styles.shiftLine, { flexDirection: rowDirection(language) }]}
          >
            <TextInput
              value={shift.name}
              onChangeText={(text) => updateShift(index, "name", text)}
              style={styles.shiftName}
              placeholder={localize(language, "اسم الوردية", "Shift name")}
            />
            <TouchableOpacity
              onPress={() =>
                onChange({
                  ...settings,
                  shifts: settings.shifts.filter(
                    (_, current) => current !== index,
                  ),
                })
              }
            >
              <MaterialIcons name="delete-outline" size={20} color="#b91c1c" />
            </TouchableOpacity>
          </View>
          <View
            style={[styles.shiftLine, { flexDirection: rowDirection(language) }]}
          >
            <TextInput
              value={shift.start}
              onChangeText={(text) => updateShift(index, "start", text)}
              style={styles.smallInput}
              placeholder="08:00"
            />
            <TextInput
              value={shift.end}
              onChangeText={(text) => updateShift(index, "end", text)}
              style={styles.smallInput}
              placeholder="16:00"
            />
            <TextInput
              value={shift.days.join(",")}
              onChangeText={(text) => updateShift(index, "days", text)}
              style={styles.daysInput}
              placeholder="0,1,2,3,4"
            />
          </View>
        </View>
      ))}
      <TouchableOpacity
        onPress={() =>
          onChange({
            ...settings,
            shifts: [
              ...settings.shifts,
              { name: "", start: "", end: "", days: [] },
            ],
          })
        }
        style={[
          styles.outlineButton,
          {
            alignSelf: isEnglish(language) ? "flex-start" : "flex-end",
            flexDirection: rowDirection(language),
          },
        ]}
      >
        <MaterialIcons name="add" size={18} color="#075985" />
        <Text style={[styles.outlineText, textStyle]}>{localize(language, "إضافة وردية", "Add shift")}</Text>
      </TouchableOpacity>
      <Text style={[styles.subheading, textStyle]}>{localize(language, "العطلات (YYYY-MM-DD، مفصولة بفاصلة)", "Holidays (YYYY-MM-DD, comma-separated)")}</Text>
      <TextInput
        value={settings.holidays.join(",")}
        onChangeText={(text) =>
          onChange({
            ...settings,
            holidays: text
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          })
        }
        style={[
          styles.fullInput,
          {
            writingDirection: writingDirection(language),
            textAlign: textAlignFor(language),
          },
        ]}
        placeholder="2026-06-15, 2026-06-16"
      />
      <TouchableOpacity
        disabled={saving}
        onPress={onSave}
        style={[
          styles.primaryButton,
          { flexDirection: rowDirection(language) },
          saving && styles.disabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <MaterialIcons name="save" size={19} color="#fff" />
            <Text style={[styles.primaryButtonText, textStyle]}>
              {localize(language, "حفظ الإعدادات بعد تأكيد الخادم", "Save settings after server confirmation")}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function CustodyReportsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useAuth();
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  const today = useMemo(riyadhToday, []);
  const params = useLocalSearchParams<{ startDate?: string; endDate?: string }>();
  const initialStart = reportDate(params.startDate);
  const initialEnd = reportDate(params.endDate);
  const [period, setPeriod] = useState<ReportPeriod>(initialStart && initialEnd ? "custom" : "daily");
  const [startDate, setStartDate] = useState(initialStart || today);
  const [endDate, setEndDate] = useState(initialEnd || today);
  const [department, setDepartment] = useState("");
  const [accountId, setAccountId] = useState<number | undefined>();
  const [product, setProduct] = useState("");
  const [batch, setBatch] = useState("");
  const [quality, setQuality] = useState<CustodyQuality | "">("");
  const [status, setStatus] = useState<
    CustodyStatus | "pending" | "confirmed" | "disputed" | "rejected" | ""
  >("");
  const [batches, setBatches] = useState<CustodyBatch[]>([]);
  const [accounts, setAccounts] = useState<CustodyAccount[]>([]);
  const [settings, setSettings] = useState<CustodySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [drill, setDrill] = useState<DrillMetric>(null);
  const [exporting, setExporting] = useState(false);
  const supervisor = user?.role === "admin";
  const stageOptions = useMemo(
    () => STAGES.map(([stage, label]) => [stage, isEnglish(language) ? custodyStageEnglish[stage] || label : label] as const),
    [language],
  );
  const qualityOptions = useMemo(
    () => QUALITIES.map(([quality, label]) => [quality, isEnglish(language) ? custodyQualityEnglish[quality] || label : label] as const),
    [language],
  );
  const statusOptions = useMemo(
    () => [
      ...STATUSES.map(([item, label]) => [item, isEnglish(language) ? custodyStatusEnglish[item] || label : label] as const),
      ["pending", statusLabel("pending", language)],
      ["confirmed", statusLabel("confirmed", language)],
      ["disputed", statusLabel("disputed", language)],
      ["rejected", statusLabel("rejected", language)],
    ] as [typeof status, string][],
    [language],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextBatches, nextAccounts, nextSettings] = await Promise.all([
        custodyService.list(),
        custodyService.accounts.list(),
        custodyService.settings(),
      ]);
      setBatches(nextBatches);
      setAccounts(nextAccounts);
      setSettings(nextSettings);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : localize(language, "تعذر تحميل تقرير العهد.", "Unable to load the custody report."),
      );
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void load();
  }, [load]);

  const filters = useMemo<CustodyReportFilters>(
    () => ({
      startDate,
      endDate,
      period,
      department: department || undefined,
      accountId,
      product,
      batch,
      quality: quality || undefined,
      status: status || undefined,
    }),
    [
      startDate,
      endDate,
      period,
      department,
      accountId,
      product,
      batch,
      quality,
      status,
    ],
  );
  const reportResult = useMemo<{
    report: CustodyReport | null;
    calculationError: string;
  }>(() => {
    try {
      return {
        report: buildCustodyReport({ batches, accounts, settings, filters }),
        calculationError: "",
      };
    } catch (reportError) {
      return {
        report: null,
        calculationError:
          reportError instanceof Error
            ? reportError.message
            : localize(language, "تعذر احتساب التقرير.", "Unable to calculate the report."),
      };
    }
  }, [batches, accounts, settings, filters, language]);
  const report = reportResult.report;

  const applyPeriod = (next: ReportPeriod) => {
    setPeriod(next);
    if (next === "daily") {
      setStartDate(today);
      setEndDate(today);
    }
    if (next === "weekly") {
      setStartDate(addDays(today, -6));
      setEndDate(today);
    }
    if (next === "monthly") {
      setStartDate(firstOfMonth(today));
      setEndDate(today);
    }
  };

  const selectDrill = (next: DrillMetric) =>
    setDrill((current) => (current === next ? null : next));
  const drilledEvents = useMemo(() => {
    if (!report || !drill) return [];
    if (drill === "received")
      return report.events.filter(
        (event) =>
          event.action === "received" ||
          (event.source === "transfer" && event.status === "confirmed"),
      );
    if (drill === "completed")
      return report.events.filter(
        (event) => event.action === "complete" || event.source === "progress",
      );
    if (drill === "confirmed")
      return report.transfers.filter((event) => event.status === "confirmed");
    if (drill === "pending")
      return report.transfers.filter((event) => event.status === "pending");
    return report.events.filter((event) =>
      [
        "received",
        "working",
        "paused",
        "completed",
        "sent",
        "disputed",
      ].includes(event.status || ""),
    );
  }, [drill, report]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await custodyService.saveSettings(settings);
      showMessage(localize(language, "تم الحفظ", "Saved"), localize(language, "أكد الخادم حفظ إعدادات الوقت.", "The server confirmed the time settings were saved."));
      await load();
    } catch (saveError) {
      showMessage(
        localize(language, "تعذر الحفظ", "Unable to save"),
        saveError instanceof Error
          ? saveError.message
          : localize(language, "لم يؤكد الخادم الحفظ.", "The server did not confirm the save."),
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const printReport = async () => {
    if (!report) return;
    try {
      const html = reportPrintHtml(report);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow)
          throw new Error(
            localize(language, "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.", "Unable to open the print window. Allow pop-ups and try again."),
          );
        printWindow.opener = null;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
      } else
        await Print.printAsync({
          html,
          orientation: Print.Orientation.landscape,
        });
    } catch (printError) {
      showMessage(
        localize(language, "تعذر إنشاء PDF", "Unable to create PDF"),
        printError instanceof Error ? printError.message : localize(language, "فشلت الطباعة.", "Printing failed."),
      );
    }
  };

  const exportExcel = async () => {
    if (!report || exporting) return;
    setExporting(true);
    try {
      const result = await custodyService.exportExcel(filters);
      if (Platform.OS === "web") {
        const bytes = Uint8Array.from(atob(result.base64), (character) =>
          character.charCodeAt(0),
        );
        const url = URL.createObjectURL(
          new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const fs = await import("expo-file-system/legacy");
        const sharing = await import("expo-sharing");
        const uri = `${fs.cacheDirectory}${result.name}`;
        await fs.writeAsStringAsync(uri, result.base64, {
          encoding: fs.EncodingType.Base64,
        });
        if (await sharing.isAvailableAsync())
          await sharing.shareAsync(uri, {
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: localize(language, "تقرير العهد", "Custody report"),
          });
        else throw new Error(localize(language, "المشاركة غير متاحة على هذا الجهاز", "Sharing is unavailable on this device"));
      }
    } catch (error) {
      showMessage(
        localize(language, "تعذر التصدير", "Unable to export"),
        error instanceof Error ? error.message : localize(language, "تعذر إنشاء ملف Excel", "Unable to create the Excel file"),
      );
    } finally {
      setExporting(false);
    }
  };

  const totals = useMemo(
    () =>
      report?.departments
        .flatMap((group) => group.employees)
        .reduce(
          (acc, employee) => ({
            received: acc.received + employee.totals.receivedPairs,
            completed: acc.completed + employee.totals.completedPairs,
            confirmed: acc.confirmed + employee.totals.confirmedOutboundPairs,
            pending: acc.pending + employee.totals.pendingOutboundPairs,
            open: acc.open + employee.totals.openCustodyPairs,
          }),
          { received: 0, completed: 0, confirmed: 0, pending: 0, open: 0 },
        ),
    [report],
  );

  const departments = useMemo(
    () =>
      [
        ...new Set(
          accounts
            .map((account) => departmentFor(account.department, language))
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, isEnglish(language) ? "en" : "ar")),
    [accounts, language],
  );

  return (
    <ScreenContainer
      containerClassName="bg-background"
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={[styles.header, { flexDirection: rowDirection(language) }]}>
        <BackButton onPress={() => router.back()} />
        <View style={[styles.headerText, { alignItems: isEnglish(language) ? "flex-start" : "flex-end" }]}>
          <Text style={[styles.headerTitle, textStyle]}>{localize(language, "التقارير الشاملة للعهد", "Comprehensive custody reports")}</Text>
          <Text style={[styles.headerSubtitle, textStyle]}>
            {localize(language, "السجلات الفعلية فقط — توقيت الرياض", "Actual records only — Riyadh time")}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void load()}
          style={styles.headerIcon}
          accessibilityLabel={localize(language, "تحديث", "Refresh")}
        >
          <MaterialIcons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.pageContent,
          { maxWidth: 1440, width: "100%", alignSelf: "center", direction: writingDirection(language) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.periodCard}>
          <Text style={[styles.sectionTitle, textStyle]}>{localize(language, "الفترة المرجعية للحركة", "Movement reference period")}</Text>
          <View style={[styles.periodRow, { flexDirection: rowDirection(language) }]}>
            {(["daily", "weekly", "monthly", "custom"] as ReportPeriod[]).map(
              (item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => applyPeriod(item)}
                  style={[
                    styles.periodButton,
                    period === item && styles.periodButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodText,
                      period === item && styles.periodTextActive,
                    ]}
                  >
                    {
                      {
                        daily: "يومي",
                        weekly: "أسبوعي",
                        monthly: "شهري",
                        custom: "مخصص",
                      }[item]
                    }
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
          <View style={[styles.dateRow, { flexDirection: rowDirection(language) }]}>
            <DateField
              value={startDate}
              onChange={(value) => {
                setPeriod("custom");
                setStartDate(value);
              }}
              label={localize(language, "من", "From")}
              isAr={!isEnglish(language)}
            />
            <DateField
              value={endDate}
              onChange={(value) => {
                setPeriod("custom");
                setEndDate(value);
              }}
              label={localize(language, "إلى (شامل اليوم)", "To (inclusive)")}
              isAr={!isEnglish(language)}
            />
          </View>
          <Text style={[styles.boundaryNote, textStyle]}>
            {localize(language, "يشمل التقرير اليوم المختار كاملاً: [00:00، 00:00 اليوم التالي) بتوقيت الرياض.", "The report includes the selected day in full: [00:00, 00:00 next day) Riyadh time.")}
          </Text>
        </View>

        <View style={styles.filterCard}>
          <Text style={[styles.sectionTitle, textStyle]}>{localize(language, "التصفية الدقيقة", "Detailed filters")}</Text>
          <SelectButtons
            label={localize(language, "القسم", "Department")}
            value={department}
            onChange={(value) => {
              setDepartment(value);
              setAccountId(undefined);
            }}
            allowAll
            options={departments.map((name) => [name, name] as const)}
          />
          <SelectButtons
            label={localize(language, "الموظف / الحساب", "Employee / account")}
            value={accountId ? String(accountId) : ""}
            onChange={(value) =>
              setAccountId(value ? Number(value) : undefined)
            }
            allowAll
            options={accounts
              .filter(
                (account) =>
                  !department ||
                  departmentFor(account.department, language) === department,
              )
              .map(
                (account) =>
                  [
                    String(account.id),
                    `${account.name} — ${departmentFor(account.department, language)}`,
                  ] as const,
              )}
          />
          <SelectButtons
            label={localize(language, "النخب", "Grade")}
            value={quality}
            onChange={(value) => setQuality(value as CustodyQuality | "")}
            allowAll
            options={qualityOptions}
          />
          <SelectButtons
            label={localize(language, "الحالة", "Status")}
            value={status}
            onChange={(value) => setStatus(value as typeof status)}
            allowAll
            options={statusOptions}
          />
          <TextInput
            value={product}
            onChangeText={setProduct}
            style={[styles.fullInput, { writingDirection: writingDirection(language) }]}
            placeholder={localize(language, "بحث بالصنف أو الرمز أو المقاس أو اللون", "Search by product, code, size, or color")}
            textAlign={textAlignFor(language)}
          />
          <TextInput
            value={batch}
            onChangeText={setBatch}
            style={[styles.fullInput, { writingDirection: writingDirection(language) }]}
            placeholder={localize(language, "بحث برقم الدفعة أو رقم التتبع", "Search by batch or tracking number")}
            textAlign={textAlignFor(language)}
          />
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#075985" />
            <Text style={[styles.muted, textStyle]}>{localize(language, "جارٍ تحميل السجلات من الخادم…", "Loading records from the server…")}</Text>
          </View>
        ) : null}
        {error || reportResult.calculationError ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={21} color="#b91c1c" />
            <Text style={styles.errorText}>
              {error || reportResult.calculationError}
            </Text>
          </View>
        ) : null}
        {report && !loading ? (
          <>
            <View style={[styles.actionRow, { flexDirection: rowDirection(language) }]}>
              <TouchableOpacity
                onPress={() => void printReport()}
                style={styles.printButton}
              >
                <MaterialIcons name="print" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>{localize(language, "طباعة / PDF", "Print / PDF")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={exporting}
                onPress={() => void exportExcel()}
                style={styles.csvButton}
              >
                <MaterialIcons name="file-download" size={20} color="#075985" />
                <Text style={styles.csvText}>
                  {exporting ? localize(language, "جارٍ إنشاء Excel…", "Creating Excel…") : "Excel (XLSX)"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.referenceNote, textStyle]}>
              {localize(language, "الإنتاج الأصلي للفترة:", "Original production for the period:")}{" "}
              {pairsFor(report.originalProductionPairs, language)} — {localize(language, "يُحسب مرة واحدة لكل دفعة، وليس عبر المراحل.", "counted once per batch, not across stages.")}
            </Text>
            {report.legacy.openingBatchCount ? (
              <Text style={[styles.legacyNote, textStyle]}>
                {localize(language, "عهد افتتاحية/مرحّلة مرتبطة:", "Linked opening / carried-forward custody:")}{" "}
                {report.legacy.openingBatchCount.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA")} (
                {pairsFor(report.legacy.openingPairs, language)})؛ {localize(language, "ليست إنتاجاً جديداً ولا تُنشئ إنتاجية تاريخية. روابط المصدر القديمة:", "not new production and does not create historical productivity. Legacy source links:")}{" "}
                {report.legacy.linkedLegacySourceCount.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA")}.
              </Text>
            ) : null}
            <View style={[styles.metricsGrid, { flexDirection: rowDirection(language) }]}>
              <MetricCard
                label={localize(language, "الوارد المؤكد", "Confirmed inbound")}
                value={pairsFor(totals?.received || 0, language)}
                selected={drill === "received"}
                onPress={() => selectDrill("received")}
              />
              <MetricCard
                label={localize(language, "المنجز بالقراءات", "Completed from readings")}
                value={pairsFor(totals?.completed || 0, language)}
                selected={drill === "completed"}
                onPress={() => selectDrill("completed")}
                tone="green"
              />
              <MetricCard
                label={localize(language, "الصادر المؤكد", "Confirmed outbound")}
                value={pairsFor(totals?.confirmed || 0, language)}
                selected={drill === "confirmed"}
                onPress={() => selectDrill("confirmed")}
                tone="green"
              />
              <MetricCard
                label={localize(language, "مرسل معلّق", "Pending sent")}
                value={pairsFor(totals?.pending || 0, language)}
                selected={drill === "pending"}
                onPress={() => selectDrill("pending")}
                tone="amber"
              />
              <MetricCard
                label={localize(language, "عهد مفتوحة", "Open custody")}
                value={pairsFor(totals?.open || 0, language)}
                selected={drill === "open"}
                onPress={() => selectDrill("open")}
                tone="red"
              />
            </View>
            <StageTotalsTable report={report} />
            <TransferTable events={report.transfers} />
            {drill ? (
              <EventTable
                title={localize(language, "تفاصيل الرقم المحدد — حركات فعلية", "Selected metric details — actual movements")}
                events={drilledEvents}
              />
            ) : null}
            <View style={styles.analyticsCard}>
              <Text style={[styles.sectionTitle, textStyle]}>
                {localize(language, "الجودة، الإتلاف، المخزون والعينات", "Quality, disposal, stock, and samples")}
              </Text>
              <Text style={[styles.analyticsText, textStyle]}>
                {localize(language, "نخب أول:", "First grade:")} {pairsFor(report.quality.firstPairs, language)} | {localize(language, "نخب ثانٍ:", "Second grade:")}{" "}
                {pairsFor(report.quality.secondPairs, language)} | {localize(language, "مشتبه:", "Suspected:")} {pairsFor(report.quality.suspectedPairs, language)} | {localize(language, "تالف مصنّف:", "Classified damaged:")}{" "}
                {pairsFor(report.quality.damagedPairs, language)}
              </Text>
              <Text style={[styles.analyticsText, textStyle]}>
                {localize(language, "الإتلاف: مستلم", "Disposal: received")} {pairsFor(report.disposal.receivedPairs, language)} |
                {localize(language, "معتمد", "approved")} {pairsFor(report.disposal.approvedPairs, language)} | {localize(language, "منفذ فقط", "executed only")}{" "}
                {pairsFor(report.disposal.executedPairs, language)}. {localize(language, "لا يُحسب تالفاً نهائياً قبل التنفيذ.", "It is not counted as finally damaged before execution.")}
              </Text>
              <Text style={[styles.analyticsText, textStyle]}>
                {localize(language, "وارد نهائي خلال الفترة:", "Final inbound during the period:")}{" "}
                {pairsFor(report.warehouseFinalStockPairs, language)} ({localize(language, "إدخال مخزني نهائي فقط", "finished-goods entry only")}) | {localize(language, "عينات ذات إثبات تسليم:", "Samples with delivery proof:")}{" "}
                {report.samplesWithDeliveryProof.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA")}
              </Text>
            </View>
            {report.warnings.length ? (
              <View style={styles.warningBox}>
                <Text style={[styles.warningTitle, textStyle]}>{localize(language, "تنبيهات سلامة القياس", "Measurement safety warnings")}</Text>
                {report.warnings.map((warning, index) => (
                  <Text style={styles.warningText} key={`${warning}-${index}`}>
                    • {systemWarningFor(warning, language)}
                  </Text>
                ))}
              </View>
            ) : null}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, textStyle]}>
                {localize(language, "التقرير الشامل حسب القسم ثم الموظف", "Comprehensive report by department, then employee")}
              </Text>
              <Text style={[styles.muted, textStyle]}>
                {localize(language, "الحركات أسفل اسم الموظف كما هي في السجل", "Movements appear under each employee exactly as recorded")}
              </Text>
            </View>
            {report.departments.length === 0 ? (
              <Text style={[styles.emptyText, textStyle]}>
                {localize(language, "لا توجد بيانات ضمن الفلاتر الحالية.", "No data matches the current filters.")}
              </Text>
            ) : (
              report.departments.map((group) => (
                <View key={group.department} style={styles.departmentCard}>
                  <Text style={[styles.departmentTitle, textStyle]}>{departmentFor(group.department, language)}</Text>
                  {group.employees.map((employee) => (
                    <View
                      key={employee.employeeId}
                      style={styles.employeeBlock}
                    >
                      <Text style={[styles.employeeName, textStyle]}>
                        {localize(language, "الموظف:", "Employee:")} {employee.employeeName}
                      </Text>
                      <Text style={[styles.employeeTotals, textStyle]}>
                        {localize(language, "مستلم", "Received")} {pairsFor(employee.totals.receivedPairs, language)} | {localize(language, "منجز", "Completed")} {pairsFor(employee.totals.completedPairs, language)} | {localize(language, "صادر مؤكد", "Confirmed outbound")} {pairsFor(employee.totals.confirmedOutboundPairs, language)}
                      </Text>
                      <Text style={[styles.employeeTotals, textStyle]}>
                        {localize(language, "مرسل معلّق", "Pending sent")} {pairsFor(employee.totals.pendingOutboundPairs, language)} | {localize(language, "عهد مفتوحة", "Open custody")} {pairsFor(employee.totals.openCustodyPairs, language)}
                      </Text>
                      <Text style={[styles.employeeTotals, textStyle]}>
                        {localize(language, "عمل فعلي:", "Actual work:")} {employee.totals.timeIncomplete ? localize(language, "بيانات وقت غير مكتملة", "Incomplete time data") : durationFor(employee.totals.manualWorkMs, language)} | {localize(language, "توقف:", "Paused:")} {employee.totals.timeIncomplete ? localize(language, "بيانات وقت غير مكتملة", "Incomplete time data") : durationFor(employee.totals.pauseMs, language)} | {localize(language, "إنتاجية السليم:", "Good-pair productivity:")} {employee.totals.productivityPairsPerHour === null ? localize(language, "بيانات وقت غير مكتملة", "Incomplete time data") : `${employee.totals.productivityPairsPerHour.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA", { maximumFractionDigits: 2 })} ${localize(language, "زوج/ساعة", "pairs/hour")}`}
                      </Text>
                      <Text style={[styles.balanceLine, textStyle]}>
                        {localize(language, "رصيد البداية", "Opening balance")} {pairsFor(employee.balance.openingPairs, language)} + {localize(language, "وارد مؤكد", "confirmed inbound")} {pairsFor(employee.balance.confirmedInboundPairs, language)} − {localize(language, "صادر مؤكد", "confirmed outbound")} {pairsFor(employee.balance.confirmedOutboundPairs, language)} = {localize(language, "مسؤولية النهاية", "ending liability")} {pairsFor(employee.balance.endingLiabilityPairs, language)}؛ {localize(language, "المرسل المعلق", "pending sent")} {pairsFor(employee.balance.pendingOutboundPairs, language)} {localize(language, "لا يُخصم مرتين.", "is not deducted twice.")}
                      </Text>
                      <Text style={[styles.employeeTotals, textStyle]}>
                        {localize(language, "سليم", "Good")} {pairsFor(employee.totals.goodCompletedPairs, language)} | {localize(language, "مشتبه", "Suspected")} {pairsFor(employee.totals.suspectedCompletedPairs, language)} | {localize(language, "تالف", "Damaged")} {pairsFor(employee.totals.damagedCompletedPairs, language)} | {localize(language, "إعادة عمل", "Rework")} {pairsFor(employee.totals.reworkCompletedPairs, language)} | {localize(language, "عينات", "Samples")} {pairsFor(employee.totals.sampleCompletedPairs, language)} | {localize(language, "دقائق العمل للزوج السليم", "Work minutes per good pair")} {employee.totals.workMinutesPerGoodPair?.toFixed(2) ?? localize(language, "غير محسوبة", "Not calculated")}
                      </Text>
                      <EventTable events={employee.events} />
                    </View>
                  ))}
                </View>
              ))
            )}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, textStyle]}>{localize(language, "تتبع الدفعات والفروع", "Batch and branch tracking")}</Text>
              <Text style={[styles.muted, textStyle]}>
                {localize(language, "يظهر الأصل والفروع للنخب/الضرر، دون دمجها.", "Shows originals and branches for grades/damage without merging them.")}
              </Text>
            </View>
            {report.timelines.map((timeline) => (
              <View key={timeline.batchId} style={styles.timelineCard}>
                <Text style={styles.timelineTitle}>
                  {timeline.trackingNumber} — {timeline.product}
                </Text>
                <Text style={[styles.timelineSummary, textStyle]}>
                  {localize(language, "الإنتاج الأصلي:", "Original production:")} {pairsFor(timeline.originalProductionPairs, language)} | {localize(language, "أول:", "First:")} {pairsFor(timeline.firstPairs, language)} | {localize(language, "ثانٍ:", "Second:")} {pairsFor(timeline.secondPairs, language)} | {localize(language, "إتلاف منفذ:", "Executed disposal:")} {pairsFor(timeline.executedDestroyedPairs, language)}
                </Text>
                {timeline.nodes.map((node) => (
                  <TimelineNode key={node.id} node={node} depth={0} language={language} />
                ))}
                {timeline.issues.map((issue) => (
                  <Text style={styles.eventWarning} key={issue}>
                    {issue}
                  </Text>
                ))}
              </View>
            ))}
            {supervisor ? (
              <SettingsPanel
                settings={settings}
                onChange={setSettings}
                onSave={() => void saveSettings()}
                saving={savingSettings}
              />
            ) : (
              <View style={styles.settingNoticeBox}>
                <Text style={[styles.settingNotice, textStyle]}>
                  {localize(language, "إعدادات الورديات وحدود الوقت مخصصة للأدمن فقط.", "Shift and time-limit settings are for administrators only.")}
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function TimelineNode({
  node,
  depth,
  language,
}: {
  node: CustodyReport["timelines"][number]["nodes"][number];
  depth: number;
  language: ScreenLanguage;
}) {
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) };
  return (
    <View
      style={[styles.timelineNode, isEnglish(language) ? { marginLeft: Math.min(depth, 5) * 8, borderLeftWidth: 2, borderLeftColor: "#7dd3fc", borderRightWidth: 0, paddingLeft: 8, paddingRight: 0 } : { marginRight: Math.min(depth, 5) * 8 }]}
    >
      <Text style={styles.nodeTitle}>
        {node.kind === "disposal" ? localize(language, "محضر إتلاف", "Disposal record") : stageFor(node.stage, language)} — {qualityFor(node.quality, language)} —{" "}
        {pairsFor(node.pairs, language)}
      </Text>
      <Text style={styles.nodeMeta}>
        {statusLabel(node.status, language)} | {node.owner || "—"} | {timeFor(node.at, language)}
      </Text>
      {node.detail ? (
        <Text style={styles.eventWarning}>{node.detail}</Text>
      ) : null}
      {node.children.map((child) => (
        <TimelineNode key={child.id} node={child} depth={depth + 1} language={language} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  compactHeading: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    backgroundColor: "#e0f2fe",
    padding: 6,
    gap: 6,
  },
  compactHeadCell: {
    flex: 1,
    minWidth: 115,
    color: "#075985",
    fontWeight: "800",
    fontSize: 10,
    textAlign: "right",
  },
  compactRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  compactCell: { flexGrow: 1, flexBasis: 170, minWidth: 120, gap: 3 },
  header: {
    backgroundColor: "#075985",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  headerText: { flex: 1, alignItems: "flex-end" },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  headerSubtitle: { color: "#dbeafe", fontSize: 11, marginTop: 2 },
  headerIcon: { padding: 8, borderRadius: 18, backgroundColor: "#ffffff28" },
  page: { flex: 1, backgroundColor: "#f8fafc" },
  pageContent: { padding: 12, paddingBottom: 34, gap: 12, direction: "rtl" },
  periodCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 12,
    padding: 12,
  },
  filterCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: "#172033",
    fontWeight: "900",
    fontSize: 15,
    textAlign: "right",
  },
  subheading: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 10,
    textAlign: "right",
  },
  muted: { color: "#64748b", fontSize: 11, textAlign: "right" },
  periodRow: {
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  periodButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  periodButtonActive: { backgroundColor: "#075985", borderColor: "#075985" },
  periodText: { color: "#475569", fontWeight: "800", fontSize: 12 },
  periodTextActive: { color: "#fff" },
  dateRow: { flexDirection: "row-reverse", gap: 10, marginTop: 10 },
  boundaryNote: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "right",
    marginTop: 8,
  },
  filterBlock: { gap: 4 },
  filterLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  horizontalScroll: { flexGrow: 0 },
  chipScroll: { flexDirection: "row-reverse", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#e0f2fe", borderColor: "#0284c7" },
  chipText: { color: "#475569", fontSize: 11 },
  chipTextActive: { color: "#075985", fontWeight: "900" },
  fullInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 40,
    color: "#172033",
    writingDirection: "rtl",
  },
  loading: { padding: 30, alignItems: "center", gap: 10 },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row-reverse",
    gap: 8,
    alignItems: "center",
  },
  errorText: { flex: 1, textAlign: "right", color: "#991b1b", fontSize: 12 },
  actionRow: { flexDirection: "row-reverse", gap: 8 },
  printButton: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: "#15803d",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 6,
  },
  csvButton: {
    flex: 1.15,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#075985",
    backgroundColor: "#fff",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row-reverse",
    gap: 6,
  },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  csvText: { color: "#075985", fontWeight: "900", fontSize: 12 },
  referenceNote: {
    color: "#075985",
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    padding: 9,
    textAlign: "right",
    fontSize: 12,
  },
  legacyNote: {
    color: "#7c2d12",
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    textAlign: "right",
    fontSize: 11,
    lineHeight: 17,
  },
  metricsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  metric: {
    width: "31.8%",
    minWidth: 102,
    flexGrow: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 10,
    padding: 9,
    alignItems: "flex-end",
  },
  metricSelected: {
    borderWidth: 2,
    borderColor: "#075985",
    backgroundColor: "#f0f9ff",
  },
  metricValue: {
    color: "#075985",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  greenText: { color: "#15803d" },
  amberText: { color: "#b45309" },
  redText: { color: "#b91c1c" },
  metricLabel: {
    fontSize: 10,
    color: "#475569",
    textAlign: "right",
    marginTop: 3,
  },
  drillHint: { fontSize: 9, color: "#64748b", marginTop: 3 },
  analyticsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 12,
    padding: 12,
    gap: 7,
  },
  analyticsText: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
  },
  warningBox: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    padding: 11,
    borderRadius: 10,
  },
  warningTitle: {
    textAlign: "right",
    color: "#92400e",
    fontWeight: "900",
    marginBottom: 4,
  },
  warningText: {
    textAlign: "right",
    color: "#92400e",
    fontSize: 11,
    lineHeight: 17,
  },
  sectionHeader: { gap: 2, marginTop: 4 },
  departmentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    overflow: "hidden",
  },
  departmentTitle: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
    fontWeight: "900",
    padding: 10,
    textAlign: "right",
  },
  employeeBlock: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 4,
  },
  employeeName: {
    color: "#172033",
    fontWeight: "900",
    fontSize: 14,
    textAlign: "right",
  },
  employeeTotals: {
    color: "#334155",
    fontSize: 11,
    textAlign: "right",
    lineHeight: 17,
  },
  balanceLine: {
    color: "#075985",
    backgroundColor: "#f0f9ff",
    padding: 7,
    borderRadius: 7,
    fontSize: 10,
    textAlign: "right",
    lineHeight: 16,
  },
  tableCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableNotice: {
    color: "#475569",
    backgroundColor: "#f8fafc",
    padding: 8,
    fontSize: 10,
    textAlign: "right",
    lineHeight: 16,
  },
  tableTitle: {
    backgroundColor: "#f1f5f9",
    color: "#172033",
    fontWeight: "900",
    padding: 8,
    textAlign: "right",
    fontSize: 12,
  },
  emptyText: { textAlign: "right", color: "#64748b", padding: 15 },
  eventRow: {
    padding: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 3,
  },
  eventTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  eventAction: {
    color: "#075985",
    fontWeight: "900",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  eventTime: { color: "#64748b", fontSize: 10, textAlign: "left" },
  eventBatch: {
    color: "#172033",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "right",
  },
  eventInfo: {
    color: "#475569",
    fontSize: 10,
    textAlign: "right",
    lineHeight: 15,
  },
  eventWarning: { color: "#b45309", fontSize: 10, textAlign: "right" },
  timelineCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4ee",
    borderRadius: 12,
    padding: 11,
    gap: 5,
  },
  timelineTitle: { color: "#172033", fontWeight: "900", textAlign: "right" },
  timelineSummary: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
  },
  timelineNode: {
    borderRightWidth: 2,
    borderRightColor: "#7dd3fc",
    paddingRight: 8,
    paddingVertical: 5,
    marginTop: 3,
  },
  nodeTitle: {
    color: "#075985",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  nodeMeta: { color: "#64748b", fontSize: 10, textAlign: "right" },
  settingsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  settingNoticeBox: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  settingNotice: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "right",
    marginTop: 6,
  },
  schedulePending: {
    color: "#92400e",
    backgroundColor: "#fffbeb",
    padding: 7,
    borderRadius: 6,
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },
  settingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  settingStage: { flex: 1, color: "#334155", fontSize: 12, textAlign: "right" },
  smallInput: {
    width: 67,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 11,
    color: "#172033",
    textAlign: "center",
  },
  shiftBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 7,
    marginTop: 6,
    gap: 6,
  },
  shiftLine: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  shiftName: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 11,
    textAlign: "right",
  },
  daysInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 11,
    textAlign: "center",
  },
  outlineButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#075985",
    borderRadius: 7,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  outlineText: { color: "#075985", fontWeight: "800", fontSize: 11 },
  primaryButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 11,
    backgroundColor: "#075985",
    flexDirection: "row-reverse",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.55 },
});
