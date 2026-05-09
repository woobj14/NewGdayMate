// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 데이터 격리 · academyId 필터 필수
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

interface StudentRow {
  uid:         string;
  displayName: string;
  grade:       string;
  avatar:      string;
  xp:          number;
  streak:      number;
  accuracy:    number;
  isAtRisk:    boolean;
  lastStudied: string;
}

type SortKey = 'name' | 'xp' | 'streak' | 'accuracy' | 'risk';

export default function StudentsListScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState<SortKey>('risk');
  const [filter,   setFilter]   = useState<'all' | 'risk' | 'active'>('all');

  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    (async () => {
      try {
        // academyId 기준 학생 조회
        const snap = await getDocs(
          query(collection(db, 'users'),
            where('role', '==', 'student'),
            where('academyId', '==', user.academyId)
          )
        );
        const list: StudentRow[] = [];
        for (const doc of snap.docs) {
          const d   = doc.data();
          const uid = doc.id;
          // 진도 집계
          const pSnap = await getDocs(collection(db, 'users', uid, 'progress'));
          let totalXp = 0; let lastDate = '';
          pSnap.docs.forEach(p => {
            totalXp += p.data().xpEarned ?? 0;
            const ls = p.data().lastStudied;
            const ds = ls?.toDate ? ls.toDate().toISOString().slice(0,10) : '';
            if (ds > lastDate) lastDate = ds;
          });
          const today = new Date().toISOString().slice(0,10);
          const daysDiff = lastDate
            ? Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000)
            : 999;
          list.push({
            uid,
            displayName: d.displayName ?? '이름없음',
            grade:       d.grade ?? '',
            avatar:      d.avatar ?? '🦊',
            xp:          totalXp,
            streak:      d.streak ?? 0,
            accuracy:    d.accuracy ?? 0,
            isAtRisk:    daysDiff >= 3,
            lastStudied: lastDate || '기록없음',
          });
        }
        setStudents(list);
      } catch {
        // 데모 데이터
        setStudents([
          { uid:'1', displayName:'김지민', grade:'중3', avatar:'🦊', xp:1620, streak:14, accuracy:78, isAtRisk:false, lastStudied:'오늘' },
          { uid:'2', displayName:'박서윤', grade:'중3', avatar:'🐯', xp:2150, streak:21, accuracy:91, isAtRisk:false, lastStudied:'오늘' },
          { uid:'3', displayName:'이도현', grade:'중3', avatar:'🐻', xp:480,  streak:0,  accuracy:42, isAtRisk:true,  lastStudied:'4일 전' },
          { uid:'4', displayName:'최유진', grade:'중3', avatar:'🐰', xp:1060, streak:7,  accuracy:68, isAtRisk:false, lastStudied:'어제' },
          { uid:'5', displayName:'정하늘', grade:'중3', avatar:'🦁', xp:720,  streak:1,  accuracy:51, isAtRisk:true,  lastStudied:'3일 전' },
        ]);
      } finally { setLoading(false); }
    })();
  }, [user?.academyId]);

  const filtered = students
    .filter(s => {
      if (filter === 'risk')   return s.isAtRisk;
      if (filter === 'active') return !s.isAtRisk && s.streak > 0;
      return true;
    })
    .filter(s => !search || s.displayName.includes(search))
    .sort((a, b) => {
      if (sort === 'name')     return a.displayName.localeCompare(b.displayName);
      if (sort === 'xp')       return b.xp - a.xp;
      if (sort === 'streak')   return b.streak - a.streak;
      if (sort === 'accuracy') return b.accuracy - a.accuracy;
      if (sort === 'risk')     return (b.isAtRisk ? 1 : 0) - (a.isAtRisk ? 1 : 0);
      return 0;
    });

  const riskCount   = students.filter(s => s.isAtRisk).length;
  const activeCount = students.filter(s => !s.isAtRisk && s.streak > 0).length;

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize:18 }}>←</Text>
          </Pressable>
          <Text style={[Typography.h3, { flex:1 }]}>학생 관리</Text>
          <View style={{ flexDirection:'row', gap:6 }}>
            <View style={[s.statBadge, { backgroundColor:Colors.greenBg }]}>
              <Text style={[Typography.label3, { color:Colors.greenDk }]}>활동 {activeCount}</Text>
            </View>
            {riskCount > 0 && (
              <View style={[s.statBadge, { backgroundColor:Colors.redBg }]}>
                <Text style={[Typography.label3, { color:Colors.red }]}>주의 {riskCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 검색 */}
        <View style={s.searchRow}>
          <Text style={{ fontSize:14, color:Colors.ink3 }}></Text>
          <TextInput
            style={s.searchInput}
            placeholder="학생 이름 검색..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* 필터 탭 */}
        <View style={{ flexDirection:'row', gap:6, marginBottom:8 }}>
          {(['all','risk','active'] as const).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)}
              style={[s.pill, filter===f && s.pillActive]}>
              <Text style={[Typography.label2, { color:filter===f ? '#fff' : Colors.ink3 }]}>
                {f==='all' ? `전체 ${students.length}` : f==='risk' ? ` 주의 ${riskCount}` : ` 활동 ${activeCount}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 정렬 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection:'row', gap:6 }}>
            {([['risk','위험순'],['xp','XP순'],['streak','연속순'],['accuracy','정답률순'],['name','이름순']] as [SortKey,string][]).map(([k,l]) => (
              <Pressable key={k} onPress={() => setSort(k)}
                style={[s.sortBtn, sort===k && { backgroundColor:Colors.brand }]}>
                <Text style={[Typography.label3, { color:sort===k ? '#fff' : Colors.ink3 }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:12 }}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={[Typography.body3, { color:Colors.ink3 }]}>학생 데이터 집계 중...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:14, paddingBottom:40 }}>
          {/* 독려 메시지 일괄 전송 */}
          {riskCount > 0 && (
            <View style={s.alertBanner}>
              <View style={{ flex:1 }}>
                <Text style={[Typography.bold3, { color:Colors.red, marginBottom:2 }]}>
                   {riskCount}명이 3일 이상 미접속이에요
                </Text>
                <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                  독려 메시지를 일괄 전송할까요?
                </Text>
              </View>
              <Pressable
                style={{ backgroundColor:Colors.red, borderRadius:10, paddingHorizontal:13, paddingVertical:9 }}
                onPress={() => router.push('/(teacher)/messages')}
              >
                <Text style={[Typography.bold3, { color:'#fff' }]}>전송</Text>
              </Pressable>
            </View>
          )}

          {/* 학생 카드 */}
          <View style={{ gap:9 }}>
            {filtered.map(st => (
              <Pressable
                key={st.uid}
                style={[s.studentCard, st.isAtRisk && { borderColor:'#fca5a5', borderWidth:2 }]}
                onPress={() => router.push(`/(teacher)/students/${st.uid}` as any)}
              >
                <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                  {/* 아바타 */}
                  <View style={[s.ava, { backgroundColor:st.isAtRisk ? Colors.redBg : Colors.brandBg }]}>
                    <Text style={{ fontSize:22 }}>{st.avatar}</Text>
                  </View>

                  {/* 기본 정보 */}
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:7, marginBottom:3 }}>
                      <Text style={[Typography.bold2, { color:Colors.ink }]}>{st.displayName}</Text>
                      <Text style={[Typography.label3, { color:Colors.ink3 }]}>{st.grade}</Text>
                      {st.isAtRisk && (
                        <View style={s.riskTag}>
                          <Text style={[Typography.label3, { color:Colors.red, fontWeight:'700' }]}>주의</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                      {st.streak}일 · 정답률 {st.accuracy}% · 최근 {st.lastStudied}
                    </Text>
                  </View>

                  {/* XP */}
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={[Typography.bold2, { color:Colors.brand }]}>{st.xp.toLocaleString()}</Text>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>XP</Text>
                  </View>
                </View>

                {/* 정답률 바 */}
                <View style={[s.accBar, { marginTop:10 }]}>
                  <View style={[s.accFill, {
                    width:`${st.accuracy}%` as any,
                    backgroundColor: st.accuracy >= 80 ? Colors.green : st.accuracy >= 60 ? Colors.amber : Colors.red,
                  }]} />
                </View>
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:4 }}>
                  <Text style={[Typography.label3, { color:Colors.ink3 }]}>정답률 {st.accuracy}%</Text>
                  <Pressable
                    style={s.msgBtn}
                    onPress={() => router.push('/(teacher)/messages')}
                  >
                    <Text style={[Typography.label3, { color:Colors.brand }]}> 쪽지 보내기</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:Colors.line },
  backBtn:     { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  statBadge:   { paddingHorizontal:10, paddingVertical:4, borderRadius:99 },
  searchRow:   { flexDirection:'row', alignItems:'center', gap:9, backgroundColor:Colors.bg, borderRadius:11, paddingHorizontal:13, paddingVertical:10, marginBottom:10 },
  searchInput: { flex:1, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink },
  pill:        { paddingHorizontal:12, paddingVertical:5, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  pillActive:  { backgroundColor:Colors.ink, borderColor:Colors.ink },
  sortBtn:     { paddingHorizontal:11, paddingVertical:5, borderRadius:99, backgroundColor:Colors.bg },
  alertBanner: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.redBg, borderRadius:14, borderWidth:1, borderColor:'#fca5a5', padding:14, marginBottom:12 },
  studentCard: { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:14 },
  ava:         { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  riskTag:     { backgroundColor:Colors.redBg, paddingHorizontal:7, paddingVertical:2, borderRadius:6 },
  accBar:      { height:5, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  accFill:     { height:'100%', borderRadius:99 },
  msgBtn:      { paddingHorizontal:9, paddingVertical:3, borderRadius:8, backgroundColor:Colors.brandBg },
});
