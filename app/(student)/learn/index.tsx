// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { EmptyState, LoadingState } from '../../../components/ui';
import {
  View, Text, ScrollView, Pressable,
  TextInput, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLesson } from '../../../hooks/useLesson';
import {
  STEP_DEFS, CONTENT_TYPE_LABEL, CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI,
  ContentType, LessonContent,
} from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { ChevronRight, Search, BookOpen, MessageSquare, FileText, Layers } from 'lucide-react-native';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

// 트랙 표시 순서 (단원 내 정렬)
const TRACK_ORDER: ContentType[] = ['word','dialog','reading','grammar'];

// 데모 데이터 fallback
const DEMO: LessonContent[] = [
  { id:'d5', title:'천재교육 중3 3과 단어',   publisher:'천재교육', author:'이재영', grade:'중3', unit:'3과', type:'word',    wordCount:72, stepCount:4, quizCount:0,  assignedBy:'', academyId:'', createdAt:new Date() },
  { id:'d1', title:'천재교육 중3 3과 대화문', publisher:'천재교육', author:'이재영', grade:'중3', unit:'3과', type:'dialog',  wordCount:0,  stepCount:6, quizCount:20, assignedBy:'', academyId:'', createdAt:new Date() },
  { id:'d3', title:'천재교육 중3 3과 본문',   publisher:'천재교육', author:'이재영', grade:'중3', unit:'3과', type:'reading', wordCount:0,  stepCount:6, quizCount:20, assignedBy:'', academyId:'', createdAt:new Date() },
  { id:'d4', title:'천재교육 중3 3과 문법',   publisher:'천재교육', author:'이재영', grade:'중3', unit:'3과', type:'grammar', wordCount:0,  stepCount:4, quizCount:20, assignedBy:'', academyId:'', createdAt:new Date() },
  { id:'d2', title:'천재교육 중3 2과 대화문', publisher:'천재교육', author:'이재영', grade:'중3', unit:'2과', type:'dialog',  wordCount:0,  stepCount:6, quizCount:20, assignedBy:'', academyId:'', createdAt:new Date() },
];
const DEMO_PCT: Record<string, number> = { d5:50, d1:65, d2:100, d3:0, d4:0 };

// ── 헬퍼 ────────────────────────────────────────────────────────
function pctLabel(pct: number) {
  if (pct >= 100) return { label:'완료', bg:Colors.greenBg, text:Colors.greenDk };
  if (pct > 0)    return { label:'진행 중', bg:Colors.amberBg, text:Colors.amberDk };
  return              { label:'미시작', bg:Colors.bg, text:Colors.ink3 };
}

function btnLabel(pct: number) {
  if (pct >= 100) return '복습하기';
  if (pct > 0)    return '계속 학습 →';
  return              '학습 시작 →';
}

