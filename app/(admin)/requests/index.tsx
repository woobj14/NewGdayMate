// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 (Growth & Admin) 소유 파일
// 원칙: 데이터 신뢰성 · B2B 지원 · 운영 자동화 · 리텐션 분석 · 문서 최신화
// 수정 전 CLAUDE.md 확인 필수 | academyId 필터 누락 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Filter = 'all'|'teacher'|'student'|'urgent';

const REQUESTS = [
  { id:'1', from:'박선생', role:'선생님', tag:'#콘텐츠', isUrgent:true,  title:'천재교육 4과 단어 추가 요청', body:'"deliberate" 영영풀이가 보완해주세요', time:'2분',  color:Colors.purpleAlt },
  { id:'2', from:'김지민', role:'학생',   tag:'#콘텐츠', isUrgent:false, title:'AI 해설이 헷갈려요',           body:'현재완료 설명을 더 쉽게 해주실 수 있을까요?', time:'14분', color:Colors.orange },
  { id:'3', from:'이선생', role:'선생님', tag:'#오류',   isUrgent:true,  title:'5과 본문 오타',                body:'page 3 line 12 — "thier" → "their"', time:'32분', color:Colors.green },
  { id:'4', from:'최유진', role:'학생',   tag:'#버그',   isUrgent:false, title:'스피킹 북 다운로드 안 됨',     body:'iOS 17.3에서 PDF가 깨져요', time:'1시간', color:Colors.greenAlt },
  { id:'5', from:'정선생', role:'선생님', tag:'#콘텐츠', isUrgent:false, title:'동아출판 2025 신규 등록',      body:'2025년 개정판 추가해주세요 (3~6과)', time:'3시간', color:Colors.blue },
];

const TAG_COLOR: Record<string,{bg:string;text:string}> = {
  '#콘텐츠':{ bg:Colors.brandBg, text:Colors.brandDk },
  '#오류':  { bg:Colors.amberBg, text:Colors.amberDk },
  '#버그':  { bg:Colors.redBg,   text:Colors.redDk },
};

