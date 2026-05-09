// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 (Growth & Admin) 소유 파일
// 원칙: 데이터 신뢰성 · B2B 지원 · 운영 자동화 · 리텐션 분석 · 문서 최신화
// 수정 전 CLAUDE.md 확인 필수 | academyId 필터 누락 금지
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, getDocs, query,
  where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Period = '일간' | '주간' | '월간' | '전체';
const WEEK_LABELS = ['월','화','수','목','금','토','일'];

interface Stats {
  totalUsers:    number;
  totalAcademies: number;
  dau:           number;
  totalXp:       number;
  completedLessons: number;
  wrongNotes:    number;
  weekSessions:  number[];
  gradeMap:      Record<string, number>;
  retentionPct:  number;
}

const EMPTY_STATS: Stats = {
  totalUsers:0, totalAcademies:0, dau:0, totalXp:0,
  completedLessons:0, wrongNotes:0, weekSessions:[0,0,0,0,0,0,0],
  gradeMap:{}, retentionPct:0,
};

export default function AdminStatsScreen() {
  const router = useRouter();
  const [period,      setPeriod]      = useState<Period>('월간');
  const [stats,       setStats]       = useState<Stats>(EMPTY_STATS);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const now    = new Date();
      const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
      const weekStart  = new Date(now); weekStart.setDate(now.getDate()-6); weekStart.setHours(0,0,0,0);

      // 1. 전체 사용자 수
      const usersSnap = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnap.size;

      // 2. 전체 학원 수
      const academiesSnap = await getDocs(collection(db, 'academies'));
      const totalAcademies = academiesSnap.size;

      // 3. DAU (오늘 lastStudied가 있는 progress 기반)
      let dau = 0;
      let totalXp = 0;
      let completedLessons = 0;
      const weekSessions   = [0,0,0,0,0,0,0];
      const gradeMap: Record<string,number> = {};
      let activeThisMonth  = 0;
      let activeLastMonth  = 0;
      const monthStart   = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth()-1);

      // 사용자별 진도 집계
      for (const userDoc of usersSnap.docs) {
        const uid  = userDoc.id;
        const data = userDoc.data();

        // 학년 분포
        const grade = data.grade ?? '기타';
        gradeMap[grade] = (gradeMap[grade] ?? 0) + 1;

        // XP & 진도
        const progressSnap = await getDocs(collection(db, 'users', uid, 'progress'));
        let userLastStudied: Date | null = null;

        for (const pDoc of progressSnap.docs) {
          const p = pDoc.data();
          totalXp += p.xpEarned ?? 0;
          if (p.status === 'completed') completedLessons++;

          if (p.lastStudied) {
            const d = p.lastStudied instanceof Timestamp
              ? p.lastStudied.toDate()
              : new Date(p.lastStudied);

            if (!userLastStudied || d > userLastStudied) userLastStudied = d;

            // 주간 세션 카운트 (요일 기준)
            if (d >= weekStart) {
              const diff = Math.floor((d.getTime() - weekStart.getTime()) / 86400000);
              if (diff >= 0 && diff < 7) weekSessions[diff]++;
            }
          }
        }

        if (userLastStudied) {
          if (userLastStudied >= todayStart) dau++;
          if (userLastStudied >= monthStart) activeThisMonth++;
          if (userLastStudied >= prevMonthStart && userLastStudied < monthStart) activeLastMonth++;
        }
      }

      // 4. 오답 미해결 수 (샘플링 — 전체 순회 비용 절감)
      let wrongNotes = 0;
      for (const userDoc of usersSnap.docs.slice(0, 50)) {
        const wSnap = await getDocs(
          query(collection(db, 'users', userDoc.id, 'wrongNotes'), where('status','==','unresolved'))
        );
        wrongNotes += wSnap.size;
      }

      // 5. 리텐션 (전월 활성 → 이번 달도 활성 비율)
      const retentionPct = activeLastMonth > 0
        ? Math.round((activeThisMonth / activeLastMonth) * 100)
        : 0;

      setStats({
        totalUsers, totalAcademies, dau, totalXp, completedLessons,
        wrongNotes, weekSessions, gradeMap, retentionPct,
      });
      setLastUpdated(now.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' }));
    } catch (e) {
      console.error('통계 집계 실패:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  const maxWeek    = Math.max(...stats.weekSessions, 1);
  const gradeList  = Object.entries(stats.gradeMap)
    .sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxGrade   = Math.max(...gradeList.map(([,v])=>v), 1);

  if (loading) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:16 }]}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={[Typography.bold2, { color:Colors.ink }]}>통계 집계 중...</Text>
        <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center' }]}>
          사용자 데이터를 분석하고 있어요
        </Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {/* 다크 히어로 */}
      <View style={s.hero}>
        <Text style={[Typography.label2, { color:'rgba(255,255,255,.5)', marginBottom:4 }]}>
          관리자 · 실시간 데이터
        </Text>
        <View style={{ flexDirection:'row', alignItems:'flex-end', justifyContent:'space-between', marginBottom:4 }}>
          <Text style={[Typography.h2, { color:'#fff' }]}>서비스 통계</Text>
          {lastUpdated && (
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.4)' }]}>
              업데이트 {lastUpdated}
            </Text>
          )}
        </View>
        <View style={{ flexDirection:'row', gap:7 }}>
          {(['일간','주간','월간','전체'] as Period[]).map(p => (
            <Pressable key={p} onPress={() => setPeriod(p)}
              style={[s.periodBtn, period===p && { backgroundColor:Colors.brand }]}>
              <Text style={[Typography.label2, { color:period===p?'#fff':'rgba(255,255,255,.6)' }]}>
                {p}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding:16, paddingBottom:40, backgroundColor:Colors.bg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}
      >
        {/* KPI 카드 */}
        <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
          {[
            { lbl:'전체 학생', val: stats.totalUsers.toLocaleString(),    color: Colors.brand  },
            { lbl:'오늘 접속', val: stats.dau.toLocaleString(),           color: Colors.green  },
            { lbl:'등록 학원', val: stats.totalAcademies.toLocaleString(), color: Colors.orange },
          ].map((k, i) => (
            <View key={i} style={s.kpiCard}>
              <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:3 }]}>{k.lbl}</Text>
              <Text style={[Typography.statSm, { color:k.color }]}>{k.val}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
          {[
            { lbl:'완료 학습', val: stats.completedLessons.toLocaleString(), color: Colors.brand  },
            { lbl:'총 XP',    val: (stats.totalXp/1000).toFixed(1)+'K',     color: Colors.amber  },
            { lbl:'리텐션',   val: stats.retentionPct+'%',                    color: Colors.green  },
          ].map((k, i) => (
            <View key={i} style={s.kpiCard}>
              <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:3 }]}>{k.lbl}</Text>
              <Text style={[Typography.statSm, { color:k.color }]}>{k.val}</Text>
            </View>
          ))}
        </View>

        {/* 주간 학습 세션 바 차트 */}
        <View style={s.card}>
          <Text style={[Typography.bold2, { marginBottom:14 }]}>주간 학습 세션 (최근 7일)</Text>
          <View style={s.barChart}>
            {stats.weekSessions.map((v, i) => {
              const todayIdx = (new Date().getDay() + 6) % 7; // 월=0
              return (
                <View key={i} style={s.barCol}>
                  <Text style={[Typography.label3, {
                    color: i===todayIdx ? Colors.brand : Colors.ink3,
                    marginBottom:4, fontSize:10,
                  }]}>{v > 0 ? v : ''}</Text>
                  <View style={[s.bar, {
                    height: Math.max(4, Math.round(v/maxWeek*60)),
                    backgroundColor: i===todayIdx ? Colors.brand
                      : v > 0 ? Colors.brandBg : Colors.line,
                  }]} />
                  <Text style={[Typography.label3, {
                    color: i===todayIdx ? Colors.brand : Colors.ink3,
                    marginTop:4, fontSize:9,
                  }]}>{WEEK_LABELS[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 오답 현황 */}
        <View style={[s.card, {
          borderColor: stats.wrongNotes > 50 ? '#fca5a5' : Colors.line,
          borderWidth: stats.wrongNotes > 50 ? 1.5 : 1,
        }]}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <Text style={[Typography.bold2]}>미해결 오답 현황</Text>
            {stats.wrongNotes > 50 && (
              <View style={{ backgroundColor:Colors.redBg, borderRadius:9, paddingHorizontal:10, paddingVertical:3 }}>
                <Text style={[Typography.label3, { color:Colors.red, fontWeight:'700' }]}>주의 필요</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            <Text style={{ fontSize:36, fontWeight:'800', color:stats.wrongNotes > 50 ? Colors.red : Colors.ink }}>
              {stats.wrongNotes.toLocaleString()}
            </Text>
            <View>
              <Text style={[Typography.body3, { color:Colors.ink3 }]}>건</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>상위 50명 기준 샘플링</Text>
            </View>
          </View>
        </View>

        {/* 학년별 분포 */}
        <View style={s.card}>
          <Text style={[Typography.bold2, { marginBottom:12 }]}>학년별 학생 분포</Text>
          {gradeList.length === 0 ? (
            <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', paddingVertical:12 }]}>
              데이터 없음
            </Text>
          ) : gradeList.map(([grade, cnt], i) => (
            <View key={i} style={[s.rankRow, i < gradeList.length-1 && { marginBottom:10 }]}>
              <Text style={[Typography.bold3, { color:Colors.brand, width:32 }]}>{grade}</Text>
              <View style={[s.barTrack, { flex:1, marginHorizontal:10 }]}>
                <View style={[s.barFill, {
                  width: `${Math.round(cnt/maxGrade*100)}%` as any,
                  backgroundColor: i===0 ? Colors.brand : i===1 ? '#9B8FFF' : Colors.brandBg,
                }]} />
              </View>
              <Text style={[Typography.bold3, { color:Colors.ink3, width:40, textAlign:'right' }]}>
                {cnt.toLocaleString()}명
              </Text>
            </View>
          ))}
        </View>

        {/* 새로고침 안내 */}
        <Pressable onPress={onRefresh} style={s.refreshBtn}>
          <Text style={{ fontSize:16 }}></Text>
          <Text style={[Typography.bold2, { color:Colors.brand }]}>데이터 새로고침</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex:1 },
  hero:       { backgroundColor:'#1a1a2e', paddingTop:52, paddingHorizontal:20, paddingBottom:20 },
  periodBtn:  { paddingHorizontal:13, paddingVertical:5, borderRadius:99, backgroundColor:'rgba(255,255,255,.1)' },
  kpiCard:    { flex:1, backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, padding:12 },
  card:       { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:15, marginBottom:12 },
  barChart:   { flexDirection:'row', alignItems:'flex-end', height:90, gap:6 },
  barCol:     { flex:1, alignItems:'center', justifyContent:'flex-end' },
  bar:        { width:'100%', borderRadius:5, minHeight:4 },
  rankRow:    { flexDirection:'row', alignItems:'center', gap:8 },
  barTrack:   { height:5, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  barFill:    { height:'100%', borderRadius:99 },
  refreshBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:Colors.brandBg, borderRadius:14, padding:14, marginTop:4 },
});
