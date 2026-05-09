// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// academyId 필터 누락 금지 | 수정 전 CLAUDE.md 확인 필수
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

const WEEK_LABELS = ['일','월','화','수','목','금','토'];
const MAX_H = 60;

interface StudentData {
  displayName: string;
  grade:       string;
  avatar:      string;
  academyId:   string;
}
interface ProgressData {
  lessonId:       string;
  completedSteps: number[];
  xpEarned:       number;
  lastStudied:    any;
  status:         string;
}

export default function StudentDetailScreen() {
  const router  = useRouter();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [loading,  setLoading]  = useState(true);
  const [student,  setStudent]  = useState<StudentData | null>(null);
  const [progress, setProgress] = useState<ProgressData[]>([]);
  const [wrongCnt, setWrongCnt] = useState(0);
  const [weekData, setWeekData] = useState([0,0,0,0,0,0,0]);
  const [streak,   setStreak]   = useState(0);
  const [totalXp,  setTotalXp]  = useState(0);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        // 1. 학생 기본 정보
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) setStudent(uSnap.data() as StudentData);

        // 2. 학습 진도 전체
        const pSnap = await getDocs(collection(db, 'users', uid, 'progress'));
        const pList = pSnap.docs.map(d => ({ lessonId: d.id, ...d.data() })) as ProgressData[];
        setProgress(pList);

        // XP 합산
        const xp = pList.reduce((sum, p) => sum + (p.xpEarned ?? 0), 0);
        setTotalXp(xp);

        // 3. 오답 수
        const wSnap = await getDocs(
          query(collection(db, 'users', uid, 'wrongNotes'), where('status','==','unresolved'))
        );
        setWrongCnt(wSnap.size);

        // 4. 주간 학습량 (최근 7일 lastStudied 기준)
        const now  = new Date();
        const week = Array(7).fill(0);
        pList.forEach(p => {
          if (!p.lastStudied) return;
          const d  = p.lastStudied.toDate ? p.lastStudied.toDate() : new Date(p.lastStudied);
          const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
          if (diff < 7) week[6 - diff] += p.completedSteps?.length ?? 0;
        });
        setWeekData(week);

        // 5. 연속 학습일 (streak: activityLog 없으면 progress lastStudied로 추정)
        const dates = new Set<string>();
        pList.forEach(p => {
          if (!p.lastStudied) return;
          const d = p.lastStudied.toDate ? p.lastStudied.toDate() : new Date(p.lastStudied);
          dates.add(d.toISOString().slice(0,10));
        });
        let s = 0;
        const today = new Date();
        while (true) {
          const key = new Date(today.getTime() - s * 86400000).toISOString().slice(0,10);
          if (dates.has(key)) s++;
          else break;
        }
        setStreak(s);

      } catch (e) {
        // 오프라인/권한 오류 — 빈 상태 표시
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  // 약점 분석 — 완료 단계 수가 적은 자료 = 약점
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const inProgressCount = progress.filter(p => p.status === 'in_progress').length;
  const accuracy = progress.length > 0
    ? Math.round((completedCount / progress.length) * 100)
    : 0;

  const weeklyXp = weekData.reduce((a,b) => a+b, 0);

  const avatarColors: Record<string, string> = {
    '🦊': Colors.orange, '🐯': Colors.amber, '🐻': Colors.amber,
    '🐰': Colors.brand,  '🦁': Colors.orange,'🐧': Colors.brand,
    '🦉': Colors.green,  '🐸': Colors.green,
  };
  const ava   = student?.avatar ?? '🦊';
  const color = avatarColors[ava] ?? Colors.brand;

  if (loading) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:14 }]}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={[Typography.body3, { color:Colors.ink3 }]}>학생 데이터 로딩 중...</Text>
      </View>
    );
  }

  if (!student) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:12, padding:24 }]}>
        <Text style={{ fontSize:40 }}></Text>
        <Text style={[Typography.bold2, { color:Colors.ink }]}>학생 정보를 찾을 수 없어요</Text>
        <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center' }]}>
          학생이 아직 앱에 가입하지 않았을 수 있어요
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop:8, padding:13, borderRadius:12, backgroundColor:Colors.brand }}
        >
          <Text style={[Typography.bold2, { color:'#fff' }]}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize:18 }}>←</Text>
          </Pressable>
          <Text style={[Typography.h3, { flex:1 }]}>학생 상세</Text>
          <Pressable
            style={s.chatBtn}
            onPress={() => router.push('/(teacher)/messages' as any)}
          >
            <Text style={{ fontSize:14 }}></Text>
            <Text style={[Typography.label2, { color:Colors.brand }]}>채팅</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom:40 }}>
        {/* 프로필 카드 */}
        <View style={s.profileCard}>
          <View style={s.profileTop}>
            <View style={[s.avatar, { backgroundColor: color + '33' }]}>
              <Text style={{ fontSize:28 }}>{ava}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[Typography.h3, { letterSpacing:-.5 }]}>
                {student.displayName} · {student.grade}
              </Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginTop:2, marginBottom:8 }]}>
                학습 진행 중 {inProgressCount}개 · 완료 {completedCount}개
              </Text>
              <View style={{ flexDirection:'row', gap:7 }}>
                <View style={s.streakPill}>
                  <Text style={[Typography.label2, { color:Colors.amberText }]}> {streak}일</Text>
                </View>
                <View style={s.accPill}>
                  <Text style={[Typography.label2, { color:Colors.greenDk }]}>
                    완료율 {accuracy}%
                  </Text>
                </View>
                {wrongCnt > 0 && (
                  <View style={[s.streakPill, { backgroundColor:Colors.redBg, borderColor:'#fca5a5' }]}>
                    <Text style={[Typography.label2, { color:Colors.red }]}>
                      오답 {wrongCnt}개
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* KPI 3칸 */}
          <View style={s.statRow}>
            {[
              { lbl:'학습 자료', val:`${progress.length}개` },
              { lbl:'총 XP',    val:totalXp.toLocaleString(), color:Colors.brand },
              { lbl:'주간 XP',  val:`+${weeklyXp}`,           color:Colors.green },
            ].map((st, i) => (
              <View key={i} style={[
                s.statCell,
                i < 2 && { borderRightWidth:0.5, borderRightColor:Colors.line },
              ]}>
                <Text style={[Typography.statSm, { color:st.color ?? Colors.ink }]}>{st.val}</Text>
                <Text style={[Typography.label2, { color:Colors.ink3, marginTop:2 }]}>{st.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 주간 학습량 바 차트 */}
        <View style={[s.card, { margin:16, marginBottom:12 }]}>
          <Text style={[Typography.bold2, { marginBottom:14 }]}>주간 학습량 (단계 완료 수)</Text>
          {weekData.every(v => v === 0) ? (
            <View style={{ alignItems:'center', paddingVertical:20 }}>
              <Text style={[Typography.body3, { color:Colors.ink3 }]}>
                최근 7일 학습 기록이 없어요
              </Text>
            </View>
          ) : (
            <View style={s.barChart}>
              {weekData.map((v, i) => {
                const maxV = Math.max(...weekData, 1);
                return (
                  <View key={i} style={s.barCol}>
                    <View style={[s.bar, {
                      height: Math.max(4, Math.round(v / maxV * MAX_H)),
                      backgroundColor:
                        i === new Date().getDay() ? Colors.brand :
                        v > 0 ? Colors.brandBg + 'CC' : Colors.line,
                    }]} />
                    <Text style={[Typography.label3, {
                      color: i === new Date().getDay() ? Colors.brand : Colors.ink3,
                      marginTop:4,
                    }]}>
                      {WEEK_LABELS[i]}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* 학습 진도 목록 */}
        <View style={{ paddingHorizontal:16 }}>
          <View style={s.sectionRow}>
            <Text style={[Typography.bold2]}>학습 진도</Text>
            <Text style={[Typography.label2, { color:Colors.ink3 }]}>
              {completedCount}/{progress.length} 완료
            </Text>
          </View>

          {progress.length === 0 ? (
            <View style={[s.card, { alignItems:'center', paddingVertical:24 }]}>
              <Text style={{ fontSize:32, marginBottom:8 }}></Text>
              <Text style={[Typography.bold3, { color:Colors.ink3 }]}>
                아직 학습을 시작하지 않았어요
              </Text>
            </View>
          ) : (
            <View style={s.card}>
              {progress.slice(0,5).map((p, i) => {
                const done  = p.status === 'completed';
                const steps = p.completedSteps?.length ?? 0;
                return (
                  <View key={i} style={[
                    s.progressRow,
                    i < Math.min(progress.length,5)-1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line },
                  ]}>
                    <View style={[s.statusDot, {
                      backgroundColor: done ? Colors.green : steps > 0 ? Colors.amber : Colors.line,
                    }]} />
                    <View style={{ flex:1 }}>
                      <Text style={[Typography.bold3, { color:Colors.ink }]} numberOfLines={1}>
                        {p.lessonId}
                      </Text>
                      <Text style={[Typography.label2, { color:Colors.ink3, marginTop:1 }]}>
                        {steps}단계 완료 · XP {p.xpEarned ?? 0}
                      </Text>
                    </View>
                    <View style={[
                      s.statusTag,
                      done
                        ? { backgroundColor:Colors.greenBg }
                        : steps > 0
                          ? { backgroundColor:Colors.amberBg }
                          : { backgroundColor:Colors.bg },
                    ]}>
                      <Text style={[Typography.label3, {
                        color: done ? Colors.greenDk : steps > 0 ? Colors.amber : Colors.ink3,
                        fontWeight:'700',
                      }]}>
                        {done ? '완료' : steps > 0 ? '진행중' : '미시작'}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {progress.length > 5 && (
                <View style={{ paddingVertical:10, alignItems:'center' }}>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                    외 {progress.length - 5}개 자료 더 있음
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 맞춤 집중 테스트 CTA */}
        <Pressable
          style={s.sendBtn}
          onPress={() => router.push('/(teacher)/messages' as any)}
        >
          <Text style={{ fontSize:18 }}></Text>
          <Text style={[Typography.bold2, { color:'#fff' }]}>
            {student.displayName}에게 쪽지 보내기 →
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:18, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line },
  headerRow:   { flexDirection:'row', alignItems:'center', gap:10 },
  backBtn:     { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  chatBtn:     { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:Colors.brandBg, borderRadius:10, paddingHorizontal:12, paddingVertical:7 },
  profileCard: { backgroundColor:Colors.white, margin:16, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:16 },
  profileTop:  { flexDirection:'row', gap:14, marginBottom:14 },
  avatar:      { width:56, height:56, borderRadius:28, alignItems:'center', justifyContent:'center' },
  streakPill:  { backgroundColor:Colors.amberBg, borderRadius:99, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'#FDE68A' },
  accPill:     { backgroundColor:Colors.greenBg, borderRadius:99, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'#86efac' },
  statRow:     { flexDirection:'row', borderTopWidth:0.5, borderTopColor:Colors.line, paddingTop:12 },
  statCell:    { flex:1, alignItems:'center' },
  card:        { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:15 },
  barChart:    { flexDirection:'row', alignItems:'flex-end', gap:6, height:MAX_H+24 },
  barCol:      { flex:1, alignItems:'center', justifyContent:'flex-end' },
  bar:         { width:'100%', borderRadius:5, minHeight:4 },
  sectionRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  progressRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:11 },
  statusDot:   { width:8, height:8, borderRadius:4, flexShrink:0 },
  statusTag:   { paddingHorizontal:9, paddingVertical:3, borderRadius:7 },
  sendBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:Colors.brand, margin:16, borderRadius:16, padding:16, marginTop:14 },
});
