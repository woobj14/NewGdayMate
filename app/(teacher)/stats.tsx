import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

type Period = '이번 주' | '이번 달' | '전체';

const UNIT_ACCS = [
  { unit:'1과', acc:88, change:'+3%', up:true  },
  { unit:'2과', acc:74, change:'+1%', up:true  },
  { unit:'3과', acc:61, change:'-4%', up:false },
  { unit:'4과', acc:52, change:'신규', up:null  },
];
const STUDENT_RANK = [
  { rank:1, name:'박서윤', xp:2150, acc:91, medal:'1위' },
  { rank:2, name:'이하은', xp:1980, acc:88, medal:'2위' },
  { rank:3, name:'김지민', xp:1620, acc:78, medal:'3위' },
  { rank:4, name:'최유진', xp:1060, acc:68, medal:''   },
  { rank:5, name:'정하늘', xp:720,  acc:51, medal:''   },
];
const WEAK_TYPES = [
  { type:'현재완료 vs 과거', count:18, pct:82, color:Colors.red    },
  { type:'동의어 추론',       count:14, pct:64, color:Colors.orange },
  { type:'문단 순서 배열',    count:10, pct:45, color:Colors.amber  },
  { type:'빈칸 추론',         count:7,  pct:32, color:Colors.green  },
];

export default function TeacherStatsScreen() {
  const [period, setPeriod] = useState<Period>('이번 달');

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:3 }]}>이재영 선생님 · 중3 A반</Text>
        <Text style={[Typography.h2, { marginBottom:12 }]}>성적 분석</Text>
        <View style={s.periodRow}>
          {(['이번 주','이번 달','전체'] as Period[]).map(p => (
            <Pressable key={p} onPress={() => setPeriod(p)}
              style={[s.pill, period===p && { backgroundColor:Colors.ink, borderColor:Colors.ink }]}>
              <Text style={[Typography.label2, { color:period===p ? '#fff' : Colors.ink3 }]}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ padding:16 }}>
        {/* 반 평균 KPI */}
        <View style={s.kpiRow}>
          {[
            { val:'74%',  lbl:'반 평균 정답률', color:Colors.brand  },
            { val:'14일', lbl:'평균 연속 학습',  color:Colors.orange },
            { val:'+6%',  lbl:'전주 대비 향상',  color:Colors.green  },
          ].map((k,i) => (
            <View key={i} style={s.kpiCard}>
              <Text style={[Typography.statSm, { color:k.color }]}>{k.val}</Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>{k.lbl}</Text>
            </View>
          ))}
        </View>

        {/* 단원별 정답률 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>단원별 정답률</Text>
        <View style={s.card}>
          {UNIT_ACCS.map((u,i) => (
            <View key={i} style={[s.unitRow, i<UNIT_ACCS.length-1 && { marginBottom:12 }]}>
              <Text style={[Typography.bold3, { color:Colors.ink, width:28 }]}>{u.unit}</Text>
              <View style={[s.barTrack, { flex:1 }]}>
                <View style={[s.barFill, {
                  width:`${u.acc}%` as any,
                  backgroundColor: u.acc>=80 ? Colors.green : u.acc>=60 ? Colors.amber : Colors.red,
                }]} />
              </View>
              <Text style={[Typography.bold3, { color:Colors.ink, width:36, textAlign:'right' }]}>{u.acc}%</Text>
              <View style={[s.changeBadge, { backgroundColor: u.up===null ? Colors.bg : u.up ? Colors.greenBg : Colors.redBg }]}>
                <Text style={[Typography.label3, { color: u.up===null ? Colors.ink3 : u.up ? Colors.greenDk : Colors.red }]}>
                  {u.change}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 학생 순위 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>이번 주 학생 순위</Text>
        <View style={s.card}>
          {STUDENT_RANK.map((st,i) => (
            <View key={i} style={[s.rankRow, i<STUDENT_RANK.length-1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}>
              <Text style={{ fontSize:18, width:28 }}>{st.medal || `${st.rank}`}</Text>
              <View style={[s.stuAva, { backgroundColor: i===0?Colors.amber:i===1?Colors.ink3:i===2?Colors.orange:Colors.brand }]}>
                <Text style={[Typography.bold3, { color:'#fff' }]}>{st.name[0]}</Text>
              </View>
              <Text style={[Typography.bold3, { flex:1, color:Colors.ink }]}>{st.name}</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>정답률 {st.acc}%</Text>
              <Text style={[Typography.bold3, { color:Colors.brand, width:60, textAlign:'right' }]}>
                {st.xp.toLocaleString()} XP
              </Text>
            </View>
          ))}
        </View>

        {/* 취약 유형 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>반 전체 취약 유형</Text>
        <View style={s.card}>
          {WEAK_TYPES.map((w,i) => (
            <View key={i} style={[s.unitRow, i<WEAK_TYPES.length-1 && { marginBottom:12 }]}>
              <View style={[s.typeDot, { backgroundColor:w.color }]} />
              <Text style={[Typography.bold3, { flex:1, color:Colors.ink }]}>{w.type}</Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginRight:8 }]}>{w.count}명</Text>
              <View style={[s.barTrack, { width:60 }]}>
                <View style={[s.barFill, { width:`${w.pct}%` as any, backgroundColor:w.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* 맞춤 테스트 발송 */}
        <Pressable style={s.testBtn}>
          <Text style={{ fontSize:18 }}></Text>
          <Text style={[Typography.bold2, { color:'#fff' }]}>현재완료 집중 테스트 전체 발송</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:18, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line },
  periodRow:   { flexDirection:'row', gap:7 },
  pill:        { paddingHorizontal:13, paddingVertical:6, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  kpiRow:      { flexDirection:'row', gap:9, marginBottom:14 },
  kpiCard:     { flex:1, backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, padding:12, alignItems:'center' },
  card:        { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:15, marginBottom:14 },
  unitRow:     { flexDirection:'row', alignItems:'center', gap:10 },
  barTrack:    { height:5, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  barFill:     { height:'100%', borderRadius:99 },
  changeBadge: { paddingHorizontal:8, paddingVertical:2, borderRadius:6 },
  rankRow:     { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:11 },
  stuAva:      { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  typeDot:     { width:8, height:8, borderRadius:4 },
  testBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:9, backgroundColor:Colors.brand, borderRadius:16, paddingVertical:16 },
});
