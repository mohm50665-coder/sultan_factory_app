import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { custodyService } from "@/lib/services/custody.service";
import { useLanguage } from "@/lib/language-context";
import {
  custodyStageEnglish,
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "@/lib/i18n/runtime";
import {
  buildCustodyReport,
  custodyReportSummary,
  formatPairs,
  type CustodyReport,
} from "@shared/custody-reporting";

/** Independent source state: a failing custody source is never represented as an artificial zero. */
export function CustodySummaryPanel({
  startDate,
  endDate,
  allDates = false,
}: {
  startDate: string;
  endDate: string;
  allDates?: boolean;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const direction = writingDirection(language);
  const textAlign = textAlignFor(language);
  const textStyle = { textAlign, writingDirection: direction };
  const rowDirection = english ? "row" : "row-reverse";
  const [report, setReport] = useState<CustodyReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      custodyService.list(),
      custodyService.accounts.list(),
      custodyService.settings(),
    ])
      .then(([batches, accounts, settings]) => {
        if (active)
          setReport(
            buildCustodyReport({
              batches,
              accounts,
              settings,
              filters: {
                startDate: allDates ? "1970-01-01" : startDate,
                endDate: allDates ? "2099-12-31" : endDate,
              },
            }),
          );
      })
      .catch(
        (error) =>
          active &&
          setError(error instanceof Error ? error.message : "تعذر تحميل العهد"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [startDate, endDate, allDates]);
  const summary = useMemo(
    () => (report ? custodyReportSummary(report) : null),
    [report],
  );
  const displayPairs = (pairs: number) => {
    if (!english) return formatPairs(pairs);
    if (!Number.isFinite(pairs)) return "Invalid quantity — review required";
    const dozen = pairs >= 0 ? Math.floor(pairs / 12) : Math.ceil(pairs / 12);
    const remaining = Math.abs(pairs - dozen * 12);
    const unit = (value: number, singular: string, plural: string) =>
      Math.abs(value) === 1 ? singular : plural;
    return `${pairs.toLocaleString("en-US")} ${unit(pairs, "pair", "pairs")} (${dozen.toLocaleString("en-US")} ${unit(dozen, "dozen", "dozens")} and ${remaining.toLocaleString("en-US")} ${unit(remaining, "pair", "pairs")})`;
  };
  return (
    <View style={[styles.card, { direction }]}>
      <View style={[styles.top, { flexDirection: rowDirection }]}>
        <Text style={[styles.title, textStyle]}>
          {localize(
            language,
            "الاستلام والتسليم — الدورة المترابطة الجديدة",
            "Receipt and handover — new connected cycle",
          )}
        </Text>
        <TouchableOpacity
          style={styles.button}
          accessibilityLabel={localize(
            language,
            "التفاصيل والطباعة وExcel",
            "Details, print and Excel",
          )}
          onPress={() =>
            router.push({
              pathname: "/custody-reports",
              params: {
                startDate: allDates ? "1970-01-01" : startDate,
                endDate: allDates ? "2099-12-31" : endDate,
              },
            } as never)
          }
        >
          <Text style={[styles.buttonText, textStyle]}>
            {localize(
              language,
              "التفاصيل والطباعة وExcel",
              "Details, print and Excel",
            )}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.note, textStyle]}>
        {localize(
          language,
          "إنتاج هذه الدفعات محفوظ في بيانات الإنتاج أعلاه؛ لا يضاف مرة ثانية. الأرقام التالية حركة عهد بين الأقسام، وليست إنتاجًا جديدًا.",
          "Production for these batches is retained in the production data above and is not added a second time. The figures below are custody movements between departments, not new production.",
        )}
      </Text>
      {loading ? (
        <ActivityIndicator
          color="#075985"
          accessibilityLabel={localize(
            language,
            "جارٍ تحميل ملخص العهد",
            "Loading custody summary",
          )}
        />
      ) : error ? (
        <Text accessibilityRole="alert" style={[styles.error, textStyle]}>
          {localize(
            language,
            "لم يكتمل تحميل هذا المصدر: ",
            "This source could not be loaded: ",
          )}
          {english
            ? localize(
                language,
                "تعذر تحميل العهد",
                "Unable to load custody data",
              )
            : error}
        </Text>
      ) : summary && report ? (
        <>
          <View style={[styles.grid, { flexDirection: rowDirection }]}>
            {[
              [
                localize(language, "استلام مؤكد", "Confirmed receipt"),
                summary.receivedPairs,
              ],
              [
                localize(
                  language,
                  "إنجاز فعلي بالقراءات",
                  "Completed from readings",
                ),
                summary.completedPairs,
              ],
              [
                localize(language, "تسليم مؤكد", "Confirmed outbound"),
                summary.confirmedOutboundPairs,
              ],
              [
                localize(language, "مرسل معلق", "Pending outbound"),
                summary.pendingOutboundPairs,
              ],
              [
                localize(
                  language,
                  "مسؤولية مفتوحة عند نهاية الفترة",
                  "Open responsibility at period end",
                ),
                summary.openCustodyPairs,
              ],
              [
                localize(
                  language,
                  "وارد مخزني معتمد",
                  "Approved warehouse inbound",
                ),
                summary.warehouseFinalStockPairs,
              ],
              [
                localize(language, "إتلاف منفذ", "Executed destruction"),
                summary.executedDestroyedPairs,
              ],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.metric}>
                <Text style={[styles.value, textStyle]}>
                  {displayPairs(Number(value))}
                </Text>
                <Text style={[styles.note, textStyle]}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.sectionTitle, textStyle]}>
            {localize(
              language,
              "إجماليات المراحل — نفس أرقام التقرير الشامل",
              "Stage totals — same figures as the full report",
            )}
          </Text>
          <Text style={[styles.note, textStyle]}>
            {localize(
              language,
              "رصيد البداية + الوارد المؤكد − الصادر المؤكد − الإغلاق الموثق = المتبقي. المرسل المعلق ظاهر منفصلاً ولا يُخصم قبل تأكيد الاستلام.",
              "Opening balance + confirmed inbound − confirmed outbound − documented closure = remaining. Pending outbound is shown separately and is not deducted before receipt is confirmed.",
            )}
          </Text>
          <View style={styles.stageTable}>
            <View
              style={[styles.stageHeading, { flexDirection: rowDirection }]}
            >
              <Text style={[styles.stageName, textStyle]}>
                {localize(language, "المرحلة", "Stage")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "بداية", "Opening")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "وارد", "Inbound")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "صادر", "Outbound")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "معلق", "Pending")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "إغلاق", "Closure")}
              </Text>
              <Text style={[styles.stageCell, textStyle]}>
                {localize(language, "متبقٍ", "Remaining")}
              </Text>
            </View>
            {summary.stageTotals.map((stage) => (
              <View
                key={stage.stage}
                style={[styles.stageRow, { flexDirection: rowDirection }]}
              >
                <Text style={[styles.stageName, textStyle]}>
                  {english
                    ? custodyStageEnglish[stage.stage] || stage.stage
                    : stage.stageLabel}
                  {stage.invalidQuantityCount
                    ? localize(
                        language,
                        ` · كمية غير صالحة (${stage.invalidQuantityCount})`,
                        ` · Invalid quantity (${stage.invalidQuantityCount})`,
                      )
                    : ""}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.openingPairs)}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.confirmedInboundPairs)}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.confirmedOutboundPairs)}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.pendingOutboundPairs)}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.releasedPairs)}
                </Text>
                <Text style={[styles.stageCell, textStyle]}>
                  {displayPairs(stage.remainingPairs)}
                </Text>
              </View>
            ))}
          </View>
          {report.departments.map((group) => (
            <View key={group.department}>
              <Text style={[styles.department, textStyle]}>
                {english
                  ? (() => {
                      const systemStage = summary.stageTotals.find(
                        (stage) => stage.stageLabel === group.department,
                      );
                      return systemStage
                        ? custodyStageEnglish[systemStage.stage] ||
                            systemStage.stage
                        : group.department;
                    })()
                  : group.department}
              </Text>
              {group.employees.map((employee) => (
                <View key={employee.employeeId} style={styles.employee}>
                  <Text style={[styles.employeeName, textStyle]}>
                    {employee.employeeName}
                  </Text>
                  <Text style={[styles.note, textStyle]}>
                    {localize(
                      language,
                      `مستلم ${displayPairs(employee.totals.receivedPairs)} · منجز ${displayPairs(employee.totals.completedPairs)} · صادر مؤكد ${displayPairs(employee.totals.confirmedOutboundPairs)} · معلق ${displayPairs(employee.totals.pendingOutboundPairs)}`,
                      `Received ${displayPairs(employee.totals.receivedPairs)} · Completed ${displayPairs(employee.totals.completedPairs)} · Confirmed outbound ${displayPairs(employee.totals.confirmedOutboundPairs)} · Pending ${displayPairs(employee.totals.pendingOutboundPairs)}`,
                    )}
                  </Text>
                </View>
              ))}
            </View>
          ))}
          {summary.employeesWithIncompleteTiming > 0 ? (
            <Text style={[styles.warning, textStyle]}>
              {localize(
                language,
                `${summary.employeesWithIncompleteTiming} موظفين لديهم بيانات وقت غير مكتملة؛ لا تعرض إنتاجية تقديرية لهم.`,
                `${summary.employeesWithIncompleteTiming} employees have incomplete time data; no estimated productivity is shown for them.`,
              )}
            </Text>
          ) : null}
          {!report.events.length ? (
            <Text style={[styles.note, textStyle]}>
              {localize(
                language,
                "لا توجد حركات في الدورة الجديدة ضمن الفترة؛ السجلات التاريخية تبقى في أقسامها ولا يتم نقلها أو تصفيرها تلقائيًا.",
                "There are no movements in the new cycle for this period. Historical records remain in their sections and are not moved or reset automatically.",
              )}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    padding: 10,
    gap: 7,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#172033",
    textAlign: "right",
    marginTop: 4,
  },
  stageTable: {
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 7,
    overflow: "hidden",
  },
  stageHeading: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    backgroundColor: "#e0f2fe",
    padding: 5,
    gap: 3,
  },
  stageRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    padding: 5,
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  stageName: {
    flexGrow: 2,
    flexBasis: 165,
    fontSize: 10,
    fontWeight: "800",
    color: "#075985",
    textAlign: "right",
  },
  stageCell: {
    flexGrow: 1,
    flexBasis: 90,
    fontSize: 9,
    color: "#334155",
    textAlign: "right",
  },
  top: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    minWidth: 200,
    fontSize: 14,
    fontWeight: "800",
    color: "#075985",
    textAlign: "right",
  },
  button: { backgroundColor: "#075985", borderRadius: 7, padding: 10 },
  buttonText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  note: { fontSize: 11, lineHeight: 17, color: "#475569", textAlign: "right" },
  grid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  metric: {
    flexGrow: 1,
    flexBasis: 160,
    padding: 8,
    backgroundColor: "#f0f9ff",
    borderRadius: 7,
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
    color: "#075985",
    textAlign: "right",
  },
  department: {
    backgroundColor: "#e0f2fe",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "right",
    color: "#075985",
    padding: 7,
  },
  employee: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  employeeName: {
    fontWeight: "800",
    fontSize: 12,
    color: "#172033",
    textAlign: "right",
  },
  warning: { color: "#92400e", fontSize: 11, textAlign: "right" },
  error: { color: "#b91c1c", fontSize: 12, textAlign: "right" },
});
