import fs from "node:fs/promises";
import { getDb } from "../server/db.js";
import { sql } from "drizzle-orm";

type Row = Record<string, any>;
const text = (v: unknown) => String(v ?? "").trim();
const pairs = (row: Row, dozen: string, pair: string) => (Number(row[dozen]) || 0) * 12 + (Number(row[pair]) || 0);
const quantityLabel = (value: number) => `${value >= 0 ? "+" : "-"}${Math.floor(Math.abs(value) / 12)} درزن + ${Math.abs(value) % 12} زوج`;
const parseProductName = (value: unknown) => {
  const parts = text(value).split(" - ").map((part) => part.trim());
  return { name: parts[0] || text(value), size: parts[1] || "", color: parts.slice(2).join(" - ") || "" };
};

async function table(db: any, name: string): Promise<Row[]> {
  const result = await db.execute(sql.raw(`SELECT * FROM \`${name}\``));
  const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
  return Array.isArray(rows) ? rows as Row[] : [];
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  const [production, allStages, tracking] = await Promise.all([
    table(db, "production"),
    table(db, "manufacturingStages"),
    table(db, "productTracking"),
  ]);
  const stages = allStages.filter((r) => !r.deletedAt);
  const productionById = new Map(production.map((r) => [Number(r.id), r]));
  const sourceByProduction = new Map<number, Row[]>();
  for (const row of stages.filter((r) => text(r.stageName) === "production" && Number(r.productionId) > 0)) {
    const list = sourceByProduction.get(Number(row.productionId)) ?? [];
    list.push(row);
    sourceByProduction.set(Number(row.productionId), list);
  }

  const quantityMismatches: any[] = [];
  const missingSource: any[] = [];
  const duplicateSource: any[] = [];
  const identityMismatches: any[] = [];
  for (const p of production) {
    const sources = sourceByProduction.get(Number(p.id)) ?? [];
    if (!sources.length) {
      missingSource.push({ productionId: p.id, date: p.date, machine: p.machineNumber, product: p.productName, quantity: pairs(p, "productionDozen", "productionPairs") });
      continue;
    }
    if (sources.length > 1) duplicateSource.push({ productionId: p.id, sourceStageIds: sources.map((r) => r.id) });
    const sourceQuantity = sources.reduce((sum, r) => sum + pairs(r, "quantityDozen", "quantityPair"), 0);
    const productionQuantity = pairs(p, "productionDozen", "productionPairs");
    if (sourceQuantity !== productionQuantity) {
      quantityMismatches.push({ productionId: p.id, product: p.productName, productionQuantity, sourceQuantity, difference: sourceQuantity - productionQuantity, differenceLabel: quantityLabel(sourceQuantity - productionQuantity), sourceStageIds: sources.map((r) => r.id) });
    }
    const source = sources[0];
    const identity = parseProductName(p.productName);
    for (const [label, productionValue, stageValue] of [["اسم المنتج", identity.name, parseProductName(source.productName).name], ["المقاس", identity.size, source.productSize], ["اللون", identity.color, source.productColor]] as const) {
      if (text(productionValue) && text(stageValue) && text(productionValue) !== text(stageValue)) identityMismatches.push({ productionId: p.id, field: label, productionValue, stageValue, sourceStageId: source.id });
    }
  }

  const unlinkedStages = stages.filter((r) => !Number(r.productionId));
  const linkedStageCounts: Record<string, number> = {};
  const linkedQuantityByStage: Record<string, number> = {};
  for (const row of stages.filter((r) => Number(r.productionId) > 0)) {
    linkedStageCounts[text(row.stageName)] = (linkedStageCounts[text(row.stageName)] || 0) + 1;
    linkedQuantityByStage[text(row.stageName)] = (linkedQuantityByStage[text(row.stageName)] || 0) + pairs(row, "quantityDozen", "quantityPair");
  }
  const unlinkedReasons = unlinkedStages.reduce((acc: Record<string, number>, row) => {
    const type = text(row.productType);
    const reason = row.deletedAt ? "deleted" : text(row.stageName) === "production" && type.startsWith("AUTO_PROD:") ? "source_not_matched" : type.startsWith("AUTO_STAGE:") ? "auto_parent_unlinked" : "legacy_or_manual";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  const unlinkedByReasonAndDate = unlinkedStages.reduce((acc: Record<string, Record<string, number>>, row) => {
    const type = text(row.productType);
    const reason = row.deletedAt ? "deleted" : text(row.stageName) === "production" && type.startsWith("AUTO_PROD:") ? "source_not_matched" : type.startsWith("AUTO_STAGE:") ? "auto_parent_unlinked" : "legacy_or_manual";
    const date = text(row.date) || "غير محدد";
    acc[reason] ??= {};
    acc[reason][date] = (acc[reason][date] || 0) + 1;
    return acc;
  }, {});
  const unlinkedDetails = unlinkedStages
    .filter((row) => text(row.stageName) === "production" && text(row.productType).startsWith("AUTO_PROD:"))
    .map((row) => {
      const [, date, machine, shift] = text(row.productType).split(":");
      const candidates = production.filter((p) => text(p.date) === date && text(p.machineNumber) === machine && String(p.shiftNumber ?? "") === shift);
      return {
        id: row.id,
        date: row.date,
        product: row.productName,
        quantity: pairs(row, "quantityDozen", "quantityPair"),
        productType: row.productType,
        productionCandidates: candidates.map((p) => ({ id: p.id, product: p.productName, quantity: pairs(p, "productionDozen", "productionPairs") })),
      };
    });
  const missingByDate = missingSource.reduce((acc: Record<string, { records: number; pairs: number }>, row) => {
    const key = text(row.date) || "غير محدد";
    acc[key] ??= { records: 0, pairs: 0 };
    acc[key].records += 1;
    acc[key].pairs += Number(row.quantity) || 0;
    return acc;
  }, {});
  const linkedTracking = tracking.filter((r) => Number(r.productionId) > 0).length;
  const report = {
    generatedAt: new Date().toISOString(),
    counts: { production: production.length, activeStages: stages.length, allStages: allStages.length, tracking: tracking.length, linkedProductionIds: sourceByProduction.size, linkedStages: stages.length - unlinkedStages.length, unlinkedStages: unlinkedStages.length, linkedTracking, unlinkedTracking: tracking.length - linkedTracking },
    quantities: { productionPairs: production.reduce((s, r) => s + pairs(r, "productionDozen", "productionPairs"), 0), sourceStagePairs: stages.filter((r) => text(r.stageName) === "production").reduce((s, r) => s + pairs(r, "quantityDozen", "quantityPair"), 0), linkedStagePairsByStage: linkedQuantityByStage },
    coverage: { linkedStageCounts, unlinkedReasons, unlinkedByReasonAndDate, unlinkedDetails, missingByDate },
    reconciliation: { missingSource, duplicateSource, quantityMismatches, identityMismatches },
  };
  await fs.mkdir("/tmp/sultan-reconcile", { recursive: true });
  await fs.writeFile("/tmp/sultan-reconcile/by-production-id.json", JSON.stringify(report, null, 2));
  const md = `# تقرير المطابقة النهائي بالمعرف الأصلي\n\nتاريخ التحليل: ${new Date().toISOString()}\n\n## الخلاصة\n\nتمت المطابقة على **productionId** وليس على اسم المنتج؛ لذلك لا تُجمع سجلات المراحل المختلفة معاً على أنها إنتاج جديد.\n\n| المؤشر | العدد |\n|---|---:|\n| سجلات الإنتاج | ${report.counts.production} |\n| مراحل التصنيع الفعالة | ${report.counts.activeStages} |\n| معرفات الإنتاج التي لها عهدة بداية مرتبطة | ${report.counts.linkedProductionIds} |\n| مراحل مرتبطة بإنتاج أصلي | ${report.counts.linkedStages} |\n| مراحل غير مرتبطة | ${report.counts.unlinkedStages} |\n| سجلات التتبع المرتبطة | ${report.counts.linkedTracking} |\n| سجلات التتبع القديمة غير المرتبطة | ${report.counts.unlinkedTracking} |\n\n## مطابقة كميات الإنتاج مع عهدة البداية\n\n- إجمالي الإنتاج: **${report.quantities.productionPairs} زوج**.\n- إجمالي عهد البداية المسجلة: **${report.quantities.sourceStagePairs} زوج**.\n- سجلات الإنتاج بلا عهدة بداية: **${missingSource.length}**.\n- فروقات كمية بعد الربط بالمعرف: **${quantityMismatches.length}**.\n- عهد بداية مكررة لنفس الإنتاج: **${duplicateSource.length}**.\n- اختلافات اسم/مقاس/لون داخل العهدة المرتبطة: **${identityMismatches.length}**.\n\n## تفسير السجلات غير المرتبطة\n\n| السبب | العدد | الإجراء |\n|---|---:|---|\n${Object.entries(unlinkedReasons).map(([k, v]) => `| ${k} | ${v} | لا تُسمح لها بحركة جديدة في المسار الآلي |`).join("\\n")}\n\n## فروقات الكميات\n\n| معرف الإنتاج | المنتج | إنتاج بالأزواج | عهدة البداية بالأزواج | الفرق |\n|---:|---|---:|---:|---|\n${quantityMismatches.slice(0, 100).map((r) => `| ${r.productionId} | ${r.product} | ${r.productionQuantity} | ${r.sourceQuantity} | ${r.differenceLabel} |`).join("\\n") || "| لا توجد فروقات بعد الربط | — | 0 | 0 | ±0 |"}\n\n## الإجراء البرمجي المطبق\n\n1. أضيف **productionId** إلى كل حركة تتبع وكل عهدة مرحلة.\n2. حفظ الإنتاج الدفعي يعيد قراءة كل سجل منشأ ويربط عهدة الروسو بالمعرف الصحيح، بدلاً من الاعتماد على اسم المنتج أو رقم إدخال واحد.\n3. كل حركة لاحقة تنسخ productionId والاسم والمقاس واللون والكمية من السجل المصدر.\n4. أُغلق الإدخال اليدوي من مراحل التسليم في المسار الآلي.\n5. الاستلام والتسليم والتخزين يرفض أي سجل آلي لا يملك رابط إنتاج أصلياً، وتظهر رسالة واضحة للمستخدم.\n6. السجلات التاريخية غير القابلة للمطابقة لم تُحذف؛ عُزلت ومنعت من إنشاء حركات جديدة حتى لا تختلط بالبيانات الصحيحة.\n\n## ملفات النتائج\n\nالتفاصيل الآلية الكاملة محفوظة في \/tmp\/sultan-reconcile\/by-production-id.json.\n`;
  await fs.writeFile("/tmp/sultan-reconcile/by-production-id.md", md);
  console.log(JSON.stringify({ counts: report.counts, quantities: report.quantities, reconciliation: { missingSource: missingSource.length, quantityMismatches: quantityMismatches.length, duplicateSource: duplicateSource.length, identityMismatches: identityMismatches.length }, output: "/tmp/sultan-reconcile/by-production-id.md" }, null, 2));
  process.exit(0);
}
main().catch((error) => { console.error(error); process.exit(1); });
