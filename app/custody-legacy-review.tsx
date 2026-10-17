import React,{useEffect,useState} from "react";
import {ActivityIndicator,FlatList,StyleSheet,Text,TextInput,TouchableOpacity,View} from "react-native";
import {useRouter} from "expo-router";
import {ScreenContainer} from "@/components/screen-container";
import {BackButton} from "@/components/back-button";
import {useAuth} from "@/lib/auth-context";
import {useLanguage} from "@/lib/language-context";
import {isEnglish,localize,textAlignFor,writingDirection,custodyStageEnglish} from "@/lib/i18n/runtime";
import {trpcCall} from "@/lib/services/api.service";
import {CUSTODY_STAGE_LABELS,type CustodyStage} from "@shared/custody-contract";
import {formatPairs} from "@shared/custody-reporting";

export default function LegacyCustodyReview(){
 const router=useRouter();const {user}=useAuth();const {language}=useLanguage();const english=isEnglish(language);const textStyle={textAlign:textAlignFor(language),writingDirection:writingDirection(language)};
 const [rows,setRows]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [search,setSearch]=useState("");
 const loadError=localize(language,"تعذر تحميل العهد السابقة","Unable to load legacy custodies");
 const stageLabel=(stage:CustodyStage)=>english?(custodyStageEnglish[stage]||stage):(CUSTODY_STAGE_LABELS[stage]||stage);
 const quantityLabel=(pairs:unknown)=>{
  if(!english)return formatPairs(pairs as number);
  const whole=Number(pairs);
  if(!Number.isFinite(whole))return "Invalid quantity — review required";
  const dozen=whole>=0?Math.floor(whole/12):Math.ceil(whole/12);
  const remaining=Math.abs(whole-dozen*12);
  return `${whole.toLocaleString("en-US")} pairs (${dozen.toLocaleString("en-US")} dozen and ${remaining.toLocaleString("en-US")} pairs)`;
 };
 const load=async()=>{setLoading(true);setError("");try{const result=await trpcCall("custodyV2.legacyCandidates",undefined,"query");if(!Array.isArray(result))throw new Error(localize(language,"استجابة المراجعة غير صالحة","Invalid review response"));setRows(result);}catch(error){setError(error instanceof Error?error.message:loadError);}finally{setLoading(false);}};
 useEffect(()=>{if(user?.role==="admin")void load();else setLoading(false);},[user?.id]);
 if(user?.role!=="admin")return <ScreenContainer><Text style={[s.error,textStyle]}>{localize(language,"مراجعة الأرصدة الافتتاحية محصورة على الأدمن.","Opening balance review is restricted to administrators.")}</Text></ScreenContainer>;
 const visible=rows.filter(row=>`${row.workerName} ${row.productName} ${row.productSize} ${row.productColor} ${stageLabel(row.stage as CustodyStage)}`.toLowerCase().includes(search.trim().toLowerCase()));
 const eligibleCount=localize(language,`${visible.length} عهدة مؤهلة للمراجعة`,`${visible.length.toLocaleString("en-US")} eligible legacy custodies to review`);
 return <ScreenContainer style={s.screen}><View style={s.header}><BackButton/><Text style={[s.title,textStyle]}>{localize(language,"مراجعة العهد السابقة — رصيد افتتاحي","Review legacy custodies — opening balance")}</Text><TouchableOpacity onPress={()=>void load()} style={s.headerButton}><Text style={s.white}>{localize(language,"تحديث","Refresh")}</Text></TouchableOpacity></View>
 <FlatList data={visible} keyExtractor={row=>String(row.sourceId)} contentContainerStyle={s.content} ListHeaderComponent={<><Text style={[s.notice,textStyle]}>{localize(language,"لا تُرحّل أي عهدة تلقائيًا. راجع الموظف والمرحلة والكمية وأكمل تعريف الصنف وسبب الترحيل؛ يستورد الرصيد مرة واحدة، ولا يحتسب إنتاجًا جديدًا. السجلات ذات الحركات اللاحقة أو العينات أو التخزين النهائي غير مؤهلة هنا.","No custody is migrated automatically. Review the employee, stage, and quantity, then complete the product definition and migration reason. The balance is imported once and is not counted as new production. Records with later movements, samples, or final storage are not eligible here.")}</Text><TextInput style={[s.input,textStyle]} value={search} onChangeText={setSearch} placeholder={localize(language,"بحث بالموظف أو الصنف أو المرحلة","Search by employee, product, or stage")} placeholderTextColor="#64748b"/>{error?<Text style={[s.error,textStyle]}>{english?loadError:error}</Text>:null}{loading?<ActivityIndicator color="#075985"/>:<Text style={[s.small,textStyle]}>{eligibleCount}</Text>}</>}
 renderItem={({item})=><View style={[s.row,{flexDirection:english?"row":"row-reverse"}]}><View style={s.info}><Text style={[s.name,textStyle]}>{item.productName} · {item.productSize} · {item.productColor}</Text><Text style={[s.small,textStyle]}>{stageLabel(item.stage as CustodyStage)} · {item.workerName} · {localize(language,`سجل #${item.sourceId}`,`Record #${item.sourceId}`)}</Text><Text style={[s.amount,textStyle]}>{quantityLabel(item.quantityPairs)}</Text></View><TouchableOpacity onPress={()=>router.push({pathname:"/custody-batch-entry",params:{legacySourceId:String(item.sourceId)}} as never)} style={s.button}><Text style={s.white}>{localize(language,"مراجعة وترحيل","Review & migrate")}</Text></TouchableOpacity></View>}
 ListEmptyComponent={!loading&&!error?<Text style={[s.notice,textStyle]}>{localize(language,"لا توجد عهد سابقة مؤهلة ضمن البحث. لم يتم حذف السجلات غير المؤهلة أو تغييرها.","No eligible legacy custodies match the search. Ineligible records have not been deleted or changed.")}</Text>:null}/>
 </ScreenContainer>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:"#f5f7fa"},header:{backgroundColor:"#075985",padding:10,gap:8,flexDirection:"row",alignItems:"center"},title:{flex:1,fontSize:16,fontWeight:"800",color:"#fff"},headerButton:{padding:9},white:{fontSize:12,color:"#fff",fontWeight:"800"},content:{maxWidth:1200,width:"100%",alignSelf:"center",padding:12,gap:8,paddingBottom:32},notice:{fontSize:12,lineHeight:20,color:"#92400e",backgroundColor:"#fffbeb",padding:10,borderRadius:8},input:{borderWidth:1,borderColor:"#cbd5e1",padding:10,borderRadius:8,fontSize:14},error:{fontSize:12,color:"#b91c1c",padding:12},small:{fontSize:11,color:"#64748b",lineHeight:18},row:{backgroundColor:"#fff",padding:10,borderRadius:9,borderWidth:1,borderColor:"#cbd5e1",gap:9,alignItems:"center",flexWrap:"wrap"},info:{flex:1,minWidth:170},name:{fontSize:13,fontWeight:"800",color:"#0f172a"},amount:{fontSize:14,fontWeight:"800",color:"#075985"},button:{backgroundColor:"#075985",padding:12,borderRadius:8,minHeight:44}});
