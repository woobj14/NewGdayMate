// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLesson } from '../../../hooks/useLesson';
import { STEP_DEFS, ContentType, CONTENT_TYPE_LABEL } from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Lock, CheckCircle, ChevronRight, BookOpen } from 'lucide-react-native';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

// 타입별 색상
const TYPE_COLOR: Record<ContentType, string> = {
  word:    Colors.brand,
  grammar: Colors.green,
  dialog:  Colors.blue,
  reading: Colors.orange,
};

// 난이도 색상
const DIFF_COLOR: Record<string, { bg:string; text:string }> = {
  '쉬움':   { bg:Colors.greenBg,  text:Colors.greenDk },
  '중간':   { bg:Colors.amberBg,  text:Colors.amberDk      },
  '어려움': { bg:Colors.redBg,    text:Colors.red     },
};

// 데모 진도
const DEMO_COMPLETED: Record<string, number[]> = {
  d1:[0,1,2,3,4,5], d2:[0,1,2], d3:[], d4:[], d5:[],
};

export default function LessonDetailScreen() {
  const router = useRouter();
  const { lessonId, type, title } = useLocalSearchParams<{
    lessonId: string; type: string; title: string;
  }>();

  const { progress, getPct, isPrereqMet, lessons } = useLesson();

  // 버그 수정: Firestore에서 본문/대화문 텍스트 로드
  const [lessonText, setLessonText] = useState('');
  useEffect(() => {
    if (!lessonId) return;
    import('../../../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, getDoc }) => {
        getDoc(doc(db, 'content', lessonId)).then(snap => {
          if (snap.exists()) setLessonText(snap.data().text ?? '');
        }).catch(() => {});
      });
    });
  }, [lessonId]);

  // 현재 레슨 정보 (선수 조건 확인용)
  const currentLesson = lessons.find(l => l.id === lessonId);
  // 선수 조건 충족 여부 (word/reading 타입은 항상 true)
  const prereqMet = currentLesson ? isPrereqMet(currentLesson) : true;

  const contentType = (type as ContentType) ?? 'dialog';
  const steps = STEP_DEFS[contentType] ?? STEP_DEFS.dialog;
  const typeColor = TYPE_COLOR[contentType];

  // 완료된 단계
  const completedSteps: number[] =
    progress[lessonId]?.completedSteps ?? DEMO_COMPLETED[lessonId] ?? [];
  const pct = completedSteps.length > 0
    ? Math.round((completedSteps.length / steps.length) * 100)
    : 0;
  const totalXP = steps.reduce((a, b) => a + b.xp, 0);
  const earnedXP = steps
    .filter((_, i) => completedSteps.includes(i))
    .reduce((a, b) => a + b.xp, 0);

  const handleStep = (stepIndex: number) => {
    const step = steps[stepIndex];

    // 대화문/본문 → content-step (텍스트 읽기 + Gemini 퀴즈)
    if (contentType === 'dialog' || contentType === 'reading') {
      router.push({
        pathname: '/(student)/learn/content-step',
        params: {
          lessonId,
          stepIndex:   String(stepIndex),
          contentType,
          lessonTitle: title ?? '',
          text:        lessonText,   // Firestore content.text
        },
      });
      return;
    }

    // 단어/문법 → 기존 step (4종 퀴즈)
    router.push({
      pathname: '/(student)/learn/step',
      params: {
        lessonId,
        stepIndex: String(stepIndex),
        quizType:  step.quizType,
        stepTitle: step.title,
        xp:        String(step.xp),
        contentType,
      },
    });
  };

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize:18, color:Colors.ink }}>←</Text>
          </Pressable>
          <View style={{ flex:1 }}>
            <Text style={[Typography.label2, { color:typeColor, marginBottom:2 }]}>
              {CONTENT_TYPE_LABEL[contentType]}
            </Text>
            <Text style={[Typography.h4, { letterSpacing:-.4 }]} numberOfLines={1}>{title}</Text>
          </View>
        </View>
      </View>

      {/* KPI 4칸 */}
      <View style={s.kpiRow}>
        <View style={s.kpiCell}>
          <Text style={[Typography.statSm, { color:Colors.ink }]}>
            {steps.length}단계
          </Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>전체 단계</Text>
        </View>
        <View style={[s.kpiCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
          <Text style={[Typography.statSm, { color:Colors.brand }]}>
            {completedSteps.length}/{steps.length}
          </Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>완료</Text>
        </View>
        <View style={[s.kpiCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
          <Text style={[Typography.statSm, { color:Colors.amber }]}>
            {earnedXP}
          </Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>획득 XP</Text>
        </View>
        <View style={[s.kpiCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
          <Text style={[Typography.statSm, { color:Colors.green }]}>
            {totalXP}
          </Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>총 XP</Text>
        </View>
      </View>

      {/* 전체 진행도 */}
      <View style={s.progWrap}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
          <Text style={[Typography.label2, { color:Colors.ink3 }]}>전체 진행도</Text>
          <Text style={[Typography.bold3, { color:typeColor }]}>{pct}%</Text>
        </View>
        <View style={s.progTrack}>
          <View style={[s.progFill, { width:`${pct}%` as any, backgroundColor:typeColor }]} />
        </View>
      </View>

      {/* 단계 카드 그리드 */}
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
        {/* 선수 조건 미충족 배너 */}
        {!prereqMet && (
          <View style={{
            flexDirection:'row', alignItems:'center', gap:10,
            backgroundColor:Colors.amberBg, borderRadius:12,
            borderWidth:1, borderColor:'#FDE68A',
            padding:13, marginBottom:14,
          }}>
            <View style={{ width:32, height:32, borderRadius:10, backgroundColor:'#FDE68A', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Lock size={14} color={Colors.amberDk} strokeWidth={2}/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[Typography.bold3, { color:Colors.amberDk, marginBottom:2 }]}>
                단어 학습 먼저 완료해 주세요
              </Text>
              <Text style={[Typography.label2, { color:Colors.ink3, lineHeight:17 }]}>
                같은 단원 단어를 모두 익힌 후{'\n'}단어 Step 1(뜻)·Step 2(철자) 완료 후 대화문/문법이 열립니다.
              </Text>
            </View>
          </View>
        )}
        <Text style={[Typography.h4, { marginBottom:12 }]}>학습 단계</Text>
        <View style={s.grid}>
          {steps.map((step, i) => {
            const done   = completedSteps.includes(i);
            // 선수 조건 미충족 시 Step 0 포함 전체 잠금
            const prereqLocked = !prereqMet;
            const active = !prereqLocked && !done && (i === 0 || completedSteps.includes(i - 1));
            const locked = prereqLocked || (!done && !active);
            const dc     = DIFF_COLOR[step.difficulty];

            return (
              <Pressable
                key={i}
                style={[
                  s.stepCard,
                  done   && { borderColor:Colors.green, backgroundColor:Colors.greenBg },
                  active && { borderColor:typeColor, borderWidth:2 },
                  locked && { opacity:0.5 },
                ]}
                onPress={() => !locked && handleStep(i)}
                disabled={locked}
              >
                {/* 난이도 + 완료 배지 */}
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:10 }}>
                  <View style={[s.diffTag, { backgroundColor:done ? Colors.greenBg : dc.bg }]}>
                    <Text style={[Typography.label3, { color:done ? Colors.greenDk : dc.text }]}>
                      {done ? '완료' : step.difficulty}
                    </Text>
                  </View>
                  {active && (
                    <View style={[s.diffTag, { backgroundColor:typeColor + '22' }]}>
                      <Text style={[Typography.label3, { color:typeColor }]}>진행 중</Text>
                    </View>
                  )}
                  {locked && (
                    <Text style={{ fontSize:14, color:Colors.ink3 }}></Text>
                  )}
                </View>

                <Text style={[Typography.bold3, { color:done ? Colors.greenDk : Colors.ink, marginBottom:4, lineHeight:18 }]}>
                  {step.title}
                </Text>
                <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:10, lineHeight:16 }]}>
                  {step.desc}
                </Text>
                <Text style={[Typography.bold3, { color:done ? Colors.green : typeColor }]}>
                  +{step.xp} XP
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  header:     { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line },
  headerRow:  { flexDirection:'row', alignItems:'center', gap:12 },
  backBtn:    { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  kpiRow:     { flexDirection:'row', backgroundColor:Colors.white, borderBottomWidth:1, borderBottomColor:Colors.line },
  kpiCell:    { flex:1, paddingVertical:13, alignItems:'center' },
  progWrap:   { backgroundColor:Colors.white, paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:Colors.line },
  progTrack:  { height:6, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  progFill:   { height:'100%', borderRadius:99 },
  grid:       { flexDirection:'row', flexWrap:'wrap', gap:10 },
  stepCard:   { width:'47.5%', backgroundColor:Colors.white, borderRadius:14, borderWidth:1.5, borderColor:Colors.line, padding:13 },
  diffTag:    { paddingHorizontal:8, paddingVertical:3, borderRadius:99 },
});