function gradeSortValue(grade: string) {
  const normalized = String(grade ?? '').trim();
  const order = ['중1', '중2', '중3', '고1', '고2', '고3'];
  const idx = order.indexOf(normalized);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

export default function LearnIndexScreen() {
  const router = useRouter();
  const { lessons, loading, getPct } = useLesson();

  const [search, setSearch] = useState('');
  const [grade,  setGrade]  = useState('전체');
  const [pub,    setPub]    = useState('전체');
  const [tab,    setTab]    = useState<'unit' | 'list'>('unit'); // 단원별 / 전체 목록

  const data = lessons.length > 0 ? lessons : DEMO;

  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(
        data
          .map(item => String(item.grade ?? '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => {
      const aValue = gradeSortValue(a);
      const bValue = gradeSortValue(b);
      if (aValue !== bValue) return aValue - bValue;
      return a.localeCompare(b, 'ko');
    });
    return ['전체', ...grades];
  }, [data]);

  const publisherOptions = useMemo(() => {
    const publishers = Array.from(
      new Set(
        data
          .map(item => String(item.publisher ?? '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'ko'));
    return ['전체', ...publishers];
  }, [data]);

  // 필터 적용
  const filtered = useMemo(() => data.filter(l => {
    const matchSearch = !search || l.title.includes(search) || l.publisher.includes(search) || l.unit?.includes(search);
    const matchGrade  = grade === '전체' || l.grade === grade;
    const matchPub    = pub   === '전체' || l.publisher === pub;
    return matchSearch && matchGrade && matchPub;
  }), [data, search, grade, pub]);

  // 단원별 그룹핑
  const unitGroups = useMemo(() => {
    const map: Record<string, LessonContent[]> = {};
    filtered.forEach(l => {
      const key = `${l.publisher}_${l.grade}_${l.unit ?? '기타'}`;
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    // 각 그룹 내 트랙 순서 정렬
    Object.values(map).forEach(g =>
      g.sort((a, b) => TRACK_ORDER.indexOf(a.type as ContentType) - TRACK_ORDER.indexOf(b.type as ContentType))
    );
    return map;
  }, [filtered]);

  const getPctSafe = (lesson: LessonContent) =>
    lessons.length > 0 ? getPct(lesson.id, lesson.stepCount) : (DEMO_PCT[lesson.id] ?? 0);

  // 단원 전체 진도
  const unitPct = (group: LessonContent[]) => {
    const total = group.reduce((s, l) => s + l.stepCount, 0);
    const done  = group.reduce((s, l) => s + Math.round(getPctSafe(l) / 100 * l.stepCount), 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  if (loading) return (
    <View style={{ flex:1, backgroundColor:Colors.bg }}>
      <LoadingState label="학습 자료 불러오는 중..." />
    </View>
  );

  if (!loading && data.length === 0) return (
    <View style={{ flex:1, backgroundColor:Colors.bg }}>
      <EmptyState
        emoji=""
        title="등록된 자료가 없어요"
        desc={'선생님이 학습 자료를 등록하면\n여기에 나타나요'}
      />
    </View>
  );

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <Text style={[Typography.h2, { marginBottom:12, letterSpacing:-.5 }]}>학습 자료</Text>

        {/* 검색 */}
        <View style={s.searchRow}>
          <Search size={14} color={Colors.ink3} strokeWidth={2}/>
          <TextInput
            style={s.searchInput}
            placeholder="단원, 출판사, 자료명 검색..."
            placeholderTextColor={Colors.ink3}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ fontSize:14, color:Colors.ink3 }}>X</Text>
            </Pressable>
          )}
        </View>

        {/* 탭: 단원별 / 전체 목록 */}
        <View style={s.tabRow}>
          {(['unit','list'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={[s.tabBtn, tab===t && s.tabActive]}>
              <Text style={[Typography.label2, { color: tab===t ? Colors.brand : Colors.ink3 }]}>
                {t==='unit' ? ' 단원별' : ' 전체 목록'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 필터 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:6 }}>
          <View style={{ flexDirection:'row', gap:6 }}>
            {gradeOptions.map(g => (
              <Pressable key={g} onPress={() => setGrade(g)}
                style={[s.pill, grade===g && s.pillActive]}>
                <Text style={[Typography.label2, { color:grade===g ? '#fff' : Colors.ink3 }]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection:'row', gap:6 }}>
            {publisherOptions.map(p => (
              <Pressable key={p} onPress={() => setPub(p)}
                style={[s.pill, pub===p && s.pillActive]}>
                <Text style={[Typography.label2, { color:pub===p ? '#fff' : Colors.ink3 }]}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding:14, paddingBottom:40 }}>
        {/* 결과 수 */}
        <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:12 }]}>
          {tab==='unit' ? `${Object.keys(unitGroups).length}개 단원` : `${filtered.length}개 자료`}
        </Text>

        {/* ── 단원별 보기 ── */}
        {tab === 'unit' && Object.entries(unitGroups).map(([key, group]) => {
          const rep     = group[0];
          const upct    = unitPct(group);
          const upctSt  = pctLabel(upct);

          return (
            <View key={key} style={s.unitCard}>
              {/* 단원 헤더 */}
              <View style={s.unitHeader}>
                <View style={{ flex:1 }}>
                  <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:2 }]}>
                    {rep.unit ?? '기타'} · {rep.grade}
                  </Text>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                    {rep.publisher} · {rep.author}
                  </Text>
                </View>
                {/* 단원 전체 진도 */}
                <View style={{ alignItems:'flex-end', gap:4 }}>
                  <View style={[s.statusTag, { backgroundColor:upctSt.bg }]}>
                    <Text style={[Typography.label3, { color:upctSt.text, fontWeight:'700' }]}>
                      {upctSt.label}
                    </Text>
                  </View>
                  <Text style={[Typography.bold3, { color:Colors.brand }]}>{upct}%</Text>
                </View>
              </View>

              {/* 단원 진행바 */}
              <View style={[s.progBar, { marginBottom:12 }]}>
                <View style={[s.progFill, {
                  width:`${upct}%` as any,
                  backgroundColor: upct >= 100 ? Colors.green : Colors.brand,
                }]} />
              </View>

              {/* 트랙 4개 (단어→대화문→본문→문법 순서) */}
              {group.map(lesson => {
                const pct   = getPctSafe(lesson);
                const color = CONTENT_TYPE_COLOR[lesson.type as ContentType];
                const emoji = CONTENT_TYPE_EMOJI[lesson.type as ContentType];
                const steps = STEP_DEFS[lesson.type as ContentType];
                const totalXP = steps.reduce((a,b) => a+b.xp, 0);
                const st    = pctLabel(pct);

                return (
                  <Pressable
                    key={lesson.id}
                    style={[s.trackRow, { borderLeftColor: color }]}
                    onPress={() => router.push({
                      pathname: '/(student)/learn/[lessonId]',
                      params:   { lessonId:lesson.id, type:lesson.type, title:lesson.title },
                    })}
                  >
                    {/* 트랙 아이콘 */}
                    <View style={[s.trackIcon, { backgroundColor: color + '18' }]}>
                      <BookOpen size={18} color={color} strokeWidth={1.8}/>
                    </View>

                    {/* 트랙 정보 */}
                    <View style={{ flex:1, gap:3 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        <Text style={[Typography.bold3, { color }]}>
                          {CONTENT_TYPE_LABEL[lesson.type as ContentType]}
                        </Text>
                        <View style={[s.miniTag, { backgroundColor:st.bg }]}>
                          <Text style={[Typography.label3, { color:st.text }]}>{st.label}</Text>
                        </View>
                        {pct > 0 && pct < 100 && (
                          <View style={[s.miniTag, { backgroundColor: color+'18' }]}>
                            <Text style={[Typography.label3, { color }]}>{pct}%</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[Typography.label3, { color:Colors.ink3 }]}>
                        {lesson.type === 'word'
                          ? `단어 ${lesson.wordCount}개 · ${steps.length}단계`
                          : `${steps.length}단계 · 총 ${totalXP} XP`}
                      </Text>
                      {/* 미니 진행바 */}
                      <View style={[s.progBar, { height:3, marginTop:2 }]}>
                        <View style={[s.progFill, {
                          width:`${pct}%` as any,
                          backgroundColor: pct>=100 ? Colors.green : color,
                        }]} />
                      </View>
                    </View>

                    {/* 버튼 */}
                    <View style={[s.trackBtn, {
                      backgroundColor: pct>=100 ? Colors.bg : color,
                    }]}>
                      <Text style={[Typography.label3, {
                        fontWeight:'700',
                        color: pct>=100 ? Colors.ink3 : '#fff',
                      }]}>
                        {pct>=100 ? '복습' : pct>0 ? '계속' : '시작'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}

        {/* ── 전체 목록 보기 ── */}
        {tab === 'list' && (
          <View style={{ gap:10 }}>
            {filtered.map(lesson => {
              const pct   = getPctSafe(lesson);
              const color = CONTENT_TYPE_COLOR[lesson.type as ContentType];
              const emoji = CONTENT_TYPE_EMOJI[lesson.type as ContentType];
              const steps = STEP_DEFS[lesson.type as ContentType];
              const totalXP = steps.reduce((a,b) => a+b.xp, 0);
              const st    = pctLabel(pct);

              return (
                <Pressable
                  key={lesson.id}
                  style={[s.listCard, { borderTopColor:color, borderTopWidth:3 }]}
                  onPress={() => router.push({
                    pathname: '/(student)/learn/[lessonId]',
                    params:   { lessonId:lesson.id, type:lesson.type, title:lesson.title },
                  })}
                >
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
                      <BookOpen size={18} color={color} strokeWidth={1.8}/>
                      <View style={[s.miniTag, { backgroundColor:color+'18' }]}>
                        <Text style={[Typography.label3, { color, fontWeight:'700' }]}>
                          {CONTENT_TYPE_LABEL[lesson.type as ContentType]}
                        </Text>
                      </View>
                      <View style={[s.miniTag, { backgroundColor:st.bg }]}>
                        <Text style={[Typography.label3, { color:st.text }]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={[Typography.bold3, { color }]}>{pct}%</Text>
                  </View>
                  <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:3 }]} numberOfLines={1}>
                    {lesson.title}
                  </Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:10 }]}>
                    {lesson.publisher} · {lesson.unit ?? ''} · {steps.length}단계 · {totalXP} XP
                  </Text>
                  <View style={[s.progBar, { marginBottom:10 }]}>
                    <View style={[s.progFill, {
                      width:`${pct}%` as any,
                      backgroundColor: pct>=100 ? Colors.green : color,
                    }]} />
                  </View>
                  <View style={[s.listBtn, { backgroundColor: pct>=100 ? Colors.bg : color }]}>
                    <Text style={[Typography.bold3, { color:pct>=100 ? Colors.ink2 : '#fff' }]}>
                      {btnLabel(pct)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flex:1, backgroundColor:Colors.bg },
  header:    { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:Colors.line },
  searchRow: { flexDirection:'row', alignItems:'center', gap:9, backgroundColor:Colors.bg, borderRadius:12, paddingHorizontal:13, paddingVertical:11, marginBottom:10 },
  searchInput:{ flex:1, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink },
  tabRow:    { flexDirection:'row', gap:6, marginBottom:10 },
  tabBtn:    { flex:1, paddingVertical:8, borderRadius:10, borderWidth:1.5, borderColor:Colors.line, alignItems:'center', backgroundColor:Colors.white },
  tabActive: { borderColor:Colors.brand, backgroundColor:Colors.brandBg },
  pill:      { paddingHorizontal:12, paddingVertical:5, borderRadius:99, backgroundColor:Colors.white, borderWidth:1.5, borderColor:Colors.line },
  pillActive:{ backgroundColor:Colors.ink, borderColor:Colors.ink },
  statusTag: { paddingHorizontal:9, paddingVertical:3, borderRadius:99 },
  miniTag:   { paddingHorizontal:8, paddingVertical:2, borderRadius:99 },
  progBar:   { height:5, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  progFill:  { height:'100%', borderRadius:99 },

  // 단원 카드
  unitCard:  { backgroundColor:Colors.white, borderRadius:20, borderWidth:1, borderColor:Colors.line, padding:16, marginBottom:14, ...Shadow.card },
  unitHeader:{ flexDirection:'row', alignItems:'flex-start', marginBottom:10 },

  // 트랙 행
  trackRow:  { flexDirection:'row', alignItems:'center', gap:11, paddingVertical:11, borderTopWidth:0.5, borderTopColor:Colors.line, borderLeftWidth:3, paddingLeft:11, marginLeft:-3 },
  trackIcon: { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  trackBtn:  { paddingHorizontal:13, paddingVertical:8, borderRadius:11 },

  // 전체 목록 카드
  listCard:  { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:14, ...Shadow.card },
  listBtn:   { borderRadius:13, paddingVertical:12, alignItems:'center', ...Shadow.brand },
});
