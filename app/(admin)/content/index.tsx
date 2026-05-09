// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 (Growth & Admin) 소유 파일
// 원칙: 데이터 신뢰성 · B2B 지원 · 운영 자동화 · 리텐션 분석 · 문서 최신화
// 수정 전 CLAUDE.md 확인 필수 | academyId 필터 누락 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

const PUBLISHERS = ['천재교육','미래엔','동아출판','YBM','비상교육'];
const GRADES     = ['중1','중2','중3','고1','고2','고3'];
const UNITS      = Array.from({length:8},(_,i)=>`${i+1}과`);

const PREVIEW = [
  { en:'observe',   ko:'관찰하다', def:'to look at something carefully', syn:'watch, study'   },
  { en:'ancient',   ko:'고대의',   def:'from a very early period',       syn:'old, historical'},
  { en:'telescope', ko:'망원경',   def:'instrument to see far things',   syn:'spyglass'       },
];

export default function AdminContentScreen() {
  const router = useRouter();
  const [pub,   setPub]   = useState(0);
  const [grade, setGrade] = useState(2);
  const [unit,  setUnit]  = useState(2);
  const [tab,   setTab]   = useState(0);
  const [text,  setText]  = useState('observe | 관찰하다 | v.\nancient | 고대의 | adj.\ntelescope | 망원경 | n.\n...');
  const [loading,setLoading]=useState(false);
  const [saved,  setSaved] =useState(false);

  const TABS=[{label:'단어',count:40},{label:'문법',count:6},{label:'대화문',count:3},{label:'본문',count:1}];

  const save=async()=>{
    setLoading(true);
    await new Promise(r=>setTimeout(r,1200));
    setLoading(false); setSaved(true);
  };

  return (
    <View style={s.wrap}>
      <View style={s.hdr}>
        <Pressable style={s.back} onPress={()=>router.back()}><Text style={{fontSize:18}}>←</Text></Pressable>
        <Text style={[Typography.h3,{flex:1}]}>콘텐츠 입력</Text>
        <Pressable style={s.saveBtn} onPress={save} disabled={loading}>
          {loading?<ActivityIndicator color="#fff" size="small"/>:<Text style={[Typography.bold3,{color:'#fff'}]}>{saved?'V 저장됨':'저장'}</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom:110}}>
        <View style={s.formCard}>
          <Text style={[Typography.label2,{color:Colors.ink3,marginBottom:10,letterSpacing:.5}]}>대상 교과서</Text>
          <Text style={[Typography.label3,{color:Colors.ink3,marginBottom:6}]}>출판사</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{flexDirection:'row',gap:6,marginBottom:12}}>
              {PUBLISHERS.map((p,i)=>(
                <Pressable key={p} onPress={()=>setPub(i)} style={[s.pill,pub===i&&{backgroundColor:Colors.brand,borderColor:Colors.brand}]}>
                  <Text style={[Typography.label2,{color:pub===i?'#fff':Colors.ink3}]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={[Typography.label3,{color:Colors.ink3,marginBottom:6}]}>학년</Text>
          <View style={{flexDirection:'row',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {GRADES.map((g,i)=>(
              <Pressable key={g} onPress={()=>setGrade(i)} style={[s.pill,grade===i&&{backgroundColor:Colors.brand,borderColor:Colors.brand}]}>
                <Text style={[Typography.label2,{color:grade===i?'#fff':Colors.ink3}]}>{g}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[Typography.label3,{color:Colors.ink3,marginBottom:6}]}>단원</Text>
          <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
            {UNITS.map((u,i)=>(
              <Pressable key={u} onPress={()=>setUnit(i)} style={[s.pill,unit===i&&{backgroundColor:Colors.brand,borderColor:Colors.brand}]}>
                <Text style={[Typography.label2,{color:unit===i?'#fff':Colors.ink3}]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{flexDirection:'row',backgroundColor:Colors.line,borderRadius:12,margin:16,padding:4,gap:4}}>
          {TABS.map((t,i)=>(
            <Pressable key={t.label} onPress={()=>setTab(i)}
              style={[{flex:1,alignItems:'center',paddingVertical:9,borderRadius:9,gap:2},tab===i&&{backgroundColor:Colors.white}]}>
              <Text style={[Typography.bold3,{color:tab===i?Colors.ink:Colors.ink3}]}>{t.label}</Text>
              {tab===i&&<Text style={[Typography.label3,{color:Colors.brand}]}>{t.count}</Text>}
            </Pressable>
          ))}
        </View>

        <View style={{paddingHorizontal:16}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <Text style={[Typography.bold3]}>단어 일괄 입력</Text>
            <Pressable style={s.csvBtn}>
              <Text style={[Typography.label2,{color:Colors.greenDk}]}> CSV 업로드</Text>
            </Pressable>
          </View>
          <View style={s.taWrap}>
            <TextInput style={s.ta} multiline value={text} onChangeText={setText} placeholderTextColor={Colors.ink3} />
          </View>
          <Pressable style={s.aiBtn}>
            <Text style={[Typography.bold3,{color:Colors.brand}]}> AI로 영영풀이/유의어 자동 채우기</Text>
          </Pressable>
          <Text style={[Typography.bold3,{color:Colors.ink3,marginTop:16,marginBottom:8}]}>입력된 단어 (3 / 40)</Text>
          <View style={s.preview}>
            {PREVIEW.map((w,i)=>(
              <View key={i} style={[s.previewRow,i<PREVIEW.length-1&&{borderBottomWidth:.5,borderBottomColor:Colors.line}]}>
                <View style={{flex:1}}>
                  <Text style={[Typography.bold2,{color:Colors.ink}]}>{w.en} <Text style={[Typography.label2,{color:Colors.ink3}]}>· {w.ko}</Text></Text>
                  <Text style={[Typography.label2,{color:Colors.ink3}]}>def. {w.def}</Text>
                  <Text style={[Typography.label2,{color:Colors.ink3}]}>syn. <Text style={{color:Colors.brand}}>{w.syn}</Text></Text>
                </View>
                <View style={{backgroundColor:Colors.greenBg,borderRadius:8,paddingHorizontal:8,paddingVertical:3}}>
                  <Text style={[Typography.label3,{color:Colors.greenDk}]}>V AI</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={s.btmBar}>
        <Pressable style={s.draftBtn}><Text style={[Typography.bold2,{color:Colors.ink3}]}>임시저장</Text></Pressable>
        <Pressable style={s.pubBtn} onPress={save}>
          <Text style={[Typography.bold2,{color:'#fff'}]}>V 배포하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s=StyleSheet.create({
  wrap:     {flex:1,backgroundColor:Colors.bg},
  hdr:      {backgroundColor:Colors.white,paddingTop:52,paddingHorizontal:18,paddingBottom:14,borderBottomWidth:1,borderBottomColor:Colors.line,flexDirection:'row',alignItems:'center',gap:10},
  back:     {width:36,height:36,borderRadius:12,borderWidth:1,borderColor:Colors.line,alignItems:'center',justifyContent:'center'},
  saveBtn:  {backgroundColor:Colors.brand,borderRadius:10,paddingHorizontal:14,paddingVertical:8},
  formCard: {backgroundColor:Colors.white,margin:16,borderRadius:18,borderWidth:1,borderColor:Colors.line,padding:16},
  pill:     {paddingHorizontal:12,paddingVertical:6,borderRadius:99,borderWidth:1.5,borderColor:Colors.line,backgroundColor:Colors.white},
  csvBtn:   {backgroundColor:Colors.greenBg,borderRadius:8,paddingHorizontal:10,paddingVertical:5,borderWidth:1,borderColor:'#86efac'},
  taWrap:   {backgroundColor:Colors.white,borderRadius:14,borderWidth:1.5,borderColor:Colors.line,marginBottom:10},
  ta:       {minHeight:130,padding:14,fontFamily:'Pretendard-Regular',fontSize:13,color:Colors.ink,lineHeight:22},
  aiBtn:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderWidth:1.5,borderColor:'#DDD9FF',borderRadius:12,padding:12,backgroundColor:Colors.brandBg},
  preview:  {backgroundColor:Colors.white,borderRadius:16,borderWidth:1,borderColor:Colors.line,overflow:'hidden'},
  previewRow:{padding:13},
  btmBar:   {flexDirection:'row',gap:10,padding:14,paddingBottom:32,backgroundColor:Colors.white,borderTopWidth:1,borderTopColor:Colors.line,position:'absolute',bottom:0,left:0,right:0},
  draftBtn: {flex:1,padding:14,borderRadius:14,borderWidth:1.5,borderColor:Colors.line,alignItems:'center'},
  pubBtn:   {flex:2,padding:14,borderRadius:14,backgroundColor:Colors.green,alignItems:'center'},
});
