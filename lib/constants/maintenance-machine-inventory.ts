export type MaintenanceMachineOption = {
  /** معرف تقني داخلي فقط لتوافق السجلات السابقة؛ لا يعرض للمستخدم. */
  code: string;
  nameAr: string;
  nameEn: string;
  /** رموز الحصر السابقة تُقبل عند فتح سجل قديم فقط. */
  aliases?: string[];
};

/**
 * أسماء المعدات والآلات والأجهزة فقط كما وردت في "حصر كامل للمكاين - 2".
 * لا تُعرض الرموز أو المواقع أو الأرقام التسلسلية في شاشة الصيانة أو التقارير.
 */
export const MAINTENANCE_MACHINE_INVENTORY: MaintenanceMachineOption[] = [
  { code: "knitting-rc-u7fn-1", nameAr: "ماكينة حياكة RC-U7FN-1", nameEn: "RC-U7FN-1 knitting machine", aliases: ["RS.01", "RS.02", "RS.03", "RS.04", "RS.05", "RS.06", "RS.07", "RS.08", "RS.09", "RS.10", "RS.11"] },
  { code: "knitting-rb-6ftp-1", nameAr: "ماكينة حياكة RB-6FTP-1", nameEn: "RB-6FTP-1 knitting machine", aliases: ["RB.01", "RB.02", "RB.03", "RB.04", "RB.05", "RB.06", "RB.07", "RB.08", "RB.09"] },
  { code: "production-ss-163-kt", nameAr: "ماكينة إنتاج SS-163-KT", nameEn: "SS-163-KT production machine", aliases: ["SO.01", "SO.02", "LT1", "LT2"] },
  { code: "knitting-8f-fs", nameAr: "ماكينة حياكة 8F(FS)", nameEn: "8F(FS) knitting machine", aliases: ["RS.8F.01"] },
  { code: "new-star", nameAr: "ماكينة New Star", nameEn: "New Star machine", aliases: ["NS.01"] },
  { code: "manu-facturer", nameAr: "ماكينة حياكة Manu Facturer", nameEn: "Manu Facturer knitting machine", aliases: ["KN-01"] },
  { code: "jolly-s", nameAr: "ماكينة حياكة JOLLY.S", nameEn: "JOLLY.S knitting machine", aliases: ["KN-02", "KN-04"] },
  { code: "reg-tta-s", nameAr: "ماكينة حياكة REG.TTA.S", nameEn: "REG.TTA.S knitting machine", aliases: ["KN-03"] },
  { code: "jolly", nameAr: "ماكينة حياكة JOLLY", nameEn: "JOLLY knitting machine", aliases: ["KN-05", "KN-06"] },
  { code: "embroidery-a-1201", nameAr: "ماكينة تطريز A-1201", nameEn: "A-1201 embroidery machine", aliases: ["KN-07"] },
  { code: "mobile-lathe-yt-125", nameAr: "مخرطة متحركة YT-125", nameEn: "YT-125 mobile lathe", aliases: ["KN-08"] },
  { code: "yarn-recycling-de-88", nameAr: "ماكينة إعادة تدوير الخيط DE-88", nameEn: "DE-88 yarn recycling machine", aliases: ["KN-09"] },
  { code: "rosso-sock-turning", nameAr: "ماكينة روسو لقلب الشراب", nameEn: "Rosso sock-turning machine", aliases: ["KN-010"] },
  { code: "rosso-closing", nameAr: "ماكينة تقفيل روسو", nameEn: "Rosso closing machine", aliases: ["CLS-01", "CLS-02", "CLS-03"] },
  { code: "ironing-shaping", nameAr: "كاوية / ماكينة تشكيل", nameEn: "Ironing / shaping machine", aliases: ["BRD-01"] },
  { code: "mobile-iron", nameAr: "كاوية متحركة", nameEn: "Mobile iron", aliases: ["BRD-02", "BRD-03", "BRD-04", "BRD-05"] },
  { code: "steam-washer", nameAr: "مغسلة بخار", nameEn: "Steam washer", aliases: ["MA-01"] },
  { code: "anti-slip-machine", nameAr: "ماكينة مانع الانزلاق", nameEn: "Anti-slip printing machine", aliases: ["MK-01"] },
  { code: "compressor", nameAr: "كمبروسر", nameEn: "Compressor", aliases: ["CMP-01", "CMP-02", "CMP-03"] },
  { code: "diesel-boiler", nameAr: "غلاية ديزل", nameEn: "Diesel boiler", aliases: ["BLR-01"] },
  { code: "electric-panel", nameAr: "لوحة توزيع الكهرباء", nameEn: "Electrical distribution panel", aliases: ["ELP-01"] },
  { code: "mobile-label-machine", nameAr: "ماكينة ليبل متحركة", nameEn: "Mobile label machine", aliases: ["LB-01"] },
  { code: "fixed-label-machine", nameAr: "ماكينة ليبل ثابتة", nameEn: "Fixed label machine", aliases: ["LB-02"] },
  { code: "suction-motor", nameAr: "موتور شفط", nameEn: "Suction motor", aliases: ["MO-01", "MO-02"] },
  { code: "ac-chinese-18000", nameAr: "مكيف صيني 18000", nameEn: "18000 BTU Chinese air conditioner", aliases: ["AC-01", "AC-08"] },
  { code: "ac-samsung-18000", nameAr: "مكيف سامسونج 18000", nameEn: "18000 BTU Samsung air conditioner", aliases: ["AC-02"] },
  { code: "ac-lg-18000", nameAr: "مكيف إل جي 18000", nameEn: "18000 BTU LG air conditioner", aliases: ["AC-03"] },
  { code: "ac-lg-30000", nameAr: "مكيف إل جي 30000", nameEn: "30000 BTU LG air conditioner", aliases: ["AC-04"] },
  { code: "ac-queen-18000", nameAr: "مكيف كوين 18000", nameEn: "18000 BTU Queen air conditioner", aliases: ["AC-05"] },
  { code: "ac-zamil-24000", nameAr: "مكيف الزامل 24000", nameEn: "24000 BTU Zamil air conditioner", aliases: ["AC-06"] },
  { code: "ac-lg-24000", nameAr: "مكيف إل جي 24000", nameEn: "24000 BTU LG air conditioner", aliases: ["AC-07", "AC-16"] },
  { code: "water-cooler-1-5-hp", nameAr: "مكيف ماء 1.5 حصان", nameEn: "1.5 HP water cooler", aliases: ["AC-09"] },
  { code: "water-cooler-2-hp", nameAr: "مكيف ماء 2 حصان", nameEn: "2 HP water cooler", aliases: ["AC-10"] },
  { code: "ac-chinese-12000", nameAr: "مكيف صيني 12000", nameEn: "12000 BTU Chinese air conditioner", aliases: ["AC-11"] },
  { code: "ac-lg-cabinet-55000", nameAr: "مكيف دولابي إل جي 55000", nameEn: "55000 BTU LG cabinet air conditioner", aliases: ["AC-12", "AC-14", "AC-15"] },
  { code: "ac-lg-concealed-60000", nameAr: "مكيف مخفي إل جي 60000", nameEn: "60000 BTU LG concealed air conditioner", aliases: ["AC-13"] },
  { code: "ac-chinese-30000", nameAr: "مكيف صيني 30000", nameEn: "30000 BTU Chinese air conditioner", aliases: ["AC-17"] },
  { code: "ac-window-24000", nameAr: "مكيف شباك 24000", nameEn: "24000 BTU window air conditioner", aliases: ["AC-18"] },
  { code: "water-cooler-half-hp", nameAr: "مكيف ماء نصف حصان قلاب", nameEn: "Half-HP water cooler", aliases: ["AC-19", "AC-20"] },
  { code: "hp-laptop", nameAr: "لابتوب HP", nameEn: "HP laptop", aliases: ["PC-01"] },
  { code: "hp-computer", nameAr: "كمبيوتر HP", nameEn: "HP computer", aliases: ["PC-02", "PC-04", "PC-05", "PC-06", "PC-07", "PC-08"] },
  { code: "chinese-laptop", nameAr: "لابتوب صيني", nameEn: "Chinese laptop", aliases: ["PC-03"] },
  { code: "toshiba-laptop", nameAr: "لابتوب توشيبا", nameEn: "Toshiba laptop", aliases: ["PC-09"] },
  { code: "hp-printer", nameAr: "طابعة HP", nameEn: "HP printer", aliases: ["PRN-01", "PRN-02", "PRN-03", "PRN-04", "PRN-05", "PRN-06"] },
];

export function findMaintenanceMachine(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return MAINTENANCE_MACHINE_INVENTORY.find((item) => item.code.toLowerCase() === normalized || item.aliases?.some((alias) => alias.toLowerCase() === normalized));
}

/** النص المعروض والمحفوظ في تقارير الصيانة: الاسم فقط. */
export function maintenanceMachineLabel(item: Pick<MaintenanceMachineOption, "nameAr" | "nameEn">, language: "ar" | "en" = "ar") {
  return language === "ar" ? item.nameAr : item.nameEn;
}
