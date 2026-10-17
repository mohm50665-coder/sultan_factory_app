export type MaintenanceMachineOption = {
  code: string;
  nameAr: string;
  nameEn: string;
  locationAr: string;
  locationEn: string;
  category: "production" | "facilities" | "air-conditioning" | "it" | "printing";
};

/**
 * الدليل المرجعي لمعدات مصنع السلطان. مصدره: "حصر كامل للمكاين - 2" بتاريخ 4 أكتوبر 2026.
 * لا تُستخدم هذه القائمة لتعديل السجل التاريخي؛ هي فقط مرجع اختيار موحّد لسجلات الصيانة الجديدة.
 */
export const MAINTENANCE_MACHINE_INVENTORY: MaintenanceMachineOption[] = [
  ...["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((number) => ({
    code: `RS.${number}`,
    nameAr: "ماكينة حياكة روسو RC-U7FN-1",
    nameEn: "Rosso knitting machine RC-U7FN-1",
    locationAr: "الإنتاج",
    locationEn: "Production",
    category: "production" as const,
  })),
  ...["01", "02", "03", "04", "05", "06", "07", "08", "09"].map((number) => ({
    code: `RB.${number}`,
    nameAr: "ماكينة حياكة RB-6FTP-1",
    nameEn: "Knitting machine RB-6FTP-1",
    locationAr: "الإنتاج",
    locationEn: "Production",
    category: "production" as const,
  })),
  { code: "SO.01", nameAr: "ماكينة إنتاج SS-163-KT", nameEn: "Production machine SS-163-KT", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "SO.02", nameAr: "ماكينة إنتاج SS-163-KT", nameEn: "Production machine SS-163-KT", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "RS.8F.01", nameAr: "ماكينة حياكة 8F(FS)", nameEn: "Knitting machine 8F(FS)", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "NS.01", nameAr: "ماكينة New Star", nameEn: "New Star machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-01", nameAr: "ماكينة حياكة Manu Facturer", nameEn: "Manu Facturer knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-02", nameAr: "ماكينة حياكة JOLLY.S", nameEn: "JOLLY.S knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-03", nameAr: "ماكينة حياكة REG.TTA.S", nameEn: "REG.TTA.S knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-04", nameAr: "ماكينة حياكة JOLLY.S", nameEn: "JOLLY.S knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-05", nameAr: "ماكينة حياكة JOLLY", nameEn: "JOLLY knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-06", nameAr: "ماكينة حياكة JOLLY", nameEn: "JOLLY knitting machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-07", nameAr: "ماكينة تطريز A-1201", nameEn: "A-1201 embroidery machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-08", nameAr: "مخرطة متحركة YT-125", nameEn: "YT-125 mobile lathe", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-09", nameAr: "ماكينة إعادة تدوير الخيط DE-88", nameEn: "DE-88 yarn recycling machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "KN-010", nameAr: "ماكينة روسو لقلب الشراب", nameEn: "Rosso sock-turning machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "CLS-01", nameAr: "ماكينة تقفيل روسو", nameEn: "Rosso closing machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "CLS-02", nameAr: "ماكينة تقفيل روسو", nameEn: "Rosso closing machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "CLS-03", nameAr: "ماكينة روسو لتقفيل الشراب من أسفل", nameEn: "Rosso lower sock-closing machine", locationAr: "الإنتاج", locationEn: "Production", category: "production" },
  { code: "BRD-01", nameAr: "كاوية / ماكينة تشكيل", nameEn: "Ironing / shaping machine", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "BRD-02", nameAr: "كاوية متحركة", nameEn: "Mobile iron", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "BRD-03", nameAr: "كاوية متحركة", nameEn: "Mobile iron", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "BRD-04", nameAr: "كاوية متحركة", nameEn: "Mobile iron", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "BRD-05", nameAr: "كاوية متحركة", nameEn: "Mobile iron", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "MA-01", nameAr: "مغسلة بخار", nameEn: "Steam washer", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "MK-01", nameAr: "ماكينة مانع الانزلاق", nameEn: "Anti-slip printing machine", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "CMP-01", nameAr: "كمبروسر 1000 لتر", nameEn: "1000 L compressor", locationAr: "خلف صالة الإنتاج", locationEn: "Behind production hall", category: "facilities" },
  { code: "CMP-02", nameAr: "كمبروسر 500 لتر", nameEn: "500 L compressor", locationAr: "خلف صالة الإنتاج", locationEn: "Behind production hall", category: "facilities" },
  { code: "CMP-03", nameAr: "كمبروسر 500 لتر", nameEn: "500 L compressor", locationAr: "خلف صالة الإنتاج", locationEn: "Behind production hall", category: "facilities" },
  { code: "BLR-01", nameAr: "غلاية ديزل 300 لتر", nameEn: "300 L diesel boiler", locationAr: "خلف صالة الفرز", locationEn: "Behind sorting hall", category: "facilities" },
  { code: "ELP-01", nameAr: "لوحة توزيع الكهرباء", nameEn: "Electrical distribution panel", locationAr: "الإنتاج", locationEn: "Production", category: "facilities" },
  { code: "LB-01", nameAr: "ماكينة ليبل متحركة", nameEn: "Mobile label machine", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "LB-02", nameAr: "ماكينة ليبل ثابتة", nameEn: "Fixed label machine", locationAr: "صالة الفرز", locationEn: "Sorting hall", category: "production" },
  { code: "MO-01", nameAr: "موتور شفط 7.5 حصان", nameEn: "7.5 HP suction motor", locationAr: "خلف صالة الإنتاج", locationEn: "Behind production hall", category: "facilities" },
  { code: "MO-02", nameAr: "موتور شفط 10 حصان", nameEn: "10 HP suction motor", locationAr: "خلف صالة الإنتاج", locationEn: "Behind production hall", category: "facilities" },
  ...[
    ["AC-01", "مكيف 18000 صيني", "18000 BTU air conditioner", "مكتب المحاسب", "Accountant office"],
    ["AC-02", "مكيف 18000 سامسونج", "18000 BTU Samsung air conditioner", "مكتب خدمة العملاء", "Customer service office"],
    ["AC-03", "مكيف 18000 إل جي", "18000 BTU LG air conditioner", "مكتب مدير المستودعات", "Warehouse manager office"],
    ["AC-04", "مكيف 30000 إل جي", "30000 BTU LG air conditioner", "المسجد", "Mosque"],
    ["AC-05", "مكيف 18000 كوين", "18000 BTU Queen air conditioner", "مكتب المدير العام", "General manager office"],
    ["AC-06", "مكيف 24000 الزامل", "24000 BTU Zamil air conditioner", "كلاو", "Qalb"],
    ["AC-07", "مكيف 24000 إل جي", "24000 BTU LG air conditioner", "غرفة العمال", "Workers room"],
    ["AC-08", "مكيف 18000 صيني", "18000 BTU air conditioner", "غرفة العمال", "Workers room"],
    ["AC-09", "مكيف ماء 1.5 حصان", "1.5 HP water cooler", "مستودع الخيوط", "Yarn warehouse"],
    ["AC-10", "مكيف ماء 2 حصان", "2 HP water cooler", "مستودع الشرابات", "Socks warehouse"],
    ["AC-11", "مكيف 12000 صيني", "12000 BTU air conditioner", "مكتب مدير المبيعات", "Sales manager office"],
    ["AC-12", "مكيف دولابي إل جي 55000", "55000 BTU LG cabinet air conditioner", "صالة الفرز", "Sorting hall"],
    ["AC-13", "مكيف مخفي إل جي 60000", "60000 BTU LG concealed air conditioner", "صالة مانع الانزلاق", "Anti-slip hall"],
    ["AC-14", "مكيف دولابي إل جي 55000", "55000 BTU LG cabinet air conditioner", "صالة الإنتاج", "Production hall"],
    ["AC-15", "مكيف دولابي إل جي 55000", "55000 BTU LG cabinet air conditioner", "صالة الإنتاج", "Production hall"],
    ["AC-16", "مكيف 24000 إل جي", "24000 BTU LG air conditioner", "صالة الإنتاج", "Production hall"],
    ["AC-17", "مكيف 30000 صيني", "30000 BTU air conditioner", "مكتب مدير الإنتاج", "Production manager office"],
    ["AC-18", "مكيف شباك 24000", "24000 BTU window air conditioner", "غرفة السودانيين", "Workers room"],
    ["AC-19", "مكيف ماء نصف حصان قلاب", "Half-HP water cooler", "صالة الفرز", "Sorting hall"],
    ["AC-20", "مكيف ماء نصف حصان قلاب", "Half-HP water cooler", "صالة الفرز", "Sorting hall"],
  ].map(([code, nameAr, nameEn, locationAr, locationEn]) => ({ code, nameAr, nameEn, locationAr, locationEn, category: "air-conditioning" as const })),
  ...[
    ["PC-01", "لابتوب HP", "HP laptop", "مكتب المدير العام", "General manager office"],
    ["PC-02", "كمبيوتر HP", "HP computer", "مكتب المحاسب", "Accountant office"],
    ["PC-03", "لابتوب صيني", "Chinese laptop", "مكتب مدير الصيانة", "Maintenance manager office"],
    ["PC-04", "كمبيوتر HP", "HP computer", "مكتب مدير المستودعات", "Warehouse manager office"],
    ["PC-05", "كمبيوتر HP", "HP computer", "مكتب مدير المبيعات", "Sales manager office"],
    ["PC-06", "كمبيوتر HP", "HP computer", "مكتب مدير الإنتاج", "Production manager office"],
    ["PC-07", "كمبيوتر HP", "HP computer", "مكتب مساعد مدير الإنتاج", "Assistant production manager office"],
    ["PC-08", "كمبيوتر HP", "HP computer", "مكتب مساعد مدير المستودعات", "Assistant warehouse manager office"],
    ["PC-09", "لابتوب توشيبا", "Toshiba laptop", "خدمة العملاء", "Customer service"],
  ].map(([code, nameAr, nameEn, locationAr, locationEn]) => ({ code, nameAr, nameEn, locationAr, locationEn, category: "it" as const })),
  ...[
    ["PRN-01", "طابعة HP", "HP printer", "مكتب المحاسب", "Accountant office"],
    ["PRN-02", "طابعة HP", "HP printer", "مكتب خدمة العملاء", "Customer service office"],
    ["PRN-03", "طابعة HP", "HP printer", "مكتب مدير المستودعات", "Warehouse manager office"],
    ["PRN-04", "طابعة HP", "HP printer", "مكتب المدير العام", "General manager office"],
    ["PRN-05", "طابعة HP", "HP printer", "مكتب مدير المبيعات", "Sales manager office"],
    ["PRN-06", "طابعة HP", "HP printer", "مكتب مدير الإنتاج", "Production manager office"],
  ].map(([code, nameAr, nameEn, locationAr, locationEn]) => ({ code, nameAr, nameEn, locationAr, locationEn, category: "printing" as const })),
];

export function findMaintenanceMachine(code: string) {
  return MAINTENANCE_MACHINE_INVENTORY.find((item) => item.code.toLowerCase() === String(code || "").trim().toLowerCase());
}

export function maintenanceMachineLabel(item: Pick<MaintenanceMachineOption, "code" | "nameAr" | "nameEn" | "locationAr" | "locationEn">, language: "ar" | "en" = "ar") {
  const name = language === "ar" ? item.nameAr : item.nameEn;
  const location = language === "ar" ? item.locationAr : item.locationEn;
  return `${item.code} — ${name} (${location})`;
}
