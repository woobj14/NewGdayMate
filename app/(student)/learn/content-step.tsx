// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Animated, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  generateContentQuiz,
  ContentQuiz, UnitQuiz,
  TFQuestion, MCQuestion, FillQuestion, TypingQuestion, AnyQuestion,
} from '../../../lib/generateQuiz';
import { useLesson }   from '../../../hooks/useLesson';
import { useAdaptive } from '../../../hooks/useAdaptive';
import { useStudy } from '../../../hooks/useStudy';
import { STEP_DEFS, ContentType } from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

// 데모 텍스트 (Firestore 연결 전 fallback)
const DEMO_DIALOG = `Mina: Hi, Jake! Have you ever observed the night sky?
Jake: Yes, I have. My grandfather is an astronomer.

Mina: That's amazing! What did he teach you?
Jake: He taught me how to use a telescope last summer.

Mina: I've always wanted to learn more about the stars.
Jake: You should join our astronomy club!

Mina: Really? When does it meet?
Jake: Every Friday after school. It's really fun!`;

const DEMO_READING = `For most of human history, people have observed the night sky with wonder. Long before modern telescopes were invented, ancient astronomers used patterns of stars to track time and seasons.

Yet the basic feeling of looking up and asking "what is out there?" has not changed. Today, satellites and powerful telescopes let us see galaxies that are billions of light-years away.

The universe is so vast that even the fastest spacecraft would take thousands of years to reach the nearest star. Still, humans continue to explore, driven by the same curiosity that our ancestors felt when they first looked up at the stars.`;

const STEP_XP = [100, 150, 150, 150, 200, 300];

// 화자별 색상 팔레트
const SPEAKER_COLORS = [Colors.brand, Colors.orange, Colors.green, Colors.blue, Colors.purpleDk];

