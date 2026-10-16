# عقد إصلاح التقارير 16 أكتوبر

الملف المشترك الذي ينفذه الوكيل الرئيسي: `shared/operational-report.ts`.

Exports:
- reportRows(response): any[] unwrap array/items/rows/data/results.
- businessDate(row, kind): YYYY-MM-DD. kind production/sale/collection/transaction/movement/general. Choose domain date first; only fall back createdAt if missing. Timestamp ISO offset goes to Riyadh, date-only/MySQL retains given date. No matching updatedAt/deliveryDate as alternate.
- inReportPeriod(row,kind,start,end,allDates=false): boolean; order bounds, exclude invalid/missing dates within bounded range.
- exactPairs(row,kind): number; kind production/second/item/stock/movement/handover. productionDozen*12+productionPairs. secondGradeDozen*12+secondGradePairs. item: quantityDozen/quantityPair fields if present, otherwise quantity and quantityUnit. stock/movement prefer totalPairs else round(quantityDozen*12) if within small DB rounding tolerance; invalid -> NaN (never zero).
- pairLabel(pairs): string integer dozen + remainder pairs, invalid -> 'كمية غير صالحة — تحتاج مراجعة'.
- productionMetrics(rows): {totalPairs,firstPairs,secondPairs,yarnGrams,wasteThreadGrams,wasteSocksGrams,needlesUsed,wasteNeedles,wastePercent:number|null,threadWastePercent:number|null}. Total is production quantity (second included per production existing semantics); first=total-second not clamped. yarn grams per pair fields multiplied by total. V2 linked production is already included, no double counting.
- commercialReport({sales,legacySales,collections,legacyCollections,transactions,legacyTransactions?,startDate,endDate,allDates?}): {salesRows,collectionRows,orderRows,visitRows,otherTransactionRows,salesAmount,collectionAmount}. Only invoices sales + explicit legacy sales are sales. Orders/visits NOT revenue. Invoice date for sales, collectionDate for collections, orderDate for orders/visits. source-namespaced IDs, dedup only identical source IDs. All rows have reportSource. Orders items quantity use exactPairs.
- transactionStatusLabel(value,type?) Arabic. Visits always 'زيارة مسجلة — معلومات فقط'.
- visitText(value) human readable parsing follow_up/product_presentation JSON notes.
- warehousePeriod({movements,stock,startDate,endDate,allDates?}): {movements,receiptPairs,issuePairs,adjustmentPairs,netPairs,openingPairs:number|null,closingPairs:number|null,currentPairs,invalidQuantityCount}. Current snapshot independent. Period closing derived current minus ALL later ledger movements; period opening minus in-period net. Adjustments signed and unknown -> period balances null. Do not duplicate storage as warehouse movement; ledger is single source. Display 'التخزين والمستودعات — إنتاج تام'.

قواعد عامة: لا تستبدل فشل API بصفر. احفظ التفاصيل والشاشة والطباعة/التصدير بنفس النطاق. قسم المبيعات له ملخص فقط حسب المستخدم (مبلغ وعدد فواتير)، الطلبات والزيارات بتفاصيل كاملة واسم عميل ونوع وحالة وكمية ومرفقات؛ التحصيل من أداء المندوب بجميع تفاصيله. المخزون لا يحتسب التخزين مرتين. لا تعيد تسجيل تاريخي تلقائيًا ولا تغير أرصدة. لا تغيّر صلاحيات حسابات ولا تحذف بيانات.
