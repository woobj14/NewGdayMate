// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppStore } from '../../stores/useAppStore';
import { Colors } from '../../constants/colors';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_LABEL, ContentType } from '../../types/lesson';
import {
  Upload, FileSpreadsheet, Layers, BarChart2,
  MessageCircle, Users, ChevronRight, Flame,
  AlertCircle, CheckCircle, TrendingUp,
} from 'lucide-react-native';
import { Typography } from '../../constants/typography';

interface StudentSummary {
  uid: string; displayName: string; streak: number;
  accuracy: number; xp: number; isAtRisk: boolean;
}

interface RecentContent {
  id: string;
  title: string;
  publisher: string;
  grade: string;
  unit: string;
  type: ContentType;
  wordCount: number;
  stepCount: number;
  quizCount: number;
  createdAtMs: number;
}

const FALLBACK_STUDENTS: StudentSummary[] = [
  { uid:'1', displayName:'김지민', streak:14, accuracy:78, xp:1620, isAtRisk:false },
  { uid:'2', displayName:'박서윤', streak:21, accuracy:91, xp:2150, isAtRisk:false },
  { uid:'3', displayName:'이도현', streak:0,  accuracy:42, xp:480,  isAtRisk:true  },
];

export default function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAppStore();
  const [students,  setStudents]  = useState<StudentSummary[]>(FALLBACK_STUDENTS);
  const [msgCount,  setMsgCount]  = useState(0);
  const [unresolvedMsg, setUnresolvedMsg] = useState(0);
  const [recentContents, setRecentContents] = useState<RecentContent[]>([]);
  const [contentLoading, setContentLoading] = useState(true);

  // Firestore 학생 목록 로드
  useEffect(() => {
    if (!user?.academyId) return;
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'student'),
      where('academyId', '==', user.academyId)
    );
    const unsub = onSnapshot(q, async snap => {
      const list: StudentSummary[] = [];
      for (const doc of snap.docs) {
        const d   = doc.data();
        const uid = doc.id;
        const pSnap = await import('firebase/firestore').then(({ getDocs, collection: col }) =>
          getDocs(col(db, 'users', uid, 'progress'))
        );
        let totalXp = 0;
        pSnap.docs.forEach(p => { totalXp += p.data().xpEarned ?? 0; });
        list.push({
          uid,
          displayName: d.displayName ?? '이름없음',
          streak:      d.streak ?? 0,
          accuracy:    d.accuracy ?? 0,
          xp:          totalXp,
          isAtRisk:    (d.streak ?? 0) === 0 || totalXp < 100,
        });
      }
      if (list.length > 0) setStudents(list);
    });

    // 미읽은 쪽지 수
    const msgQ = query(
      collection(db, 'messages'),
      where('toUid', '==', user.uid),
      where('read', '==', false)
    );
    const msgUnsub = onSnapshot(msgQ, snap => {
      setMsgCount(snap.size);
      setUnresolvedMsg(snap.size);
    });

    return () => { unsub(); msgUnsub(); };
  }, [user?.academyId]);

  // 최근 배포 자료 로드
  useEffect(() => {
    if (!user?.academyId) {
      setRecentContents([]);
      setContentLoading(false);
      return;
    }

    const contentQ = query(
      collection(db, 'content'),
      where('academyId', '==', user.academyId)
    );

    const unsub = onSnapshot(contentQ, snap => {
      const list = snap.docs
        .map(docSnap => {
          const d = docSnap.data();
          const createdAt = d.createdAt?.toDate?.();
          return {
            id: docSnap.id,
            title: d.title ?? '제목 없는 자료',
            publisher: d.publisher ?? '',
            grade: d.grade ?? '',
            unit: d.unit ?? '',
            type: d.type ?? 'word',
            wordCount: d.wordCount ?? 0,
            stepCount: d.stepCount ?? 0,
            quizCount: d.quizCount ?? 0,
            createdAtMs: createdAt instanceof Date ? createdAt.getTime() : 0,
          } as RecentContent;
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 4);

      setRecentContents(list);
      setContentLoading(false);
    }, () => {
      setRecentContents([]);
      setContentLoading(false);
    });

    return () => unsub();
  }, [user?.academyId]);

  const activeCount  = students.filter(s => s.streak > 0).length;
  const atRiskCount  = students.filter(s => s.isAtRisk).length;
  const avgAccuracy  = Math.round(students.reduce((a, s) => a + s.accuracy, 0) / students.length);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 3 }]}>
              {user?.displayName ?? '이재영'} 선생님 · 중3 A반
            </Text>
            <Text style={[Typography.h2]}>오늘 한눈에</Text>
          </View>
          <Pressable style={s.teacherAva} onPress={() => router.push('/(teacher)/profile' as any)}>
            <Text style={[Typography.h3, { color: '#fff' }]}>李</Text>
          </Pressable>
        </View>
      </View>

      {/* KPI 그리드 */}
      <View style={s.kpiGrid}>
        <View style={s.kpiCard}>
          <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 5 }]}>활동 학생</Text>
          <Text style={[Typography.stat, { color: Colors.ink }]}>{activeCount} <Text style={[Typography.body1, { color: Colors.ink3 }]}>/ {students.length}</Text></Text>
          <Text style={[Typography.label2, { color: Colors.green, marginTop: 3 }]}>● 오늘 접속</Text>
        </View>
        <View style={[s.kpiCard, { borderColor: '#fca5a5', backgroundColor: Colors.redBg }]}>
          <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 5 }]}>주의 필요</Text>
          <Text style={[Typography.stat, { color: Colors.red }]}>{atRiskCount}명</Text>
          <Text style={[Typography.label2, { color: Colors.red, marginTop: 3 }]}>미접속 3일+</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 5 }]}>평균 정답률</Text>
          <Text style={[Typography.stat, { color: Colors.green }]}>{avgAccuracy}%</Text>
          <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 3 }]}>지난주 대비 +4%</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 5 }]}>받은 질문</Text>
          <Text style={[Typography.stat, { color: Colors.blue }]}>{msgCount}건</Text>
          <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 3 }]}>미읽은 {unresolvedMsg}건</Text>
        </View>
      </View>

      {/* 학급 현황 */}
      <View style={s.section}>
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>오늘 학급 현황</Text>
          <Pressable onPress={() => router.push('/(teacher)/students')}> 
            <View style={{flexDirection:'row',alignItems:'center',gap:2}}><Text style={[Typography.label1, { color: Colors.brand }]}>전체 보기</Text><ChevronRight size={13} color={Colors.brand} strokeWidth={2.5}/></View>
          </Pressable>
        </View>
        <View style={[s.weakCard, { flexDirection:'row', gap:0 }]}>
          {[
            { val:`${activeCount}명`, lbl:'오늘 학습', color:Colors.green },
            { val:`${atRiskCount}명`, lbl:'주의 필요', color:Colors.red },
            { val:`${avgAccuracy}%`,  lbl:'평균 정답률', color:Colors.brand },
          ].map((item, i) => (
            <View key={i} style={[{ flex:1, alignItems:'center', paddingVertical:14 },
              i > 0 && { borderLeftWidth:0.5, borderLeftColor:Colors.line }
            ]}>
              <Text style={[Typography.statSm, { color:item.color }]}>{item.val}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3, marginTop:3 }]}>{item.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 빠른 메뉴 */}
      <View style={s.section}>
        <Text style={[Typography.h4, { marginBottom: 10 }]}>빠른 메뉴</Text>
        <View style={{ flexDirection: 'row', gap: 9 }}>
          {[
            { label:'자료 업로드', sub:'AI 파싱', Icon:Upload,          bg:Colors.brandBg, color:Colors.brand, route:'/(teacher)/content' },
            { label:'스피킹 아웃', sub:'엑셀 생성', Icon:FileSpreadsheet, bg:Colors.greenBg, color:Colors.green, route:'/(teacher)/speaking-out' },
            { label:'커리큘럼',   sub:'단원 묶기', Icon:Layers,          bg:Colors.brandBg, color:Colors.brand, route:'/(teacher)/curriculum' },
            { label:'학부모 리포트',sub:'주간 공유', Icon:BarChart2,      bg:Colors.greenBg, color:Colors.green, route:'/(teacher)/report' },
            { label:'쪽지함',     sub:'학생 질문', Icon:MessageCircle,   bg:Colors.amberBg, color:Colors.amber, route:'/(teacher)/messages' },
          ].map((m,i) => (
            <Pressable key={i} style={s.quickBtn} onPress={() => router.push(m.route as any)}>
              <View style={[s.quickIco, { backgroundColor:m.bg }]}>
                <m.Icon size={18} color={m.color} strokeWidth={1.8}/>
              </View>
              <Text style={[Typography.bold3, { color:Colors.ink, marginTop:6, textAlign:'center' }]}>{m.label}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>{m.sub}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 최근 배포 자료 */}
      <View style={s.section}>
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>최근 배포 자료</Text>
          <Pressable onPress={() => router.push('/(teacher)/content/list' as any)}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
              <Text style={[Typography.label1, { color: Colors.brand }]}>전체 보기</Text>
              <ChevronRight size={13} color={Colors.brand} strokeWidth={2.5}/>
            </View>
          </Pressable>
        </View>
        <View style={s.contentList}>
          {contentLoading ? (
            <View style={s.emptyContent}>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>자료 목록 불러오는 중...</Text>
            </View>
          ) : recentContents.length === 0 ? (
            <View style={s.emptyContent}>
              <Text style={[Typography.bold3, { color:Colors.ink }]}>아직 배포된 자료가 없어요</Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>자료를 올리면 여기에 바로 표시됩니다</Text>
            </View>
          ) : recentContents.map((content, i) => {
            const color = CONTENT_TYPE_COLOR[content.type] ?? Colors.brand;
            const label = CONTENT_TYPE_LABEL[content.type] ?? content.type;
            return (
              <Pressable
                key={content.id}
                style={[s.contentRow, i < recentContents.length - 1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}
                onPress={() => router.push('/(teacher)/content/list' as any)}
              >
                <View style={[s.contentTypeMark, { backgroundColor: color + '18' }]}>
                  <Text style={[Typography.label3, { color, fontWeight:'800' }]}>{label.slice(0, 2)}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={[Typography.bold3, { color:Colors.ink }]} numberOfLines={1}>{content.title}</Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginTop:2 }]} numberOfLines={1}>
                    {content.publisher} · {content.grade} · {content.unit}
                  </Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={[Typography.label2, { color }]}>
                    {label}
                  </Text>
                  <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>
                    단어 {content.wordCount}개
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 학생 목록 */}
      <View style={s.section}>
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>학생 목록</Text>
          <Pressable onPress={() => router.push('/(teacher)/students')}>
            <View style={{flexDirection:'row',alignItems:'center',gap:2}}><Text style={[Typography.label1, { color: Colors.brand }]}>전체</Text><ChevronRight size={13} color={Colors.brand} strokeWidth={2.5}/></View>
          </Pressable>
        </View>
        <View style={s.studentList}>
          {students.map((st, i) => (
            <Pressable
              key={st.uid}
              style={[s.studentRow, i < students.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: Colors.line }]}
              onPress={() => router.push(`/(teacher)/students/${st.uid}`)}
            >
              <View style={[s.stuAva, { backgroundColor: st.isAtRisk ? Colors.ink3 : Colors.brand }]}>
                <Text style={[Typography.bold3, { color: '#fff' }]}>{st.displayName[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Text style={[Typography.bold3, { color: Colors.ink }]}>{st.displayName}</Text>
                  {st.isAtRisk && (
                    <View style={s.riskTag}>
                      <Text style={[Typography.label3, { color: Colors.red }]}>주의</Text>
                    </View>
                  )}
                </View>
                <Text style={[Typography.label2, { color: Colors.ink3 }]}>
                  {st.streak}일 연속 · 정답률 {st.accuracy}%
                </Text>
              </View>
              <View style={s.accBar}>
                <View style={[s.accFill, {
                  width: `${st.accuracy}%` as any,
                  backgroundColor: st.accuracy >= 80 ? Colors.green : st.accuracy >= 60 ? Colors.amber : Colors.red,
                }]} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:        { flex: 1, backgroundColor: Colors.bg },
  header:      { backgroundColor: Colors.white, paddingTop: 52, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.line, marginBottom: 14 },
  teacherAva:  { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' },
  kpiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: 16, marginBottom: 14 },
  kpiCard:     { width: '47.5%', backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 14 },
  section:     { paddingHorizontal: 16, marginBottom: 14 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  weakCard:    { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 15 },
  weakRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  barTrack:    { height: 5, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 99 },
  studentList: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden' },
  studentRow:  { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  stuAva:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  riskTag:     { backgroundColor: Colors.redBg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  accBar:      { width: 60, height: 4, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  accFill:     { height: '100%', borderRadius: 99 },
  contentList: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden' },
  contentRow:  { flexDirection:'row', alignItems:'center', gap:11, padding:13 },
  contentTypeMark: { width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center' },
  emptyContent: { padding:18, alignItems:'center', justifyContent:'center' },
  quickBtn:    { flex: 1, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line, padding: 13, alignItems: 'center' },
  quickIco:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