export default function ContentStepScreen() {
  const router = useRouter();
  const { lessonId, stepIndex, contentType, lessonTitle, text: rawText } =
    useLocalSearchParams<{
      lessonId:    string;
      stepIndex:   string;
      contentType: string;
      lessonTitle: string;
      text:        string;
    }>();

  const { completeStep } = useLesson();
  const { weakProfile, logAnswer, flushLogs, diffLabel } = useAdaptive(lessonId);
  const { completeActivity } = useStudy();

  const type    = (contentType as 'dialog' | 'reading') ?? 'dialog';
  const stepIdx = parseInt(stepIndex ?? '0', 10);
  const xp      = STEP_XP[stepIdx] ?? 100;
  const stepDef = STEP_DEFS[type as ContentType]?.[stepIdx];
  const text    = rawText || (type === 'dialog' ? DEMO_DIALOG : DEMO_READING);

  // phase: 'text' = 전체 텍스트 읽기, 'quiz' = 단위별 퀴즈
  const [phase,      setPhase]      = useState<'text' | 'quiz'>('text');
  const [quiz,       setQuiz]       = useState<ContentQuiz | null>(null);
  const [loading,    setLoading]    = useState(false);

  // 퀴즈 진행 상태
  const [unitIdx,    setUnitIdx]    = useState(0);  // 현재 단위 인덱스
  const [qIdx,       setQIdx]       = useState(0);  // 현재 단위 내 문항 인덱스
  const [selected,   setSelected]   = useState<number>(-1);
  const [confirmed,  setConfirmed]  = useState(false);
  const [typingVal,  setTypingVal]  = useState('');
  const [typingState,setTypingState]= useState<'idle'|'ok'|'err'>('idle');
  const [score,      setScore]      = useState(0);
  const [totalQ,     setTotalQ]     = useState(0);
  const [doneQ,      setDoneQ]      = useState(0);
  const [streak,     setStreak]     = useState(0);      // 연속 정답
  const [tryCount,   setTryCount]   = useState(0);      // 타이핑 시도 횟수
  const [showHint,   setShowHint]   = useState(false);  // 타이핑 힌트 표시
  const [wordPopup,  setWordPopup]  = useState<{word:string;def:string;example:string}|null>(null); // 어휘 팝업
  const [scrolled,   setScrolled]   = useState(false);  // 지문 끝까지 읽었는지
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const popAnim   = useRef(new Animated.Value(0)).current;

  // 퀴즈 로드 (Phase 전환 시)
  const loadQuiz = useCallback(async () => {
    setLoading(true);
    const result = await generateContentQuiz(text, type, stepIdx, '중3', lessonId);
    setQuiz(result);
    const total = result.units.reduce((s, u) => s + u.questions.length, 0);
    setTotalQ(total);
    setLoading(false);
  }, [text, type, stepIdx]);

  // 현재 단위/문항
  const curUnit: UnitQuiz | undefined = quiz?.units[unitIdx];
  const curQ: AnyQuestion | undefined = curUnit?.questions[qIdx];
  const overallProg = totalQ > 0 ? Math.round((doneQ / totalQ) * 100) : 0;

  // 정답 확인 후 다음 문항
  const next = useCallback(async (isCorrect: boolean) => {
    // 적응형 학습 로그 기록
    if (curQ) {
      const kind = curQ.kind as 'mc'|'tf'|'fill'|'typing';
      const qType = kind === 'tf' ? 'tf'
        : kind === 'fill' ? 'fill_expression'
        : kind === 'typing' ? 'typing'
        : 'mc_detail';
      logAnswer(curQ.id, kind, isCorrect, 0, qType, parseInt(stepIndex??'0',10));
    }

    if (isCorrect) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      // 오답 shake 애니메이션
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:6,  duration:50, useNativeDriver:true }),
        Animated.timing(shakeAnim, { toValue:-6, duration:50, useNativeDriver:true }),
        Animated.timing(shakeAnim, { toValue:3,  duration:50, useNativeDriver:true }),
        Animated.timing(shakeAnim, { toValue:0,  duration:50, useNativeDriver:true }),
      ]).start();
      setStreak(0);
    }
    setTryCount(0); setShowHint(false);
    setDoneQ(d => d + 1);

    const nextQIdx = qIdx + 1;

    if (nextQIdx < (curUnit?.questions.length ?? 0)) {
      // 같은 단위 내 다음 문항
      setQIdx(nextQIdx);
      setSelected(-1); setConfirmed(false);
      setTypingVal(''); setTypingState('idle');
    } else {
      // 다음 단위로
      const nextUnitIdx = unitIdx + 1;
      if (nextUnitIdx < (quiz?.units.length ?? 0)) {
        setUnitIdx(nextUnitIdx);
        setQIdx(0);
        setSelected(-1); setConfirmed(false);
        setTypingVal(''); setTypingState('idle');
      } else {
        // 전체 완료
        await completeStep(lessonId, stepIdx, xp, STEP_DEFS[type as ContentType].length);
        await completeActivity('reading', xp);
        router.replace({
          pathname: '/(student)/learn/done',
          params: { stepTitle: stepDef?.title ?? '', xp: String(xp), lessonId, stepIndex, contentType },
        });
      }
    }
  }, [qIdx, unitIdx, curUnit, quiz, score, doneQ, xp]);

  // ── 로딩 ──
  if (loading) {
    return (
      <View style={[s.wrap, { alignItems: 'center', justifyContent: 'center', gap: 14 }]}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={[Typography.body3, { color: Colors.ink3, textAlign: 'center', lineHeight: 22 }]}>
          각 {type === 'dialog' ? '대화문' : '단락'}별로{'\n'}Gemini가 문제를 생성하고 있어요...
        </Text>
      </View>
    );
  }

  // ── PHASE 1: 전체 텍스트 읽기 ──
  if (phase === 'text') {
    return (
      <View style={s.wrap}>
        {/* 브랜드 헤더 */}
        <View style={s.brandHeader}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Pressable style={s.whiteBack} onPress={() => router.back()}>
              <Text style={{ fontSize:16, color:'#fff' }}>←</Text>
            </Pressable>
            <View style={{ flex:1 }}>
              <Text style={[Typography.label3, { color:'rgba(255,255,255,.65)' }]} numberOfLines={1}>
                {lessonTitle}
              </Text>
              <Text style={[Typography.bold3, { color:'#fff' }]}>{stepDef?.title}</Text>
            </View>
            <View style={s.xpTagWhite}>
              <Text style={[Typography.label2, { color:'#fff', fontWeight:'700' }]}>+{xp} XP</Text>
            </View>
          </View>
          {/* 단계 도트 */}
          <View style={s.stepDotsRow}>
            {STEP_DEFS[type as ContentType]?.map((_:any, i:number) => (
              <View key={i} style={[s.stepDot,
                i < stepIdx  ? s.stepDotDone :
                i === stepIdx ? s.stepDotActive : s.stepDotIdle
              ]} />
            ))}
          </View>
          <Text style={[Typography.label3, { color:'rgba(255,255,255,.7)', marginTop:5 }]}>
            지문을 끝까지 읽은 후 퀴즈를 시작하세요
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 110 }}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
            if (isBottom && !scrolled) setScrolled(true);
          }}
          scrollEventThrottle={200}
        >
          {/* 단계 안내 */}
          <View style={s.stepGuide}>
            <Text style={[Typography.bold3, { color: Colors.brand, marginBottom: 3 }]}>
              {stepDef?.title}
            </Text>
            <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 20 }]}>
              {stepDef?.desc}
            </Text>
          </View>

          {/* 전체 텍스트 */}
          <View style={{ padding: 16 }}>
            {type === 'dialog'
              ? renderFullDialog(text)
              : renderFullReading(text)
            }
          </View>
        </ScrollView>

        <View style={s.bottomBar}>
          <Pressable
            style={[s.startBtn, !scrolled && { backgroundColor: Colors.ink3 }]}
            onPress={async () => {
              if (!scrolled) return;
              await loadQuiz();
              setPhase('quiz');
            }}
            disabled={!scrolled}
          >
            <Text style={[Typography.bold1, { color: '#fff', letterSpacing: -.3 }]}>
              {scrolled ? '퀴즈 시작 →' : '지문을 끝까지 읽어주세요 ↓'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── PHASE 2: 단위별 퀴즈 ──
  if (!quiz || !curUnit || !curQ) return null;

  // 격려 메시지 (streak 기반)
  const encourageMsg =
    streak >= 5 ? ' 대단해요! 5연속 정답!' :
    streak >= 3 ? ' 3연속 정답! 계속 이 페이스로!' :
    doneQ > 0 && score === doneQ ? '⭐ 지금까지 완벽해요!' :
    '';

  return (
    <View style={s.wrap}>
      {/* 브랜드 헤더 + 진행바 */}
      <View style={s.brandHeader}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 }}>
          <Pressable style={s.whiteBack} onPress={() => setPhase('text')}>
            <Text style={{ fontSize:16, color:'#fff' }}>←</Text>
          </Pressable>
          <View style={s.progTrack}>
            <Animated.View style={[s.progFill, { width: `${overallProg}%` as any }]} />
          </View>
          <Text style={[Typography.bold3, { color:'#fff', minWidth:40, textAlign:'right' }]}>
            {doneQ}/{totalQ}
          {weakProfile.top3weak.length > 0 && (
            <View style={{ backgroundColor:'rgba(255,255,255,.15)', borderRadius:99, paddingHorizontal:8, paddingVertical:2 }}>
              <Text style={[Typography.label3, { color:'#fff', fontSize:9 }]}>
                {diffLabel} 모드
              </Text>
            </View>
          )}
          </Text>
        </View>
        {/* 실시간 스탯 */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.65)' }]}>정답률</Text>
            <Text style={[Typography.bold3, { color:'#fff' }]}>
              {totalQ > 0 ? Math.round((score/Math.max(doneQ,1))*100) : 0}%
            </Text>
          </View>
          {streak >= 2 && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'rgba(255,255,255,.15)', borderRadius:99, paddingHorizontal:9, paddingVertical:2 }}>
              <Text style={{ fontSize:12 }}></Text>
              <Text style={[Typography.bold3, { color:'#fff' }]}>{streak}연속</Text>
            </View>
          )}
          <Text style={[Typography.label3, { color:'rgba(255,255,255,.65)', marginLeft:'auto' as any }]}>
            +{xp} XP
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ padding: 16 }}>
          {/* 격려 메시지 */}
          {!!encourageMsg && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, backgroundColor:Colors.greenBg, borderRadius:12, borderWidth:1, borderColor:'#86efac', padding:11, marginBottom:12 }}>
              <Text style={[Typography.bold3, { color:Colors.greenDk }]}>{encourageMsg}</Text>
            </View>
          )}

          {/* 단위 헤더 — 대화문 전체를 지문으로 활용 */}
          <View style={s.unitHeader}>
            <View style={s.unitBadge}>
              <Text style={[Typography.bold3, { color: Colors.brand }]}>
                {curUnit.unitLabel}
              </Text>
            </View>
            {quiz.units.length > 1 && (
              <Text style={[Typography.label2, { color: Colors.ink3 }]}>
                {unitIdx + 1} / {quiz.units.length}
              </Text>
            )}
            <View style={[s.unitQBadge, { marginLeft: 'auto' as any }]}>
              <Text style={[Typography.label3, { color: Colors.ink3 }]}>
                문항 {qIdx + 1} / {curUnit.questions.length}
              </Text>
            </View>
          </View>
          {/* 지문 안내 배너 — 전체 지문 기반임을 명확히 표시 */}
          {type === 'dialog' && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:7,
              backgroundColor: Colors.brandBg, borderRadius:10,
              borderWidth:1, borderColor:'#DDD9FF',
              paddingHorizontal:12, paddingVertical:7, marginBottom:12 }}>
              <Text style={[Typography.label3, { color: Colors.brand }]}>
                 아래 지문 전체를 읽고 문항을 풀어보세요
              </Text>
            </View>
          )}

          {/* 해당 단위 텍스트 */}
          <View style={s.unitTextCard}>
            {type === 'dialog'
              ? renderDialogUnit(curUnit.unitText)
              : <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 24 }]}>
                  {curUnit.unitText}
                </Text>
            }
          </View>

          {/* 문항 렌더링 */}
          {renderQuestion(
            curQ, selected, setSelected, confirmed,
            typingVal, setTypingVal, typingState, setTypingState,
            tryCount, showHint, setShowHint,
          )}

          {/* 4단 해설 — "이런것도 알려줘!?" */}
          {confirmed && 'explain' in curQ && (
            <View style={s.explainWrap}>
              {/* ① 정답 근거 */}
              <View style={s.explainSection}>
                <View style={s.explainLabel}>
                  <Text style={s.explainIcon}></Text>
                  <Text style={[Typography.label2, { color:Colors.brand, fontWeight:'700' }]}>정답 근거</Text>
                </View>
                <Text style={[Typography.body3, { color:Colors.ink, lineHeight:22 }]}>
                  {curQ.explain}
                </Text>
              </View>

              {/* ② 오답 이유 (MC/fill만) */}
              {(curQ.kind === 'mc' || curQ.kind === 'fill') && selected !== (curQ as any).correct && (
                <View style={[s.explainSection, { borderTopWidth:0.5, borderTopColor:Colors.line }]}>
                  <View style={s.explainLabel}>
                    <Text style={s.explainIcon}>X</Text>
                    <Text style={[Typography.label2, { color:Colors.red, fontWeight:'700' }]}>선택한 답이 틀린 이유</Text>
                  </View>
                  <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:22 }]}>
                    {`"${(curQ as any).choices?.[selected] ?? ''}"은(는) `}
                    {curQ.kind === 'mc'
                      ? '이 문맥에서 적절하지 않아요. 지문에서 근거를 다시 찾아보세요.'
                      : '문법적으로 맞지 않아요. 정답을 지문에서 확인해보세요.'}
                  </Text>
                </View>
              )}

              {/* ③ 핵심 문법/표현 정리 */}
              <View style={[s.explainSection, { borderTopWidth:0.5, borderTopColor:Colors.line, backgroundColor:Colors.brandBg }]}>
                <View style={s.explainLabel}>
                  <Text style={s.explainIcon}></Text>
                  <Text style={[Typography.label2, { color:Colors.brand, fontWeight:'700' }]}>핵심 포인트</Text>
                </View>
                <Text style={[Typography.body3, { color:Colors.ink, lineHeight:22 }]}>
                  {curQ.kind === 'tf'
                    ? '지문에서 직접 확인할 수 있는 내용인지 체크하는 것이 T/F 문제의 핵심이에요.'
                    : curQ.kind === 'fill'
                    ? '빈칸 앞뒤 문맥을 파악하고 문법적으로도 알맞은 형태를 골라야 해요.'
                    : curQ.kind === 'typing'
                    ? '영어 단어/표현의 정확한 철자와 형태를 외워두는 것이 중요해요.'
                    : '선택지를 하나씩 지문에 대입해서 논리적으로 맞는 것을 찾는 습관을 들여요.'}
                </Text>
              </View>

              {/* ④ 관련 예문 */}
              {curQ.kind === 'mc' && (
                <View style={[s.explainSection, { borderTopWidth:0.5, borderTopColor:Colors.line }]}>
                  <View style={s.explainLabel}>
                    <Text style={s.explainIcon}>️</Text>
                    <Text style={[Typography.label2, { color:Colors.greenDk, fontWeight:'700' }]}>이것도 알아두세요!</Text>
                  </View>
                  <View style={s.tipBox}>
                    <Text style={[Typography.body3, { color:Colors.ink, lineHeight:22, fontStyle:'italic' }]}>
                      {` 비슷한 유형의 문제에서는 먼저 지문 전체를 파악한 후, 선택지를 소거법으로 좁혀가는 방법이 효과적이에요.`}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={s.bottomBar}>
        <Pressable style={s.skipBtn} onPress={() => next(false)}>
          <Text style={[Typography.bold2, { color: Colors.ink3 }]}>건너뛰기</Text>
        </Pressable>

        {(curQ.kind === 'tf' || curQ.kind === 'mc' || curQ.kind === 'fill') && (
          confirmed ? (
            <Pressable
              style={[s.confirmBtn, {
                backgroundColor: selected === (curQ as MCQuestion | FillQuestion).correct ||
                  (curQ.kind === 'tf' && selected === ((curQ as TFQuestion).correct ? 0 : 1))
                  ? Colors.green : Colors.red
              }]}
              onPress={() => {
                const q = curQ as MCQuestion | FillQuestion | TFQuestion;
                const isOk = curQ.kind === 'tf'
                  ? selected === ((curQ as TFQuestion).correct ? 0 : 1)
                  : selected === (q as MCQuestion | FillQuestion).correct;
                next(isOk);
              }}
            >
              <Text style={[Typography.bold2, { color: '#fff' }]}>
                {(curQ.kind === 'tf'
                  ? selected === ((curQ as TFQuestion).correct ? 0 : 1)
                  : selected === (curQ as MCQuestion | FillQuestion).correct)
                  ? '정답! 다음 →' : '오답 · 다음 →'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.confirmBtn, selected < 0 && { opacity: 0.4 }]}
              onPress={() => { if (selected >= 0) setConfirmed(true); }}
              disabled={selected < 0}
            >
              <Text style={[Typography.bold2, { color: '#fff' }]}>확인</Text>
            </Pressable>
          )
        )}

        {curQ.kind === 'typing' && (
          typingState === 'ok' ? (
            <Pressable style={[s.confirmBtn, { backgroundColor:Colors.green }]} onPress={() => next(true)}>
              <Text style={[Typography.bold2, { color:'#fff' }]}>정답! 다음 →</Text>
            </Pressable>
          ) : tryCount >= 2 && typingState === 'err' ? (
            <Pressable style={[s.confirmBtn, { backgroundColor:Colors.red }]} onPress={() => next(false)}>
              <Text style={[Typography.bold2, { color:'#fff' }]}>확인했어요 · 다음 →</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[s.confirmBtn, !typingVal.trim() && { opacity:0.4 }]}
              disabled={!typingVal.trim()}
              onPress={() => {
                const q = curQ as TypingQuestion;
                const val = typingVal.trim().toLowerCase();
                // 대소문자 · 마침표 · 띄어쓰기 너그럽게 처리
                const normalize = (s: string) => s.toLowerCase().replace(/[.,!?]/g,'').trim();
                if (normalize(val) === normalize(q.answer)) {
                  setTypingState('ok');
                } else {
                  setTryCount(t => t + 1);
                  setTypingState('err');
                  setTypingVal('');
                }
              }}
            >
              <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
            </Pressable>
          )
        )}
      </View>
      {/* 어휘 팝업 모달 */}
      <Modal
        visible={!!wordPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setWordPopup(null)}
      >
        <Pressable style={{ flex:1, backgroundColor:'rgba(0,0,0,.45)', justifyContent:'flex-end' }} onPress={() => setWordPopup(null)}>
          <Pressable style={{ backgroundColor:Colors.white, borderTopLeftRadius:22, borderTopRightRadius:22, padding:24, paddingBottom:40 }}>
            {wordPopup && (<>
              <Text style={[Typography.h3, { marginBottom:4 }]}>{wordPopup.word}</Text>
              <Text style={[Typography.body3, { color:Colors.ink3, marginBottom:12 }]}>{wordPopup.def}</Text>
              {wordPopup.example && (
                <View style={{ backgroundColor:Colors.brandBg, borderRadius:12, padding:12, borderWidth:1, borderColor:'#DDD9FF' }}>
                  <Text style={[Typography.label3, { color:Colors.brand, marginBottom:4 }]}>예문</Text>
                  <Text style={[Typography.body3, { color:Colors.ink, fontStyle:'italic' }]}>{wordPopup.example}</Text>
                </View>
              )}
            </>)}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── 문항 렌더러 ─────────────────────────────────────────

