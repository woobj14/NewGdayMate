// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 — 학부모 주간 리포트 생성 및 공유
// 학생별 주간 학습 요약 → PDF/링크로 학부모에게 공유
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, ActivityIndicator, Share, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppStore } from '../../stores/useAppStore';
import { Colors } from '../../constants/colors';
import { Shadow } from '../../constants/shadow';
import { Typography } from '../../constants/typography';

interface StudentReport {
  uid:         string;
  name:        string;
  avatar:      string;
  grade:       string;
  weeklyXp:    number;
  streak:      number;
  completedLessons: number;
  accuracy:    number;
  wrongNotes:  number;
  strongPoints: string[];
  weakPoints:  string[];
}

export default function ReportScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const [reports,   setReports]   = useState<StudentReport[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sharing,   setSharing]   = useState<string|null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    (async () => {
      try {
        const oneWeekAgo = new Date(Date.now() - 7*86400000);
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('academyId', '==', user.academyId)
        ));

        const list: StudentReport[] = [];
        for (const d of snap.docs) {
          const uid  = d.id;
          const data = d.data();
          const pSnap = await getDocs(collection(db, 'users', uid, 'progress'));
          let weeklyXp=0, completedLessons=0;
          pSnap.docs.forEach(p => {
            const ls = p.data().lastStudied?.toDate?.();
            if (ls && ls > oneWeekAgo) weeklyXp += p.data().xpEarned ?? 0;
            if (p.data().status === 'completed') completedLessons++;
          });
          const wSnap = await getDocs(
            query(collection(db, 'users', uid, 'wrongNotes'), where('status','==','unresolved'))
          );
          list.push({
            uid, name:data.displayName??'학생',
            avatar:   data.avatar ?? '🦊',
            grade:    data.grade ?? '중3',
            weeklyXp, completedLessons,
            streak:   data.streak ?? 0,
            accuracy: data.accuracy ?? 0,
            wrongNotes: wSnap.size,
            strongPoints: weeklyXp > 300 ? ['꾸준한 학습', '높은 완료율'] : ['꾸준한 참여'],
            weakPoints:   wSnap.size > 5 ? ['오답 정리 필요', '취약 유형 집중'] : wSnap.size > 0 ? ['오답 정리 필요'] : [],
          });
        }
        setReports(list.sort((a,b)=>b.weeklyXp-a.weeklyXp));
      } catch {
        setReports([
          { uid:'1', name:'김지민', avatar:'🦊', grade:'중3', weeklyXp:290, streak:14, completedLessons:3, accuracy:78, wrongNotes:4, strongPoints:['꾸준한 학습','어휘 실력'], weakPoints:['어법 오답 정리'] },
          { uid:'2', name:'박서윤', avatar:'🐯', grade:'중3', weeklyXp:420, streak:21, completedLessons:5, accuracy:91, wrongNotes:1, strongPoints:['우수한 정답률','리더십'], weakPoints:[] },
          { uid:'3', name:'이도현', avatar:'🐻', grade:'중3', weeklyXp:50,  streak:0,  completedLessons:0, accuracy:42, wrongNotes:8, strongPoints:[], weakPoints:['학습 재개 필요','취약 유형 집중'] },
        ]);
      } finally { setLoading(false); }
    })();
  }, [user?.academyId]);

  // 리포트 텍스트 생성
  const buildReportText = (r: StudentReport) => {
    const weekStr = new Date().toLocaleDateString('ko-KR',{month:'long',day:'numeric'});
    return `
 G'day Mate 주간 학습 리포트
━━━━━━━━━━━━━━━━━━━━━
 ${r.name} (${r.grade})
 ${weekStr} 기준

 이번 주 학습 현황
  • 획득 XP: ${r.weeklyXp} XP
  • 연속 학습: ${r.streak}일
  • 완료 자료: ${r.completedLessons}개
  • 평균 정답률: ${r.accuracy}%
  • 미해결 오답: ${r.wrongNotes}개

 잘하고 있는 점
${r.strongPoints.length > 0 ? r.strongPoints.map(s=>`  • ${s}`).join('\n') : '  • 계속 노력 중'}

 집중이 필요한 부분
${r.weakPoints.length > 0 ? r.weakPoints.map(w=>`  • ${w}`).join('\n') : '  • 현재 문제없음 '}

━━━━━━━━━━━━━━━━━━━━━
G'day Mate AI 영어 학습 앱
    `.trim();
  };

  const shareReport = async (r: StudentReport) => {
    setSharing(r.uid);
    try {
      await Share.share({
        message: buildReportText(r),
        title:   `${r.name} 주간 학습 리포트`,
      });
    } catch { Alert.alert('오류', '공유 실패'); }
    finally { setSharing(null); }
  };

  const shareSelected = async () => {
    const selectedReports = reports.filter(r => selected.has(r.uid));
    if (selectedReports.length === 0) return;
    const combined = selectedReports.map(buildReportText).join('\n\n' + '═'.repeat(30) + '\n\n');
    try {
      await Share.share({ message:combined, title:'반 전체 주간 학습 리포트' });
    } catch { Alert.alert('오류', '공유 실패'); }
  };

  const toggleSelect = (uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:18 }}>←</Text>
        </Pressable>
        <View style={{ flex:1 }}>
          <Text style={[Typography.h3]}>학부모 리포트</Text>
          <Text style={[Typography.label2, { color:Colors.ink3 }]}>주간 학습 현황 공유</Text>
        </View>
        {selected.size > 0 && (
          <Pressable
            style={{ backgroundColor:Colors.brand, borderRadius:10, paddingHorizontal:13, paddingVertical:8 }}
            onPress={shareSelected}
          >
            <Text style={[Typography.bold3, { color:'#fff' }]}>{selected.size}명 공유</Text>
          </Pressable>
        )}
      </View>

      {/* 전체 선택 */}
      <View style={{ flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:10, backgroundColor:Colors.white, borderBottomWidth:0.5, borderBottomColor:Colors.line }}>
        <Text style={[Typography.bold3, { color:Colors.ink }]}>학생 {reports.length}명</Text>
        <Pressable onPress={() => setSelected(selected.size===reports.length ? new Set() : new Set(reports.map(r=>r.uid)))}>
          <Text style={[Typography.label2, { color:Colors.brand }]}>
            {selected.size===reports.length ? '전체 해제' : '전체 선택'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={Colors.brand} size="large"/>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:14, paddingBottom:40, gap:10 }}>
          {reports.map(r => (
            <View key={r.uid} style={[
              s.reportCard,
              selected.has(r.uid) && { borderColor:Colors.brand, borderWidth:2 },
              ...([Shadow.card] as any),
            ]}>
              <Pressable onPress={() => toggleSelect(r.uid)} style={s.cardTop}>
                <View style={s.checkbox}>
                  {selected.has(r.uid) && (
                    <View style={s.checkFill}>
                      <Text style={{ color:'#fff', fontSize:12, fontWeight:'800' }}>V</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize:28 }}>{r.avatar}</Text>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:2 }}>
                    <Text style={[Typography.bold2, { color:Colors.ink }]}>{r.name}</Text>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>{r.grade}</Text>
                  </View>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                    이번주 {r.weeklyXp} XP · {r.streak}일 · 정답률 {r.accuracy}%
                  </Text>
                </View>
              </Pressable>

              {/* KPI */}
              <View style={s.kpiRow}>
                {[
                  { val:`${r.weeklyXp}`,       lbl:'주간XP',  color:Colors.brand },
                  { val:`${r.completedLessons}개`, lbl:'완료',  color:Colors.green },
                  { val:`${r.accuracy}%`,       lbl:'정답률', color:Colors.amber },
                  { val:`${r.wrongNotes}개`,    lbl:'오답',   color:r.wrongNotes>5?Colors.red:Colors.ink3 },
                ].map((k,i) => (
                  <View key={i} style={[s.kpiCell, i<3&&{borderRightWidth:0.5,borderRightColor:Colors.line}]}>
                    <Text style={[Typography.bold3, { color:k.color, fontSize:14 }]}>{k.val}</Text>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>{k.lbl}</Text>
                  </View>
                ))}
              </View>

              {/* 강점/약점 */}
              {(r.strongPoints.length>0 || r.weakPoints.length>0) && (
                <View style={{ paddingTop:10, borderTopWidth:0.5, borderTopColor:Colors.line, gap:5 }}>
                  {r.strongPoints.map((sp,i) => (
                    <Text key={i} style={[Typography.label2, { color:Colors.greenDk }]}> {sp}</Text>
                  ))}
                  {r.weakPoints.map((wp,i) => (
                    <Text key={i} style={[Typography.label2, { color:Colors.red }]}> {wp}</Text>
                  ))}
                </View>
              )}

              {/* 공유 버튼 */}
              <Pressable
                style={s.shareBtn}
                onPress={() => shareReport(r)}
                disabled={sharing===r.uid}
              >
                {sharing===r.uid
                  ? <ActivityIndicator color={Colors.brand} size="small"/>
                  : <Text style={[Typography.bold3, { color:Colors.brand }]}> 리포트 공유</Text>
                }
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  header:     { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, flexDirection:'row', alignItems:'center', gap:12, borderBottomWidth:0.5, borderBottomColor:Colors.line },
  backBtn:    { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  reportCard: { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:14 },
  cardTop:    { flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 },
  checkbox:   { width:22, height:22, borderRadius:7, borderWidth:2, borderColor:Colors.line, alignItems:'center', justifyContent:'center', flexShrink:0 },
  checkFill:  { width:'100%', height:'100%', borderRadius:5, backgroundColor:Colors.brand, alignItems:'center', justifyContent:'center' },
  kpiRow:     { flexDirection:'row', borderTopWidth:0.5, borderTopColor:Colors.line, paddingTop:10, marginBottom:10 },
  kpiCell:    { flex:1, alignItems:'center' },
  shareBtn:   { alignItems:'center', paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:Colors.brand, backgroundColor:Colors.brandBg, marginTop:8 },
});