export default function AdminRequestsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [resolved, setResolved] = useState<string[]>([]);

  const filtered = REQUESTS.filter(r => {
    if(filter==='urgent') return r.isUrgent;
    if(filter==='teacher') return r.role==='선생님';
    if(filter==='student') return r.role==='학생';
    return true;
  }).filter(r=>!resolved.includes(r.id));

  const urgentCount = REQUESTS.filter(r=>r.isUrgent).length;
  const unread = REQUESTS.filter(r=>!resolved.includes(r.id)).length;

  const resolve=(id:string)=>setResolved(p=>[...p,id]);

  return (
    <View style={s.wrap}>
      <View style={s.hdr}>
        <Text style={[Typography.label2,{color:Colors.ink3,marginBottom:3}]}>관리자</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12}}>
          <Text style={[Typography.h2]}>요청함</Text>
          <View style={s.badge}><Text style={[Typography.bold3,{color:'#fff'}]}>{unread}</Text></View>
        </View>
        <View style={{flexDirection:'row',gap:7}}>
          {(['all','teacher','student','urgent'] as Filter[]).map(f=>(
            <Pressable key={f} onPress={()=>setFilter(f)}
              style={[s.pill,filter===f&&{backgroundColor:f==='urgent'?Colors.red:Colors.ink,borderColor:f==='urgent'?Colors.red:Colors.ink}]}>
              <Text style={[Typography.label2,{color:filter===f?'#fff':Colors.ink3}]}>
                {f==='all'?`전체 ${REQUESTS.length}`:f==='teacher'?`선생님 ${REQUESTS.filter(r=>r.role==='선생님').length}`:f==='student'?`학생 ${REQUESTS.filter(r=>r.role==='학생').length}`:`긴급 ${urgentCount}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={r=>r.id}
        contentContainerStyle={{padding:16,gap:10}}
        renderItem={({item:r})=>{
          const tc=TAG_COLOR[r.tag]??{bg:Colors.bg,text:Colors.ink3};
          return (
            <View style={[s.card,r.isUrgent&&{borderColor:'#fca5a5',backgroundColor:Colors.bgAlt}]}>
              <View style={s.cardTop}>
                <View style={s.cardMeta}>
                  <View style={[s.ava,{backgroundColor:r.color}]}>
                    <Text style={[Typography.bold3,{color:'#fff'}]}>{r.from[0]}</Text>
                  </View>
                  <View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                      <Text style={[Typography.bold3,{color:Colors.ink}]}>{r.from} · {r.role}</Text>
                      {r.isUrgent&&<View style={s.urgentTag}><Text style={[Typography.label3,{color:'#fff'}]}>긴급</Text></View>}
                    </View>
                    <Text style={[Typography.label2,{color:Colors.ink3}]}>{r.time}</Text>
                  </View>
                </View>
              </View>
              <Text style={[Typography.bold2,{color:Colors.ink,marginBottom:5}]}>{r.title}</Text>
              <Text style={[Typography.body3,{color:Colors.ink3,marginBottom:10}]}>{r.body}</Text>
              <View style={{flexDirection:'row',gap:6,marginBottom:12}}>
                <View style={[s.tagPill,{backgroundColor:tc.bg}]}>
                  <Text style={[Typography.label3,{color:tc.text}]}>{r.tag}</Text>
                </View>
              </View>
              <View style={{flexDirection:'row',gap:8}}>
                <Pressable style={s.primaryBtn} onPress={()=>router.push('/(admin)/content' as any)}>
                  <Text style={[Typography.bold3,{color:'#fff'}]}>
                    {r.tag==='#콘텐츠'?'콘텐츠 입력':r.tag==='#버그'?'개발팀 이관':'바로 수정'}
                  </Text>
                </Pressable>
                <Pressable style={s.secondaryBtn} onPress={()=>resolve(r.id)}>
                  <Text style={[Typography.bold3,{color:Colors.ink3}]}>해결됨</Text>
                </Pressable>
                {r.isUrgent&&(
                  <Pressable style={s.dangerBtn} onPress={()=>resolve(r.id)}>
                    <Text style={[Typography.bold3,{color:Colors.red}]}>무시</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{alignItems:'center',paddingVertical:60}}>
            <Text style={{fontSize:40,marginBottom:12}}></Text>
            <Text style={[Typography.h4,{color:Colors.ink3}]}>모든 요청 처리 완료!</Text>
          </View>
        }
      />
    </View>
  );
}

const s=StyleSheet.create({
  wrap:        {flex:1,backgroundColor:Colors.bg},
  hdr:         {backgroundColor:Colors.white,paddingTop:52,paddingHorizontal:18,paddingBottom:14,borderBottomWidth:1,borderBottomColor:Colors.line},
  badge:       {backgroundColor:Colors.red,borderRadius:99,width:26,height:26,alignItems:'center',justifyContent:'center'},
  pill:        {paddingHorizontal:12,paddingVertical:6,borderRadius:99,borderWidth:1.5,borderColor:Colors.line,backgroundColor:Colors.white},
  card:        {backgroundColor:Colors.white,borderRadius:18,borderWidth:1.5,borderColor:Colors.line,padding:16},
  cardTop:     {marginBottom:10},
  cardMeta:    {flexDirection:'row',alignItems:'flex-start',gap:10},
  ava:         {width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},
  urgentTag:   {backgroundColor:Colors.red,borderRadius:6,paddingHorizontal:7,paddingVertical:2},
  tagPill:     {paddingHorizontal:9,paddingVertical:3,borderRadius:99},
  primaryBtn:  {flex:2,padding:10,borderRadius:11,backgroundColor:Colors.brand,alignItems:'center'},
  secondaryBtn:{flex:1,padding:10,borderRadius:11,borderWidth:1.5,borderColor:Colors.line,alignItems:'center'},
  dangerBtn:   {flex:1,padding:10,borderRadius:11,borderWidth:1.5,borderColor:'#fca5a5',backgroundColor:Colors.redBg,alignItems:'center'},
});