function renderQuestion(
  q:            AnyQuestion,
  selected:     number,
  setSelected:  (i: number) => void,
  confirmed:    boolean,
  typingVal:    string,
  setTypingVal: (v: string) => void,
  typingState:  'idle'|'ok'|'err',
  setTypingState: (v: 'idle'|'ok'|'err') => void,
  tryCount:     number,
  showHint:     boolean,
  setShowHint:  (v: boolean) => void,
) {
  if (q.kind === 'tf') {
    const tq = q as TFQuestion;
    const correctIdx = tq.correct ? 0 : 1;  // True=0, False=1
    return (
      <View style={{ marginTop: 4 }}>
        <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 10 }]}>
          다음 문장이 맞으면 True, 틀리면 False를 선택하세요.
        </Text>
        <View style={s.tfStatement}>
          <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 22 }]}>
            {tq.statement}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          {['True', 'False'].map((label, i) => {
            let bg: string = Colors.white, border: string = Colors.line, textColor: string = Colors.ink2;
            if (confirmed) {
              if (i === correctIdx) { bg = Colors.greenBg; border = '#86efac'; textColor = Colors.greenDk; }
              else if (i === selected) { bg = Colors.redBg; border = '#fca5a5'; textColor = Colors.red; }
            } else if (i === selected) {
              bg = Colors.brandBg; border = Colors.brand; textColor = Colors.brand;
            }
            return (
              <Pressable key={i}
                onPress={() => { if (!confirmed) setSelected(i); }}
                style={[s.tfBtn, { flex: 1, backgroundColor: bg, borderColor: border }]}
              >
                <Text style={[Typography.bold2, { color: textColor, fontSize: 16 }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (q.kind === 'mc') {
    const mq = q as MCQuestion;
    return (
      <View style={{ marginTop: 4 }}>
        <View style={s.questionBox}>
          <Text style={[Typography.bold2, { color: Colors.ink, lineHeight: 24 }]}>
            {mq.question}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          {mq.choices.map((c, i) => {
            let bg: string = Colors.white, border: string = Colors.line, numBg: string = Colors.bg, numColor: string = Colors.ink3;
            if (confirmed) {
              if (i === mq.correct)       { bg = Colors.greenBg; border = '#86efac'; numBg = Colors.green; numColor = '#fff'; }
              else if (i === selected)    { bg = Colors.redBg;   border = '#fca5a5'; numBg = Colors.red;   numColor = '#fff'; }
            } else if (i === selected) {
              bg = Colors.brandBg; border = Colors.brand; numBg = Colors.brand; numColor = '#fff';
            }
            return (
              <Pressable key={i}
                onPress={() => { if (!confirmed) setSelected(i); }}
                style={[s.choice, { backgroundColor: bg, borderColor: border }]}
              >
                <View style={[s.cnum, { backgroundColor: numBg }]}>
                  <Text style={[Typography.label2, { color: numColor }]}>{i + 1}</Text>
                </View>
                <Text style={[Typography.body3, { flex: 1, color: Colors.ink }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (q.kind === 'fill') {
    const fq = q as FillQuestion;
    const parts = fq.sentence.split('___');
    return (
      <View style={{ marginTop: 4 }}>
        <View style={s.questionBox}>
          <Text style={[Typography.bold2, { color: Colors.ink, lineHeight: 28 }]}>
            {parts.map((part, i) => (
              <Text key={i}>
                {part}
                {i < parts.length - 1 && (
                  <Text style={{ color: Colors.brand, textDecorationLine: 'underline' }}>
                    {'  ___  '}
                  </Text>
                )}
              </Text>
            ))}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          {fq.choices.map((c, i) => {
            let bg: string = Colors.white, border: string = Colors.line, numBg: string = Colors.bg, numColor: string = Colors.ink3;
            if (confirmed) {
              if (i === fq.correct)    { bg = Colors.greenBg; border = '#86efac'; numBg = Colors.green; numColor = '#fff'; }
              else if (i === selected) { bg = Colors.redBg;   border = '#fca5a5'; numBg = Colors.red;   numColor = '#fff'; }
            } else if (i === selected) {
              bg = Colors.brandBg; border = Colors.brand; numBg = Colors.brand; numColor = '#fff';
            }
            return (
              <Pressable key={i}
                onPress={() => { if (!confirmed) setSelected(i); }}
                style={[s.choice, { backgroundColor: bg, borderColor: border }]}
              >
                <View style={[s.cnum, { backgroundColor: numBg }]}>
                  <Text style={[Typography.label2, { color: numColor }]}>{i + 1}</Text>
                </View>
                <Text style={[Typography.body3, { flex: 1, color: Colors.ink }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (q.kind === 'typing') {
    const tq = q as TypingQuestion;
    const hint1st = tq.answer.slice(0, Math.ceil(tq.answer.length / 2)).replace(/./g, (c,i) => i===0?c:'_');
    return (
      <View style={{ marginTop: 4 }}>
        {/* 힌트 카드 */}
        <View style={s.questionBox}>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:4 }]}>다음을 영어로 쓰세요</Text>
          <Text style={[Typography.bold2, { color: Colors.ink, lineHeight: 24 }]}>{tq.hint}</Text>
        </View>

        {/* 2회 시도 기회 표시 */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:8 }}>
          <View style={{ flexDirection:'row', gap:4 }}>
            {[1,2].map(n => (
              <View key={n} style={{
                width:7, height:7, borderRadius:4,
                backgroundColor: tryCount >= n ? Colors.red : Colors.green,
              }} />
            ))}
          </View>
          <Text style={[Typography.label3, { color:Colors.ink3 }]}>
            {tryCount === 0 ? '기회 2번' : tryCount === 1 ? '마지막 기회!' : ''}
          </Text>
          {!showHint && tryCount > 0 && (
            <Pressable
              onPress={() => setShowHint(true)}
              style={{ marginLeft:'auto' as any, paddingHorizontal:10, paddingVertical:4, borderRadius:8, borderWidth:1, borderColor:Colors.amber, backgroundColor:Colors.amberBg }}
            >
              <Text style={[Typography.label3, { color:Colors.amber, fontWeight:'700' }]}>힌트 보기 </Text>
            </Pressable>
          )}
        </View>

        {/* 힌트 표시 */}
        {showHint && (
          <View style={{ backgroundColor:Colors.amberBg, borderRadius:10, padding:10, marginBottom:8, borderWidth:1, borderColor:'#FDE68A' }}>
            <Text style={[Typography.label2, { color:Colors.amberDk }]}> 힌트: {hint1st}...</Text>
            <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>총 {tq.answer.length}글자예요</Text>
          </View>
        )}

        <TextInput
          style={[s.typeInput,
            typingState === 'ok'  && { borderColor: Colors.green, backgroundColor: Colors.greenBg },
            typingState === 'err' && { borderColor: Colors.red,   backgroundColor: Colors.redBg   },
          ]}
          value={typingVal}
          onChangeText={v => { setTypingVal(v); setTypingState('idle'); }}
          placeholder="영어로 입력하세요"
          placeholderTextColor={Colors.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        {typingState !== 'idle' && (
          <View style={{ marginTop:10 }}>
            {typingState === 'ok' ? (
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, backgroundColor:Colors.greenBg, borderRadius:10, padding:10 }}>
                <Text style={{ fontSize:20 }}></Text>
                <Text style={[Typography.bold2, { color:Colors.greenDk }]}>정답이에요!</Text>
              </View>
            ) : tryCount >= 2 ? (
              <View style={{ backgroundColor:Colors.redBg, borderRadius:10, padding:12 }}>
                <Text style={[Typography.bold3, { color:Colors.red, marginBottom:4 }]}>X 정답을 확인하세요</Text>
                <Text style={[Typography.bold2, { color:Colors.ink }]}>→ {tq.answer}</Text>
                <Text style={[Typography.body3, { color:Colors.ink3, marginTop:4, lineHeight:20 }]}>
                  {tq.explain}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, backgroundColor:Colors.amberBg, borderRadius:10, padding:10 }}>
                <Text style={{ fontSize:16 }}></Text>
                <Text style={[Typography.bold3, { color:Colors.amberDk }]}>
                  한 번 더! ({2 - tryCount}번 남았어요)
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  return null;
}

// ── 대화문 렌더러 ─────────────────────────────────────────

function renderFullDialog(text: string) {
  const groups = text.split(/\n\s*\n/).map(g => g.trim()).filter(Boolean);
  return (
    <View style={{ gap: 14 }}>
      {groups.map((group, gi) => (
        <View key={gi} style={s.dialogGroupCard}>
          <View style={s.dialogGroupLabel}>
            <Text style={[Typography.label3, { color: Colors.brand, fontWeight: '700' }]}>
              대화문 {gi + 1}
            </Text>
          </View>
          {renderDialogLines(group)}
        </View>
      ))}
    </View>
  );
}

function renderFullReading(text: string) {
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  return (
    <View style={{ gap: 14 }}>
      {paras.map((para, i) => (
        <View key={i} style={s.dialogGroupCard}>
          <View style={s.dialogGroupLabel}>
            <Text style={[Typography.label3, { color: Colors.brand, fontWeight: '700' }]}>
              단락 {i + 1}
            </Text>
          </View>
          <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 26 }]}>{para}</Text>
        </View>
      ))}
    </View>
  );
}

function renderDialogUnit(unitText: string) {
  return renderDialogLines(unitText);
}

function renderDialogLines(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const speakerMap: Record<string, string> = {};
  let colorIdx = 0;

  return (
    <View style={{ gap: 10 }}>
      {lines.map((line, i) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx < 0) {
          return (
            <Text key={i} style={[Typography.body3, { color: Colors.ink, lineHeight: 22 }]}>
              {line}
            </Text>
          );
        }
        const speaker  = line.slice(0, colonIdx).trim();
        const dialogue = line.slice(colonIdx + 1).trim();

        if (!speakerMap[speaker]) {
          speakerMap[speaker] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length];
          colorIdx++;
        }
        const color   = speakerMap[speaker];
        const isLeft  = Object.keys(speakerMap).indexOf(speaker) % 2 === 0;

        return (
          <View key={i} style={[dlg.row, !isLeft && { flexDirection: 'row-reverse' }]}>
            <View style={[dlg.ava, { backgroundColor: color + '22', borderColor: color + '55' }]}>
              <Text style={[Typography.bold3, { color, fontSize: 11 }]}>{speaker[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.label3, { color, marginBottom: 3,
                textAlign: isLeft ? 'left' : 'right' }]}>
                {speaker}
              </Text>
              <View style={[dlg.bub, {
                backgroundColor: isLeft ? Colors.white : color + '15',
                borderColor:     isLeft ? Colors.line  : color + '44',
                borderBottomLeftRadius:  isLeft ? 3  : 12,
                borderBottomRightRadius: isLeft ? 12 : 3,
                alignSelf: isLeft ? 'flex-start' : 'flex-end',
              }]}>
                <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 21 }]}>
                  {dialogue}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── 스타일 ─────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap:          { flex: 1, backgroundColor: Colors.bg },
  topBar:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn:       { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  xpTag:         { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 99, backgroundColor: Colors.brandBg },
  progTrack:     { flex: 1, height: 5, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  progFill:      { height: '100%', backgroundColor: Colors.brand, borderRadius: 99 },
  stepGuide:     { backgroundColor: Colors.brandBg, marginHorizontal: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: '#DDD9FF', padding: 13 },
  unitHeader:    { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  unitBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, backgroundColor: Colors.brandBg },
  unitQBadge:    { marginLeft: 'auto' as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: Colors.bg },
  unitTextCard:  { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 14, marginBottom: 14 },
  dialogGroupCard:{ backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 14 },
  dialogGroupLabel:{ marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tfStatement:   { backgroundColor: Colors.bg, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: Colors.line },
  tfBtn:         { borderRadius: 14, borderWidth: 2, alignItems: 'center', paddingVertical: 16 },
  questionBox:   { backgroundColor: Colors.brandBg, borderRadius: 13, borderWidth: 1, borderColor: '#DDD9FF', padding: 13, marginBottom: 12 },
  choice:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 13 },
  cnum:          { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeInput:     { borderWidth: 2, borderColor: Colors.line, borderRadius: 12, padding: 14, fontFamily: 'Pretendard-Regular', fontSize: 15, color: Colors.ink, backgroundColor: Colors.bg, marginTop: 4 },
  explainBox:    { backgroundColor: Colors.bg, borderRadius: 12, borderWidth: 1, borderColor: Colors.line, padding: 13, marginTop: 12 },
  bottomBar:     { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 32, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.line, position: 'absolute', bottom: 0, left: 0, right: 0 },
  startBtn:      { flex: 1, padding: 16, borderRadius: 14, backgroundColor: Colors.brand, alignItems: 'center' },
  skipBtn:       { flex: 1, padding: 14, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center' },
  confirmBtn:    { flex: 2, padding: 14, borderRadius: 13, backgroundColor: Colors.brand, alignItems: 'center', ...Shadow.brand },

  // 브랜드 헤더
  brandHeader:   { backgroundColor: Colors.brand, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14 },
  whiteBack:     { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,.3)', alignItems: 'center', justifyContent: 'center' },
  xpTagWhite:    { backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  stepDotsRow:   { flexDirection: 'row', gap: 5, marginTop: 8 },
  stepDot:       { height: 4, borderRadius: 2 },
  stepDotIdle:   { width: 18, backgroundColor: 'rgba(255,255,255,.25)' },
  stepDotActive: { width: 26, backgroundColor: '#fff' },
  stepDotDone:   { width: 18, backgroundColor: 'rgba(255,255,255,.6)' },

  // 4단 해설
  explainWrap:   { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, marginTop: 14, overflow: 'hidden' },
  explainSection:{ padding: 14 },
  explainLabel:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  explainIcon:   { fontSize: 16 },
  tipBox:        { backgroundColor: Colors.greenBg, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#86efac' },
});

const dlg = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  ava:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 18 },
  bub:  { maxWidth: '88%', borderRadius: 14, borderWidth: 1, padding: 10 },
});
