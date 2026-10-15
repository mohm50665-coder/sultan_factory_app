import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { custodyService } from "@/lib/services/custody.service";
import { buildCustodyReport, custodyReportSummary, formatPairs, type CustodyReport } from "@shared/custody-reporting";

/** Independent source state: a failing custody source is never represented as an artificial zero. */
export function CustodySummaryPanel({startDate,endDate,allDates=false}:{startDate:string;endDate:string;allDates?:boolean}) {
  const router=useRouter();const [report,setReport]=useState<CustodyReport|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  useEffect(()=>{let active=true;setLoading(true);setError("");Promise.all([custodyService.list(),custodyService.accounts.list(),custodyService.settings()]).then(([batches,accounts,settings])=>{
    if(active)setReport(buildCustodyReport({batches,accounts,settings,filters:{startDate:allDates?"1970-01-01":startDate,endDate:allDates?"2099-12-31":endDate}}));
  }).catch(error=>active&&setError(error instanceof Error?error.message:"تعذر تحميل العهد")).finally(()=>active&&setLoading(false));return()=>{active=false};},[startDate,endDate,allDates]);
  const summary=useMemo(()=>report?custodyReportSummary(report):null,[report]);
  return <View style={styles.card}><View style={styles.top}><Text style={styles.title}>الاستلام والتسليم — الدورة المترابطة الجديدة</Text><TouchableOpacity style={styles.button} onPress={()=>router.push("/custody-reports" as never)}><Text style={styles.buttonText}>التفاصيل والطباعة وExcel</Text></TouchableOpacity></View>
    <Text style={styles.note}>إنتاج هذه الدفعات محفوظ في بيانات الإنتاج أعلاه؛ لا يضاف مرة ثانية. الأرقام التالية حركة عهد بين الأقسام، وليست إنتاجًا جديدًا.</Text>
    {loading?<ActivityIndicator color="#075985"/>:error?<Text accessibilityRole="alert" style={styles.error}>لم يكتمل تحميل هذا المصدر: {error}</Text>:summary&&report?<>
      <View style={styles.grid}>{[["استلام مؤكد",summary.receivedPairs],["إنجاز فعلي بالقراءات",summary.completedPairs],["تسليم مؤكد",summary.confirmedOutboundPairs],["مرسل معلق",summary.pendingOutboundPairs],["مسؤولية مفتوحة عند نهاية الفترة",summary.openCustodyPairs],["وارد مخزني معتمد",summary.warehouseFinalStockPairs],["إتلاف منفذ",summary.executedDestroyedPairs]].map(([label,value])=><View key={String(label)} style={styles.metric}><Text style={styles.value}>{formatPairs(Number(value))}</Text><Text style={styles.note}>{label}</Text></View>)}</View>
      {report.departments.map(group=><View key={group.department}><Text style={styles.department}>{group.department}</Text>{group.employees.map(employee=><View key={employee.employeeId} style={styles.employee}><Text style={styles.employeeName}>{employee.employeeName}</Text><Text style={styles.note}>مستلم {formatPairs(employee.totals.receivedPairs)} · منجز {formatPairs(employee.totals.completedPairs)} · صادر مؤكد {formatPairs(employee.totals.confirmedOutboundPairs)} · معلق {formatPairs(employee.totals.pendingOutboundPairs)}</Text></View>)}</View>)}
      {summary.employeesWithIncompleteTiming>0?<Text style={styles.warning}>{summary.employeesWithIncompleteTiming} موظفين لديهم بيانات وقت غير مكتملة؛ لا تعرض إنتاجية تقديرية لهم.</Text>:null}
      {!report.events.length?<Text style={styles.note}>لا توجد حركات في الدورة الجديدة ضمن الفترة؛ السجلات التاريخية تبقى في أقسامها ولا يتم نقلها أو تصفيرها تلقائيًا.</Text>:null}
    </>:null}
  </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#cbd5e1",borderRadius:9,padding:10,gap:7,marginVertical:8},top:{flexDirection:"row-reverse",flexWrap:"wrap",alignItems:"center",gap:8},title:{flex:1,minWidth:200,fontSize:14,fontWeight:"800",color:"#075985",textAlign:"right"},button:{backgroundColor:"#075985",borderRadius:7,padding:10},buttonText:{fontSize:11,fontWeight:"700",color:"#fff"},note:{fontSize:11,lineHeight:17,color:"#475569",textAlign:"right"},grid:{flexDirection:"row-reverse",flexWrap:"wrap",gap:6},metric:{flexGrow:1,flexBasis:160,padding:8,backgroundColor:"#f0f9ff",borderRadius:7},value:{fontSize:14,fontWeight:"800",color:"#075985",textAlign:"right"},department:{backgroundColor:"#e0f2fe",fontWeight:"800",fontSize:12,textAlign:"right",color:"#075985",padding:7},employee:{paddingVertical:6,borderBottomWidth:1,borderBottomColor:"#e2e8f0"},employeeName:{fontWeight:"800",fontSize:12,color:"#172033",textAlign:"right"},warning:{color:"#92400e",fontSize:11,textAlign:"right"},error:{color:"#b91c1c",fontSize:12,textAlign:"right"}});
