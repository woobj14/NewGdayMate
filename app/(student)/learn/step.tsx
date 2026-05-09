// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, Pressable, TextInput,
  ScrollView, StyleSheet, ActivityIndicator,
  Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLesson } from '../../../hooks/useLesson';
import { doc, getDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!);
import { db } from '../../../lib/firebase';
import { useStudy } from '../../../hooks/useStudy';
import { useWordbook } from '../../../hooks/useWordbook';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

/* ── 문법 퀴즈 타입 ── */
interface GrammarQ {
  kind:     'tf' | 'mc' | 'fill';
  id:       number;
  question?: string;
  sentence?: string;   // fill 빈칸 문장
  choices:  string[];
  correct:  number;
  explain:  string;
}

/* ── 퀴즈 데이터 타입 ── */
interface WordQ {
  word:     string;
  phonetic: string;
  pos:      string;
  ko:       string;
  def:      string;
  choices:  string[];   // 4지선다 오답 포함 4개
}

// 4지선다 보기 생성 — 정답 + 같은 배열에서 랜덤 오답 3개
function buildChoices(words: WordQ[], correctIdx: number): string[] {
  const correct = words[correctIdx].ko;
  const pool = words
    .filter((_, i) => i !== correctIdx)
    .map(w => w.ko)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const all = [...pool, correct].sort(() => Math.random() - 0.5);
  return all;
}

// Firestore ParsedWord → WordQ 변환
function toWordQ(w: any): Omit<WordQ, 'choices'> {
  return {
    word:     w.word     ?? '',
    phonetic: w.phonetic ?? '',
    pos:      w.pos      ?? '',
    ko:       w.ko       ?? '',
    def:      w.def      ?? '',
  };
}

// 데모 단어 (Firestore 로드 전 fallback)
const DEMO_WORDS_RAW = [
  { word:'observe',    phonetic:'/əbˈzɜːrv/',    pos:'v.',   ko:'관찰하다',   def:'to look at something carefully'       },
  { word:'ancient',    phonetic:'/ˈeɪnʃənt/',    pos:'adj.', ko:'고대의',     def:'from a very early period in history'  },
  { word:'telescope',  phonetic:'/ˈtelɪskəʊp/', pos:'n.',   ko:'망원경',     def:'instrument to see distant objects'     },
  { word:'astronomer', phonetic:'/əˈstrɒnəmər/',pos:'n.',   ko:'천문학자',   def:'scientist who studies stars'           },
  { word:'wonder',     phonetic:'/ˈwʌndər/',     pos:'n.',   ko:'경이로움',   def:'a feeling of amazement and admiration' },
];

type QuizType = 'meaning' | 'spelling' | 'matching' | 'typing' | 'grammar_mc' | 'content_mc';

export default function StepScreen() {
  const router  = useRouter();
  const { lessonId, stepIndex, quizType, stepTitle, xp, contentType } = useLocalSearchParams<{
    lessonId:string; stepIndex:string; quizType:string;
    stepTitle:string; xp:string; contentType:string;
  }>();

  const { completeStep } = useLesson();
  const { completeActivity } = useStudy();
  const { addWord } = useWordbook();

  const type = (quizType as QuizType) ?? 'meaning';
  const totalSteps = contentType === 'word' || contentType === 'grammar' ? 4 : 6;

  /* ── 완료 ── */
  const finishStep = useCallback(async () => {
    const xpNum = parseInt(xp ?? '100', 10);
    await completeStep(lessonId, parseInt(stepIndex ?? '0', 10), xpNum, totalSteps);
    await completeActivity('word_quiz', xpNum);
    router.replace({
      pathname: '/(student)/learn/done',
      params: { stepTitle: stepTitle ?? '', xp, lessonId, stepIndex, contentType },
    });
  }, [completeActivity, completeStep, contentType, lessonId, router, stepIndex, stepTitle, totalSteps, xp]);

  // ── Firestore 단어 로드 ──────────────────────────────────────
  const [words,      setWords]      = useState<WordQ[]>([]);
  const [matchPairs, setMatchPairs] = useState<{ word:string; def:string; ko:string }[]>([]);
  const [wordsLoading, setWordsLoading] = useState(true);
  const [toast, setToast] = useState('');   // 단어 저장 토스트

  useEffect(() => {
    if (contentType !== 'word' && contentType !== 'grammar') {
      setWordsLoading(false); return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'content', lessonId));
        const raw: any[] = snap.exists() ? (snap.data().words ?? []) : [];
        if (raw.length >= 4) {
          // Firestore 단어로 퀴즈 구성
          const wqs: WordQ[] = raw.map((w, i) => ({
            ...toWordQ(w),
            choices: buildChoices(raw.map(toWordQ) as WordQ[], i),
          }));
          setWords(wqs);
          setMatchPairs(raw.slice(0, 6).map(w => ({ word: w.word, def: w.def, ko: w.ko ?? '' })));
        } else {
          // fallback — 데모 단어
          const wqs: WordQ[] = DEMO_WORDS_RAW.map((w, i) => ({
            ...w,
            choices: buildChoices(DEMO_WORDS_RAW as WordQ[], i),
          }));
          setWords(wqs);
          setMatchPairs(DEMO_WORDS_RAW.slice(0, 4).map(w => ({ word: w.word, def: w.def, ko: w.ko })));
        }
      } catch {
        // 오프라인/오류 — 데모 데이터
        const wqs: WordQ[] = DEMO_WORDS_RAW.map((w, i) => ({
          ...w,
          choices: buildChoices(DEMO_WORDS_RAW as WordQ[], i),
        }));
        setWords(wqs);
        setMatchPairs(DEMO_WORDS_RAW.slice(0, 4).map(w => ({ word: w.word, def: w.def, ko: w.ko })));
      } finally {
        setWordsLoading(false);
      }
    })();
  }, [lessonId, contentType]);

  // ── 문법 퀴즈 데이터 ────────────────────────────────────────
  const [grammarPoints, setGrammarPoints] = useState<string[]>([]);
  const [grammarText,   setGrammarText]   = useState('');
  const [grammarQs,     setGrammarQs]     = useState<GrammarQ[]>([]);
  const [grammarLoading,setGrammarLoading]= useState(false);
  const [gIdx,          setGIdx]          = useState(0);
  const [gSel,          setGSel]          = useState(-1);
  const [gConfirmed,    setGConfirmed]    = useState(false);

  // 문법 Firestore 로드
  useEffect(() => {
    if (contentType !== 'grammar') return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'content', lessonId));
        if (snap.exists()) {
          setGrammarPoints(snap.data().grammarPoints ?? []);
          setGrammarText(snap.data().text ?? '');
        }
      } catch { /* 오프라인 — 빈 상태로 시작 */ }
    })();
  }, [lessonId, contentType]);

  // Step 3/4: Gemini 문법 문제 생성
  useEffect(() => {
    if (contentType !== 'grammar') return;
    const stepIdx = parseInt(stepIndex ?? '0', 10);
    if (stepIdx < 2) return;  // Step 1~2는 정적 화면
    if (grammarPoints.length === 0 && !grammarText) return;

    (async () => {
      setGrammarLoading(true);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } } as any,
      });

      // Step별 문항 수 + 유형
      const isStep3 = stepIdx === 2;  // 변형 연습 (fill)
      const isStep4 = stepIdx === 3;  // 실전 퀴즈 (mc)
      const fillCount = 8;   // Step 3: 빈칸 완성 8문항
      const mcCount   = 15;  // Step 4: 4지선다 15문항

      const prompt = `
당신은 한국 중고등학교 영어 내신 문법 전문 출제 교사입니다.
아래 문법 포인트를 기반으로 퀴즈를 만드세요.

[문법 포인트]: ${grammarPoints.join(' / ')}
${grammarText ? `[참고 원문 예문]: ${grammarText.slice(0, 600)}` : ''}

${isStep3 ? `
[요청]: 빈칸 완성(fill) ${fillCount}개

출제 기준:
- 문법 포인트별로 고르게 출제 (포인트 수에 맞게 배분)
- 각 문장은 단순 암기가 아니라 문맥 이해가 필요한 수준
- 오답 보기는 학생들이 흔히 틀리는 형태로 구성
- 난이도: 쉬움 2개 / 중간 4개 / 어려움 2개
- 해설은 문법 규칙과 함께 왜 오답이 틀렸는지 설명

예시 형식:
{ "kind": "fill", "id": 1, "sentence": "She ___ in Seoul for 10 years.", "choices": ["live","lives","has lived","lived"], "correct": 2, "explain": "현재완료 계속: have/has + p.p. / lived(단순과거)는 현재까지 이어지는 의미 없음" }
` : `
[요청]: 4지선다 어법(mc) ${mcCount}개

출제 유형 혼합 (반드시 다양하게):
1. 어법상 옳은 것 고르기 (4개 중 1개 정답)
2. 어법상 틀린 것 고르기 (4개 중 1개 오답)
3. 빈칸에 알맞은 어법 형태 고르기
4. 두 빈칸 (A)(B)에 알맞은 것 고르기
5. 밑줄 친 부분 중 어법이 틀린 것 고르기

출제 기준:
- 문법 포인트별로 고르게 배분
- 내신 기출 유형 그대로 반영
- 오답은 학생들이 많이 틀리는 패턴
- 해설은 왜 정답인지 + 오답은 왜 틀린지 명확히
- 난이도: 쉬움 4개 / 중간 7개 / 어려움 4개

예시 형식:
{ "kind": "mc", "id": 1, "question": "어법상 옳은 것은?", "choices": ["I have went there.","I have gone there.","I has gone there.","I had go there."], "correct": 1, "explain": "현재완료: have/has + 과거분사(gone). ① went(단순과거) ③ has→have ④ had go→had gone" }
`}

JSON 배열만 응답 (다른 텍스트 없이):
[
  { "kind": "fill"|"mc", "id": 1, "sentence"(fill만): "...", "question"(mc만): "...", "choices": [...4개...], "correct": 0, "explain": "..." }
]
`;

      try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim()
          .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'');
        setGrammarQs(JSON.parse(raw) as GrammarQ[]);
      } catch {
        // fallback 데모
        setGrammarQs(isStep3 ? [
          // Step 3: 빈칸 완성 8문항
          { kind:'fill', id:1, sentence:'She ___ in Seoul for 10 years.', choices:['live','lives','has lived','lived'], correct:2, explain:'현재완료 계속 용법: have/has + p.p. / lived는 단순 과거(현재 의미 없음)' },
          { kind:'fill', id:2, sentence:'The letter ___ by Tom yesterday.', choices:['write','writes','is written','was written'], correct:3, explain:'수동태 과거: was/were + p.p. / yesterday가 과거 시점' },
          { kind:'fill', id:3, sentence:'It is important that she ___ on time.', choices:['arrives','arrive','arrived','arriving'], correct:1, explain:'It is important that + (should) + 동사원형. should 생략 가능' },
          { kind:'fill', id:4, sentence:'___ by the noise, he woke up.', choices:['Disturb','Disturbing','Disturbed','Having disturb'], correct:2, explain:'수동 분사구문: 주어(he)가 방해를 받는 수동 관계 → 과거분사' },
          { kind:'fill', id:5, sentence:'The book ___ on the table belongs to me.', choices:['lay','lies','lying','lain'], correct:2, explain:'현재분사(lying)가 book을 수식. lay는 타동사라 자동사 의미 불가' },
          { kind:'fill', id:6, sentence:'I ___ my homework before dinner yesterday.', choices:['finish','finished','had finished','have finished'], correct:2, explain:'대과거(had+p.p.): dinner(과거) 이전에 완료된 사건' },
          { kind:'fill', id:7, sentence:'The window ___ by the boy last night.', choices:['break','broke','was broken','has broken'], correct:2, explain:'수동태 과거: was/were + p.p. / last night = 과거 시점' },
          { kind:'fill', id:8, sentence:'She made me ___ the dishes.', choices:['wash','washed','washing','to wash'], correct:0, explain:'사역동사 make + 목적어 + 동사원형. to 없이 원형 사용' },
        ] : [
          // Step 4: 실전 퀴즈 15문항
          { kind:'mc', id:1, question:'어법상 옳은 것은?', choices:['I have went there.','I have gone there.','I has gone there.','I had go there.'], correct:1, explain:'현재완료: have/has + 과거분사(gone). ①went(단순과거) ③has→have ④had go→had gone' },
          { kind:'mc', id:2, question:'빈칸에 알맞은 것은? "The window ___ by Tom."', choices:['broke','broken','was broken','has broke'], correct:2, explain:'수동태: was/were + p.p. ①능동 ②불완전 수동 ④has broke→has been broken' },
          { kind:'mc', id:3, question:'어법상 틀린 것은?', choices:['She has studied hard.','It was built in 1990.','They are known to us.','He have finished it.'], correct:3, explain:'He는 3인칭 단수 → has finished. have는 I/we/you/they와 사용' },
          { kind:'mc', id:4, question:'빈칸에 알맞은 것은? "___ at the map, he found the way."', choices:['Look','Looked','Looking','To looked'], correct:2, explain:'능동 분사구문: 주어(he)가 직접 보는 능동 관계 → 현재분사(Looking)' },
          { kind:'mc', id:5, question:'어법상 옳은 것은?', choices:['It is necessary that he knows.','It is necessary that he know.','It is necessary that he knew.','It is necessary that he will know.'], correct:1, explain:'It is necessary/important/essential that + (should) + 동사원형' },
          { kind:'mc', id:6, question:'빈칸에 알맞은 것은? "The number of students ___ increasing."', choices:['are','were','is','have been'], correct:2, explain:'The number of + 복수명사 → 단수 동사(is). cf. A number of → 복수' },
          { kind:'mc', id:7, question:'어법상 틀린 것은?', choices:['Having finished the work, she left.','The problem was solved by him.','The car was repaired by Tom.','She was seen to enter.'], correct:0, explain:'Having finished = 능동 완료 분사구문으로 올바름. ②번이 올바른 수동태이므로 오답 없음 — ①은 정답' },
          { kind:'mc', id:8, question:'어법상 옳은 것은?', choices:['I saw him to run.','I saw him run.','I saw him ran.','I saw him running slowly is wrong.'], correct:1, explain:'지각동사 see + 목적어 + 동사원형(run) 또는 현재분사(running). to부정사 불가' },
          { kind:'mc', id:9, question:'빈칸에 알맞은 것은? "She insisted that he ___ the truth."', choices:['tells','told','tell','has told'], correct:2, explain:'insisted/suggested/demanded that + (should) + 동사원형(tell)' },
          { kind:'mc', id:10, question:'어법상 옳은 것은?', choices:['The news were surprising.','The news was surprising.','The news are surprising.','The newses were surprising.'], correct:1, explain:'news는 불가산명사 → 단수 동사(was). newses 없음' },
          { kind:'mc', id:11, question:'어법상 틀린 것은?', choices:['She had left before I arrived.','The letter was written by him.','Having studied hard, she passed.','The book lain on the table is mine.'], correct:3, explain:'lain은 lie(눕다)의 과거분사. "책이 놓여있는"의 의미로는 lying이 맞음' },
          { kind:'mc', id:12, question:'빈칸에 알맞은 것은? "I wish I ___ taller."', choices:['am','was','were','be'], correct:2, explain:'가정법 과거: I wish + 주어 + 동사의 과거형. be동사는 were 사용(단수도)' },
          { kind:'mc', id:13, question:'어법상 옳은 것은?', choices:['The boy whom I met was kind.','The boy which I met was kind.','The boy who I met him was kind.','The boy that he was kind.'], correct:0, explain:'사람 선행사 + 목적격 관계대명사 whom(=who/that). ①이 정확한 형태' },
          { kind:'mc', id:14, question:'빈칸에 알맞은 것은? "Not only she but also her friends ___ invited."', choices:['was','were','is','are'], correct:1, explain:'Not only A but also B: 동사는 B에 일치. her friends(복수) → were' },
          { kind:'mc', id:15, question:'어법상 틀린 것은?', choices:['She is used to living alone.','He used to live in Busan.','I am used to waking up early.','They used to playing soccer.'], correct:3, explain:'used to + 동사원형(과거 습관). ④ playing → play. be used to + -ing = ~에 익숙하다' },
        ]);
      } finally {
        setGrammarLoading(false);
      }
    })();
  }, [grammarPoints, grammarText, stepIndex, contentType]);

  const nextGrammarQ = useCallback(async () => {
    if (gIdx + 1 >= grammarQs.length) { await finishStep(); return; }
    setGIdx(i => i + 1);
    setGSel(-1);
    setGConfirmed(false);
  }, [gIdx, grammarQs.length, finishStep]);

  /* ── 뜻 맞추기 (meaning) ── */
  const [mIdx, setMIdx]     = useState(0);
  const [mSel, setMSel]     = useState<number>(-1);
  const [mDone, setMDone]   = useState(false);

  const handleMeaningNext = useCallback(async () => {
    if (mIdx + 1 >= words.length) { await finishStep(); return; }
    setMIdx(i => i + 1); setMSel(-1); setMDone(false);
  }, [mIdx, words.length, finishStep]);

  /* ── 철자 맞추기 (spelling) ── */
  const [sIdx, setSIdx]     = useState(0);
  const [sVal, setSVal]     = useState('');
  const [sState, setSState] = useState<'idle'|'ok'|'err'>('idle');

  const submitSpelling = useCallback(() => {
    const ans = words[sIdx].word;
    if (sVal.trim().toLowerCase() === ans) {
      setSState('ok');
      setTimeout(async () => {
        if (sIdx + 1 >= words.length) { await finishStep(); return; }
        setSIdx(i => i + 1); setSVal(''); setSState('idle');
      }, 600);
    } else {
      setSState('err');
    }
  }, [sIdx, sVal, words, finishStep]);

  /* ── 짝 맞추기 (matching) ── */
  const [matchLeft,  setMatchLeft]  = useState<number>(-1);
  const [matchDone,  setMatchDone]  = useState<number[]>([]);

  const selectMatch = useCallback((side: 'left'|'right', idx: number) => {
    if (matchDone.includes(idx)) return;
    if (side === 'left') {
      setMatchLeft(idx);
    } else {
      if (matchLeft === idx) {
        const next = [...matchDone, idx];
        setMatchDone(next);
        setMatchLeft(-1);
        if (next.length >= matchPairs.length) { setTimeout(finishStep, 500); }
      } else {
        setMatchLeft(-1); // 틀림 — 리셋
      }
    }
  }, [matchLeft, matchDone, matchPairs.length, finishStep]);

  /* ── 타이핑 (typing) ── */
  const [tIdx, setTIdx]     = useState(0);
  const [tVal, setTVal]     = useState('');
  const [tState, setTState] = useState<'idle'|'ok'|'err'>('idle');

  const submitTyping = useCallback(() => {
    const ans = words[tIdx].word;
    if (tVal.trim().toLowerCase() === ans) {
      setTState('ok');
      setTimeout(async () => {
        if (tIdx + 1 >= words.length) { await finishStep(); return; }
        setTIdx(i => i + 1); setTVal(''); setTState('idle');
      }, 600);
    } else {
      setTState('err');
    }
  }, [tIdx, tVal, words, finishStep]);

  /* ── 진행률 ── */
  const progressPct = (pct: number) => `${Math.min(100, pct)}%` as any;

  // 단어 로딩 중
  if (wordsLoading) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:14 }]}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={[Typography.body3, { color:Colors.ink3 }]}>단어를 불러오는 중...</Text>
      </View>
    );
  }

  // 단어 없음 (비어있는 경우)
  if ((type === 'meaning' || type === 'spelling' || type === 'matching' || type === 'typing') && words.length === 0) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:12 }]}>
        <Text style={{ fontSize:40 }}></Text>
        <Text style={[Typography.bold2, { color:Colors.ink }]}>단어가 없어요</Text>
        <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center' }]}>
          선생님이 단어를 등록하면{'\n'}자동으로 나타나요.
        </Text>
      </View>
    );
  }

  if (type === 'meaning') {
    const q   = words[mIdx];
    const pct = ((mIdx + 1) / words.length) * 100;
    return (
      <View style={s.wrap}>
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize:16, color:Colors.ink }}>←</Text>
          </Pressable>
          <View style={s.progTrack}><View style={[s.progFill, { width:progressPct(pct) }]} /></View>
          <Text style={[Typography.bold3, { color:Colors.ink }]}>{mIdx+1}/{words.length}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding:16 }}>
          <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>{stepTitle}</Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:14 }]}>단어의 한글 뜻을 고르세요</Text>

          {/* 단어 카드 */}
          <View style={s.wordCard}>
            <Text style={[Typography.h2, { letterSpacing:-1, marginBottom:5 }]}>{q.word}</Text>
            <Text style={[Typography.body3, { color:Colors.ink3, marginBottom:16 }]}>{q.phonetic}  {q.pos}</Text>
            {/* 단어장 저장 버튼 */}
            <Pressable onPress={async () => {
                    try {
                      const result = await addWord({ word:q.word, phonetic:q.phonetic, pos:q.pos, ko:q.ko, def:q.def, syn:'', contentId:lessonId, unitId:'' });
                      setToast(result === 'added' ? `V "${q.word}" 단어장에 저장됨` : `"${q.word}" 이미 저장된 단어예요`);
                      setTimeout(() => setToast(''), 2000);
                    } catch { setToast('저장 실패 — 네트워크를 확인해주세요'); setTimeout(() => setToast(''), 2000); }
                  }}
              style={s.addWordBtn}>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>+ 단어장 저장</Text>
            </Pressable>
          </View>
          {!!toast && (
            <View style={s.toastBox}>
              <Text style={[Typography.label2, { color:Colors.ink }]}>{toast}</Text>
            </View>
          )}

          {/* 보기 */}
          {q.choices.map((c, i) => {
            let bg: string = Colors.white, border: string = Colors.line, numBg: string = Colors.bg, numColor: string = Colors.ink3;
            if (mDone) {
              if (c === q.ko)          { bg=Colors.greenBg; border='#86efac'; numBg=Colors.green;  numColor='#fff'; }
              else if (i === mSel)     { bg=Colors.redBg;   border='#fca5a5'; numBg=Colors.red;    numColor='#fff'; }
            } else if (i === mSel)     { bg=Colors.brandBg; border=Colors.brand; numBg=Colors.brand; numColor='#fff'; }
            return (
              <Pressable key={i} onPress={() => { if (!mDone) { setMSel(i); } }}
                style={[s.choice, { backgroundColor:bg, borderColor:border }]}>
                <View style={[s.cnum, { backgroundColor:numBg }]}>
                  <Text style={[Typography.label2, { color:numColor }]}>{i+1}</Text>
                </View>
                <Text style={[Typography.body3, { color:Colors.ink, flex:1 }]}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.bottomBar}>
          <Pressable style={s.skipBtn} onPress={handleMeaningNext}>
            <Text style={[Typography.bold2, { color:Colors.ink3 }]}>건너뛰기</Text>
          </Pressable>
          {!mDone ? (
            <Pressable
              style={[s.confirmBtn, { opacity:mSel<0?0.4:1 }]}
              onPress={() => { if(mSel>=0) setMDone(true); }}
              disabled={mSel<0}
            >
              <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
            </Pressable>
          ) : (
            <Pressable style={[s.confirmBtn, { backgroundColor:words[mIdx].choices[mSel]===words[mIdx].ko ? Colors.green : Colors.red }]}
              onPress={handleMeaningNext}>
              <Text style={[Typography.bold2, { color:'#fff' }]}>
                {words[mIdx].choices[mSel]===words[mIdx].ko ? '정답! 다음 →' : '오답 · 다음 →'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (type === 'spelling') {
    const q   = words[sIdx];
    const pct = ((sIdx + 1) / words.length) * 100;
    const hint = q.word.split('').map((c, i) => i % 2 === 0 ? c : '_').join('');
    return (
      <View style={s.wrap}>
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><Text style={{ fontSize:16, color:Colors.ink }}>←</Text></Pressable>
          <View style={s.progTrack}><View style={[s.progFill, { width:progressPct(pct) }]} /></View>
          <Text style={[Typography.bold3, { color:Colors.ink }]}>{sIdx+1}/{words.length}</Text>
        </View>
        <View style={{ padding:16, flex:1 }}>
          <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>{stepTitle}</Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:14 }]}>한글 뜻을 보고 영어 단어를 입력하세요</Text>
          <View style={s.wordCard}>
            <Text style={[Typography.h3, { color:Colors.ink, marginBottom:6 }]}>{q.ko}</Text>
            <Text style={[Typography.body3, { color:Colors.ink3 }]}>힌트: {hint}</Text>
          </View>
          <TextInput
            style={[s.typeInput, sState==='ok' && s.typeOk, sState==='err' && s.typeErr]}
            value={sVal}
            onChangeText={v => { setSVal(v); setSState('idle'); }}
            placeholder="영어 단어 입력"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          {sState !== 'idle' && (
            <Text style={[Typography.bold3, { textAlign:'center', marginTop:10, color:sState==='ok'?Colors.greenDk:Colors.red }]}>
              {sState==='ok' ? 'V 정답!' : `X 정답: ${q.word}`}
            </Text>
          )}
        </View>
        <View style={s.bottomBar}>
          <Pressable style={s.skipBtn} onPress={() => { if(sIdx+1<words.length){setSIdx(i=>i+1);setSVal('');setSState('idle');}else finishStep(); }}>
            <Text style={[Typography.bold2, { color:Colors.ink3 }]}>건너뛰기</Text>
          </Pressable>
          <Pressable style={s.confirmBtn} onPress={submitSpelling}>
            <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (type === 'matching') {
    const pct = (matchDone.length / matchPairs.length) * 100;
    const shuffledRight = [...matchPairs].sort((a,b) => a.def.localeCompare(b.def));
    return (
      <View style={s.wrap}>
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><Text style={{ fontSize:16, color:Colors.ink }}>←</Text></Pressable>
          <View style={s.progTrack}><View style={[s.progFill, { width:progressPct(pct) }]} /></View>
          <Text style={[Typography.bold3, { color:Colors.ink }]}>{matchDone.length}/{matchPairs.length} 쌍</Text>
        </View>
        <View style={{ padding:16, flex:1 }}>
          <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>{stepTitle}</Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:16 }]}>단어와 영영풀이를 연결하세요</Text>
          <View style={{ flexDirection:'row', gap:10 }}>
            {/* 왼쪽: 단어 */}
            <View style={{ flex:1, gap:8 }}>
              {matchPairs.map((p, i) => {
                const done = matchDone.includes(i);
                return (
                  <Pressable key={i} onPress={() => !done && selectMatch('left', i)}
                    style={[s.matchBtn, done && s.matchDone, matchLeft===i && s.matchSel]}>
                    <Text style={[Typography.bold3, { color:done?Colors.greenDk:matchLeft===i?Colors.brand:Colors.ink }]}>{p.word}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* 오른쪽: 영영풀이 */}
            <View style={{ flex:1, gap:8 }}>
              {shuffledRight.map((p, i) => {
                const origIdx = matchPairs.findIndex(x => x.def === p.def);
                const done = matchDone.includes(origIdx);
                return (
                  <Pressable key={i} onPress={() => !done && selectMatch('right', origIdx)}
                    style={[s.matchBtn, done && s.matchDone, { paddingVertical:10 }]}>
                    <Text style={[Typography.label2, { color:done?Colors.greenDk:Colors.ink, textAlign:'center' }]}>{p.def}</Text>
                    {!!p.ko && (
                      <Text style={[Typography.label3, { color:done?Colors.greenDk:Colors.ink3, textAlign:'center', marginTop:4 }]}>
                        {p.ko}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // 🎓 LX팀 — 문법 Step 1~4 개선된 UI/UX
  // 원칙: 애니메이션 · 점수 피드백 · 확인 방식 학습 · 통일성
  // ══════════════════════════════════════════════════════════════

  // ── 문법 Step 1: 탭 확인 방식 개념 이해 ─────────────────────
  if (contentType === 'grammar' && parseInt(stepIndex??'0',10) === 0) {
    const GrammarStep1 = () => {
      const [checked, setChecked] = useState<boolean[]>(
        new Array(grammarPoints.length).fill(false)
      );
      const allChecked = checked.every(v => v);
      const scaleAnims = useRef(
        grammarPoints.map(() => new Animated.Value(1))
      ).current;

      const tapPoint = (i: number) => {
        // 체크 애니메이션: 살짝 커졌다가 돌아옴
        Animated.sequence([
          Animated.timing(scaleAnims[i], { toValue: 1.03, duration: 100, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(scaleAnims[i], { toValue: 1,    duration: 150, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        ]).start();
        setChecked(prev => { const n=[...prev]; n[i]=true; return n; });
      };

      return (
        <View style={s.wrap}>
          {/* 브랜드 컬러 헤더 */}
          <View style={sg.header}>
            <View style={sg.headerRow}>
              <Pressable style={sg.backBtn} onPress={() => router.back()}>
                <Text style={{ color:'#fff', fontSize:16 }}>←</Text>
              </Pressable>
              <View style={{ flex:1 }}>
                <Text style={[Typography.label3, { color:'rgba(255,255,255,.65)' }]}>문법 학습</Text>
                <Text style={[Typography.bold3, { color:'#fff' }]}>Step 1 · 개념 이해</Text>
              </View>
              <View style={sg.xpBadge}>
                <Text style={[Typography.label3, { color:'#fff', fontWeight:'700' }]}>+{xp} XP</Text>
              </View>
            </View>
            {/* 단계 도트 */}
            <View style={sg.dots}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[sg.dot, i===0 ? sg.dotActive : sg.dotIdle]} />
              ))}
            </View>
            {/* 진행 안내 */}
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.75)', marginTop:6 }]}>
              각 카드를 탭해서 내용을 확인하세요
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:110 }}>
            {grammarPoints.length === 0 ? (
              <View style={{ alignItems:'center', paddingTop:60, gap:12 }}>
                <Text style={{ fontSize:48 }}></Text>
                <Text style={[Typography.bold2, { color:Colors.ink3 }]}>문법 포인트가 없어요</Text>
                <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center' }]}>
                  선생님이 등록하면 자동으로 나타납니다
                </Text>
              </View>
            ) : (
              grammarPoints.map((pt, i) => (
                <Animated.View key={i} style={{ transform:[{ scale: scaleAnims[i] }], marginBottom:10 }}>
                  <Pressable
                    onPress={() => tapPoint(i)}
                    style={[sg.pointCard, checked[i] && sg.pointCardChecked]}
                  >
                    <View style={sg.pointCardTop}>
                      <View style={[sg.pointBadge, checked[i] && { backgroundColor:Colors.green }]}>
                        <Text style={[Typography.bold3, { color:'#fff', fontSize:11 }]}>
                          {checked[i] ? 'V' : String(i+1).padStart(2,'0')}
                        </Text>
                      </View>
                      <Text style={[Typography.label3, { color: checked[i] ? Colors.green : Colors.brand, fontWeight:'700', letterSpacing:.5 }]}>
                        {checked[i] ? '확인 완료' : `POINT ${String(i+1).padStart(2,'0')}`}
                      </Text>
                      {!checked[i] && (
                        <Text style={[Typography.label3, { color:Colors.ink3, marginLeft:'auto' as any }]}>
                          탭해서 확인
                        </Text>
                      )}
                    </View>
                    <Text style={[Typography.body3, { color:Colors.ink, lineHeight:24, marginTop:6 }]}>{pt}</Text>
                    {checked[i] && (
                      <View style={{ marginTop:8, paddingTop:8, borderTopWidth:0.5, borderTopColor:'#86efac' }}>
                        <Text style={[Typography.label3, { color:Colors.greenDk }]}>
                          V 다음 단계에서 이 포인트로 문제를 풀어봐요
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              ))
            )}

            {grammarText ? (
              <View style={sg.originCard}>
                <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:8 }]}> 원문 예시</Text>
                <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:24 }]}>{grammarText}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={s.bottomBar}>
            <Pressable
              onPress={finishStep}
              disabled={!allChecked}
              style={[sg.nextBtn, !allChecked && { backgroundColor:Colors.ink3 }]}
            >
              <Text style={[Typography.bold2, { color:'#fff' }]}>
                {allChecked ? '모두 확인! 다음 단계 →' : `${checked.filter(Boolean).length}/${grammarPoints.length} 확인 중...`}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    };
    return <GrammarStep1 />;
  }

  // ── 문법 Step 2: 예문 판단 (O/X + 점수 표시) ─────────────────
  if (contentType === 'grammar' && parseInt(stepIndex??'0',10) === 1) {
    // 올바른 예문 + 틀린 예문을 섞어서 출제
    const EXAMPLES_DATA = grammarPoints.flatMap((pt, pi) => {
      const correct = pt.includes('have') || pt.includes('has')
        ? `She has lived here for 10 years. (have/has + p.p. 현재완료 계속)`
        : pt.toLowerCase().includes('수동') || pt.includes('be') && pt.includes('p.p')
        ? `The book was written by her. (be + p.p. 수동태)`
        : pt.includes('분사') || pt.includes('Having')
        ? `Having finished homework, he played games. (완료 분사구문)`
        : `Example: ${pt}`;
      const wrong = pt.includes('have') || pt.includes('has')
        ? `She have lived here for 10 years. (주어 she → has가 맞음)`
        : pt.toLowerCase().includes('수동') || pt.includes('be') && pt.includes('p.p')
        ? `The book was wrote by her. (write 과거분사 → written)`
        : `Wrong example: ${pt}`;
      return [
        { point: pt, pointIdx: pi+1, sentence: correct, isCorrect: true  },
        { point: pt, pointIdx: pi+1, sentence: wrong,   isCorrect: false },
      ];
    }).sort(() => Math.random() - 0.5).slice(0, Math.max(4, grammarPoints.length * 2));

    const GrammarStep2 = () => {
      const [exIdx,   setExIdx]   = useState(0);
      const [sel,     setSel]     = useState<boolean|null>(null);
      const [confirmed, setConfirmed] = useState(false);
      const [score,   setScore]   = useState({ right:0, total:0 });
      const fadeAnim = useRef(new Animated.Value(1)).current;

      const cur = EXAMPLES_DATA[exIdx];
      const isRight = sel === cur.isCorrect;

      const confirm = () => {
        if (sel === null) return;
        setConfirmed(true);
        setScore(s => ({ right: s.right + (sel===cur.isCorrect?1:0), total: s.total+1 }));
      };

      const next = () => {
        // fade out → 다음 → fade in
        Animated.timing(fadeAnim, { toValue:0, duration:150, useNativeDriver:true }).start(() => {
          if (exIdx+1 >= EXAMPLES_DATA.length) { finishStep(); return; }
          setExIdx(i=>i+1); setSel(null); setConfirmed(false);
          Animated.timing(fadeAnim, { toValue:1, duration:200, useNativeDriver:true }).start();
        });
      };

      const pct = ((exIdx+1) / EXAMPLES_DATA.length) * 100;

      return (
        <View style={s.wrap}>
          <View style={sg.header}>
            <View style={sg.headerRow}>
              <Pressable style={sg.backBtn} onPress={() => router.back()}>
                <Text style={{ color:'#fff', fontSize:16 }}>←</Text>
              </Pressable>
              <View style={sg.progTrack}>
                <View style={[sg.progFill, { width:`${pct}%` as any }]} />
              </View>
              <Text style={[Typography.bold3, { color:'#fff' }]}>{exIdx+1}/{EXAMPLES_DATA.length}</Text>
            </View>
            <View style={sg.dots}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[sg.dot, i===1 ? sg.dotActive : i===0 ? sg.dotDone : sg.dotIdle]} />
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:110 }}>
            {/* 점수 카드 */}
            <View style={sg.scoreRow}>
              <View style={sg.scoreCell}>
                <Text style={[Typography.statSm, { color:Colors.green, fontSize:16 }]}>{score.right}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3 }]}>정답</Text>
              </View>
              <View style={[sg.scoreCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.red, fontSize:16 }]}>{score.total - score.right}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3 }]}>오답</Text>
              </View>
              <View style={[sg.scoreCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.brand, fontSize:16 }]}>
                  {score.total > 0 ? Math.round((score.right/score.total)*100) : 0}%
                </Text>
                <Text style={[Typography.label3, { color:Colors.ink3 }]}>정답률</Text>
              </View>
            </View>

            <Animated.View style={{ opacity: fadeAnim }}>
              {/* 포인트 태그 */}
              <View style={sg.pointTag}>
                <Text style={[Typography.label3, { color:Colors.brand, fontWeight:'700' }]}>
                  POINT {String(cur.pointIdx).padStart(2,'0')} · {cur.point.slice(0,20)}{cur.point.length>20?'...':''}
                </Text>
              </View>

              {/* 예문 카드 */}
              <View style={sg.sentenceCard}>
                <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:8 }]}>
                  다음 문장이 어법상 올바른가요?
                </Text>
                <Text style={[Typography.body3, { color:Colors.ink, lineHeight:26, fontStyle:'italic', fontSize:13 }]}>
                  "{cur.sentence.split('(')[0].trim()}"
                </Text>
                {cur.sentence.includes('(') && (
                  <Text style={[Typography.label3, { color:Colors.ink3, marginTop:5 }]}>
                    힌트: {cur.sentence.split('(')[1].replace(')','').trim()}
                  </Text>
                )}
              </View>

              {/* O / X 버튼 */}
              <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
                {([true, false] as const).map(val => {
                  let bg: string = Colors.white, border: string = Colors.line;
                  if (confirmed) {
                    if (val === cur.isCorrect)   { bg = Colors.greenBg; border = '#86efac'; }
                    else if (sel === val)         { bg = Colors.redBg;   border = '#fca5a5'; }
                  } else if (sel === val) {
                    bg = val ? Colors.brandBg : Colors.redBg;
                    border = val ? Colors.brand : Colors.red;
                  }
                  return (
                    <Pressable
                      key={val ? 'O' : 'X'}
                      onPress={() => { if (!confirmed) setSel(val); }}
                      style={[sg.oxBtn, { backgroundColor:bg, borderColor:border }]}
                    >
                      <Text style={{ fontSize:32, fontWeight:'800',
                        color: confirmed && val===cur.isCorrect ? Colors.green
                             : confirmed && sel===val && !isRight ? Colors.red
                             : sel===val ? (val ? Colors.brand : Colors.red)
                             : Colors.ink3
                      }}>
                        {val ? 'O' : 'X'}
                      </Text>
                      <Text style={[Typography.label3, { color:Colors.ink3, marginTop:4, fontWeight:'700' }]}>
                        {val ? '올바르다' : '틀리다'}
                      </Text>
                      {confirmed && val===cur.isCorrect && (
                        <Text style={{ fontSize:16, marginTop:2 }}>V</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* 해설 */}
              {confirmed && (
                <Animated.View style={sg.explainBox}>
                  <Text style={[Typography.label2, { color: isRight ? Colors.greenDk : Colors.red, marginBottom:5 }]}>
                    {isRight ? 'V 정답!' : 'X 오답'}
                  </Text>
                  <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:20 }]}>
                    {cur.isCorrect
                      ? `올바른 문장입니다. ${cur.point}`
                      : `틀린 문장입니다. ${cur.sentence.includes('(') ? cur.sentence.split('(')[1].replace(')','').trim() : cur.point}`
                    }
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>

          <View style={s.bottomBar}>
            {!confirmed ? (
              <Pressable
                onPress={confirm}
                disabled={sel===null}
                style={[sg.nextBtn, sel===null && { opacity:0.4 }]}
              >
                <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={next}
                style={[sg.nextBtn, { backgroundColor: isRight ? Colors.green : Colors.red }]}
              >
                <Text style={[Typography.bold2, { color:'#fff' }]}>
                  {isRight ? '정답! 다음 →' : '오답 · 다음 →'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    };
    return <GrammarStep2 />;
  }

  // ── 문법 Step 3/4: 연속 정답·타이머·XP 있는 퀴즈 ─────────────
  if (contentType === 'grammar' && (parseInt(stepIndex??'0',10) === 2 || parseInt(stepIndex??'0',10) === 3)) {
    const stepIdx4 = parseInt(stepIndex??'0',10);
    const isStep4  = stepIdx4 === 3;

    if (grammarLoading) {
      return (
        <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:16 }]}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={[Typography.bold2, { color:Colors.ink }]}>
            {isStep4 ? '실전 퀴즈 생성 중...' : '빈칸 문제 생성 중...'}
          </Text>
          <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', lineHeight:22 }]}>
            AI가 {grammarPoints.join(', ')} 관련{'\n'}문제를 만들고 있어요
          </Text>
        </View>
      );
    }

    const GrammarQuiz = () => {
      const [idx,       setIdx]       = useState(0);
      const [sel,       setSel]       = useState(-1);
      const [confirmed, setConfirmed] = useState(false);
      const [stats,     setStats]     = useState({ right:0, wrong:0, streak:0, xp:0 });
      const [timeLeft,  setTimeLeft]  = useState(isStep4 ? grammarQs.length * 40 : 0);
      const scaleAnim  = useRef(new Animated.Value(1)).current;
      const shakeAnim  = useRef(new Animated.Value(0)).current;
      const fadeAnim   = useRef(new Animated.Value(1)).current;

      // Step 4 타이머
      useEffect(() => {
        if (!isStep4) return;
        const t = setInterval(() => setTimeLeft(s => Math.max(0, s-1)), 1000);
        return () => clearInterval(t);
      }, []);

      const q = grammarQs[idx];
      if (!q) return null;

      const isRight = sel === q.correct;
      const pct = ((idx+1) / grammarQs.length) * 100;
      const mm  = Math.floor(timeLeft/60).toString().padStart(2,'0');
      const ss  = (timeLeft%60).toString().padStart(2,'0');
      const isLow = timeLeft < 60;

      const confirmAnswer = () => {
        if (sel < 0) return;
        setConfirmed(true);
        if (sel === q.correct) {
          // 정답 애니메이션: 살짝 크게
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue:1.04, duration:120, useNativeDriver:true }),
            Animated.timing(scaleAnim, { toValue:1,    duration:150, useNativeDriver:true }),
          ]).start();
          const streak = stats.streak + 1;
          const bonus  = streak >= 3 ? 20 : streak >= 2 ? 10 : 0;
          setStats(s => ({ right:s.right+1, wrong:s.wrong, streak, xp:s.xp+10+bonus }));
        } else {
          // 오답 쉐이크
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue:6,  duration:50,  useNativeDriver:true }),
            Animated.timing(shakeAnim, { toValue:-6, duration:50,  useNativeDriver:true }),
            Animated.timing(shakeAnim, { toValue:4,  duration:50,  useNativeDriver:true }),
            Animated.timing(shakeAnim, { toValue:0,  duration:50,  useNativeDriver:true }),
          ]).start();
          setStats(s => ({ right:s.right, wrong:s.wrong+1, streak:0, xp:s.xp }));
        }
      };

      const nextQ = async () => {
        Animated.timing(fadeAnim, { toValue:0, duration:120, useNativeDriver:true }).start(() => {
          if (idx+1 >= grammarQs.length) { finishStep(); return; }
          setIdx(i=>i+1); setSel(-1); setConfirmed(false);
          Animated.timing(fadeAnim, { toValue:1, duration:180, useNativeDriver:true }).start();
        });
      };

      return (
        <View style={s.wrap}>
          {/* 헤더 — Step 4는 다크, Step 3는 브랜드 */}
          <View style={[sg.header, isStep4 && { backgroundColor:'#0E0E10' }]}>
            <View style={sg.headerRow}>
              <Pressable style={sg.backBtn} onPress={() => router.back()}>
                <Text style={{ color:'#fff', fontSize:16 }}>←</Text>
              </Pressable>
              <View style={sg.progTrack}>
                <View style={[sg.progFill, { width:`${pct}%` as any,
                  backgroundColor: isStep4 ? Colors.amber : '#fff' }]} />
              </View>
              {isStep4 ? (
                <View style={[sg.timerBadge, isLow && { backgroundColor:Colors.red }]}>
                  <Text style={[Typography.bold3, { color:'#fff' }]}>{mm}:{ss}</Text>
                </View>
              ) : (
                <Text style={[Typography.bold3, { color:'#fff' }]}>{idx+1}/{grammarQs.length}</Text>
              )}
            </View>
            <View style={sg.dots}>
              {[0,1,2,3].map(i => (
                <View key={i} style={[
                  sg.dot,
                  i < stepIdx4   ? sg.dotDone   :
                  i === stepIdx4 ? sg.dotActive  : sg.dotIdle
                ]} />
              ))}
            </View>
          </View>

          {/* 실시간 스탯 */}
          <View style={sg.statBar}>
            <View style={sg.statCell}>
              <Text style={[Typography.bold3, { color:Colors.green }]}>{stats.right}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>정답</Text>
            </View>
            <View style={[sg.statCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
              <Text style={[Typography.bold3, { color:Colors.red }]}>{stats.wrong}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>오답</Text>
            </View>
            <View style={[sg.statCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
              <Text style={[Typography.bold3, { color:Colors.amber }]}>
                {stats.streak >= 3 ? '' : ''}{stats.streak}
              </Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>연속</Text>
            </View>
            <View style={[sg.statCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
              <Text style={[Typography.bold3, { color:Colors.brand }]}>+{stats.xp}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>XP</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:110 }}>
            <Animated.View style={{ opacity:fadeAnim, transform:[
              { scale: scaleAnim },
              { translateX: shakeAnim },
            ] }}>
              {/* 문제 유형 배지 */}
              <View style={[sg.kindBadge,
                q.kind==='fill' ? { backgroundColor:Colors.brandBg } : { backgroundColor:Colors.greenBg }
              ]}>
                <Text style={[Typography.label3, { fontWeight:'700',
                  color: q.kind==='fill' ? Colors.brand : Colors.greenDk }]}>
                  {q.kind==='fill' ? '빈칸 완성' : '어법 판단'}
                </Text>
              </View>

              {/* 문제 */}
              <View style={sg.questionCard}>
                {q.kind === 'fill' && q.sentence ? (
                  <Text style={[Typography.bold2, { color:Colors.ink, lineHeight:28 }]}>
                    {q.sentence.split('___').map((part: string, i: number, arr: string[]) => (
                      <Text key={i}>
                        {part}
                        {i < arr.length-1 && (
                          <Text style={{ color:Colors.brand, textDecorationLine:'underline', fontWeight:'800' }}>
                            {' ___ '}
                          </Text>
                        )}
                      </Text>
                    ))}
                  </Text>
                ) : (
                  <Text style={[Typography.bold2, { color:Colors.ink, lineHeight:26 }]}>
                    {q.question}
                  </Text>
                )}
              </View>

              {/* 선택지 */}
              <View style={{ gap:8 }}>
                {q.choices.map((c: string, i: number) => {
                  let bg: string = Colors.white, border: string = Colors.line, numBg: string = Colors.bg, numColor: string = Colors.ink3;
                  if (confirmed) {
                    if (i === q.correct)     { bg=Colors.greenBg; border='#86efac'; numBg=Colors.green; numColor='#fff'; }
                    else if (i === sel)      { bg=Colors.redBg;   border='#fca5a5'; numBg=Colors.red;   numColor='#fff'; }
                  } else if (i === sel) {
                    bg=Colors.brandBg; border=Colors.brand; numBg=Colors.brand; numColor='#fff';
                  }
                  return (
                    <Pressable
                      key={i}
                      onPress={() => { if (!confirmed) setSel(i); }}
                      style={[sg.choice, { backgroundColor:bg, borderColor:border }]}
                    >
                      <View style={[sg.choiceNum, { backgroundColor:numBg }]}>
                        <Text style={[Typography.label2, { color:numColor }]}>{i+1}</Text>
                      </View>
                      <Text style={[Typography.body3, { flex:1, color:Colors.ink, lineHeight:20 }]}>{c}</Text>
                      {confirmed && i === q.correct && (
                        <Text style={{ color:Colors.green, fontSize:14, fontWeight:'800' }}>V</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* 연속 정답 보너스 알림 */}
              {confirmed && isRight && stats.streak >= 3 && (
                <View style={sg.streakBanner}>
                  <Text style={[Typography.bold2, { color:Colors.orange }]}>
                     {stats.streak}연속 정답! +{stats.streak >= 3 ? 20 : 10} 보너스 XP
                  </Text>
                </View>
              )}

              {/* 해설 */}
              {confirmed && (
                <View style={[sg.explainBox, !isRight && { borderColor:'#fca5a5' }]}>
                  <Text style={[Typography.label2, { color: isRight ? Colors.brand : Colors.red, marginBottom:5 }]}>
                    {isRight ? 'V 정답 · 해설' : 'X 오답 · 해설'}
                  </Text>
                  <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:20 }]}>
                    {q.explain}
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          <View style={s.bottomBar}>
            <Pressable style={s.skipBtn} onPress={nextQ}>
              <Text style={[Typography.bold2, { color:Colors.ink3 }]}>건너뛰기</Text>
            </Pressable>
            {!confirmed ? (
              <Pressable
                onPress={confirmAnswer}
                disabled={sel<0}
                style={[sg.nextBtn, { flex:2 }, sel<0 && { opacity:0.4 }]}
              >
                <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={nextQ}
                style={[sg.nextBtn, { flex:2, backgroundColor: isRight ? Colors.green : Colors.red }]}
              >
                <Text style={[Typography.bold2, { color:'#fff' }]}>
                  {isRight ? '정답! 다음 →' : '오답 · 다음 →'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      );
    };
    return <GrammarQuiz />;
  }


  if (type === 'typing' || type === 'grammar_mc' || type === 'content_mc') {
    const q   = words[tIdx];
    const pct = ((tIdx + 1) / words.length) * 100;
    return (
      <View style={s.wrap}>
        <View style={s.topBar}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><Text style={{ fontSize:16, color:Colors.ink }}>←</Text></Pressable>
          <View style={s.progTrack}><View style={[s.progFill, { width:progressPct(pct) }]} /></View>
          <Text style={[Typography.bold3, { color:Colors.ink }]}>{tIdx+1}/{words.length}</Text>
        </View>
        <View style={{ padding:16, flex:1 }}>
          <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>{stepTitle}</Text>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:14 }]}>영영풀이를 보고 단어를 입력하세요</Text>
          <View style={s.wordCard}>
            <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:22, marginBottom:6 }]}>{q.def}</Text>
            <Text style={[Typography.label2, { color:Colors.ink3 }]}>{q.pos}</Text>
          </View>
          <TextInput
            style={[s.typeInput, tState==='ok' && s.typeOk, tState==='err' && s.typeErr]}
            value={tVal}
            onChangeText={v => { setTVal(v); setTState('idle'); }}
            placeholder="영어 단어 입력"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
          {tState !== 'idle' && (
            <Text style={[Typography.bold3, { textAlign:'center', marginTop:10, color:tState==='ok'?Colors.greenDk:Colors.red }]}>
              {tState==='ok' ? 'V 정답!' : `X 정답: ${q.word}`}
            </Text>
          )}
        </View>
        <View style={s.bottomBar}>
          <Pressable style={s.skipBtn} onPress={() => { if(tIdx+1<words.length){setTIdx(i=>i+1);setTVal('');setTState('idle');}else finishStep(); }}>
            <Text style={[Typography.bold2, { color:Colors.ink3 }]}>건너뛰기</Text>
          </Pressable>
          <Pressable style={s.confirmBtn} onPress={submitTyping}>
            <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  topBar:     { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingTop:52, paddingBottom:12, backgroundColor:Colors.white, borderBottomWidth:1, borderBottomColor:Colors.line },
  backBtn:    { width:32, height:32, borderRadius:10, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  progTrack:  { flex:1, height:5, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  progFill:   { height:'100%', backgroundColor:Colors.brand, borderRadius:99 },
  wordCard:   { backgroundColor:Colors.white, borderRadius:20, borderWidth:1, borderColor:Colors.line, padding:24, alignItems:'center', marginBottom:16 },
  addWordBtn: { paddingHorizontal:14, paddingVertical:6, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.bg },
  toastBox:   { backgroundColor:Colors.white, borderRadius:12, borderWidth:1, borderColor:Colors.line, paddingHorizontal:14, paddingVertical:10, marginBottom:12 },
  choice:     { flexDirection:'row', alignItems:'center', gap:10, borderRadius:12, borderWidth:1.5, padding:13, marginBottom:8 },
  cnum:       { width:26, height:26, borderRadius:7, alignItems:'center', justifyContent:'center', flexShrink:0 },
  typeInput:  { borderWidth:2, borderColor:Colors.line, borderRadius:12, padding:14, fontFamily:'Pretendard-Bold', fontSize:18, color:Colors.ink, textAlign:'center', letterSpacing:2, backgroundColor:Colors.bg, marginBottom:4 },
  typeOk:     { borderColor:Colors.green, backgroundColor:Colors.greenBg, color:Colors.greenDk },
  typeErr:    { borderColor:Colors.red, backgroundColor:Colors.redBg, color:Colors.red },
  matchBtn:   { borderRadius:12, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white, padding:13, alignItems:'center' },
  matchSel:   { borderColor:Colors.brand, backgroundColor:Colors.brandBg },
  matchDone:  { borderColor:'#86efac', backgroundColor:Colors.greenBg },
  bottomBar:  { flexDirection:'row', gap:10, padding:14, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.line },
  skipBtn:    { flex:1, padding:14, borderRadius:13, borderWidth:1.5, borderColor:Colors.line, alignItems:'center' },
  confirmBtn: { flex:2, padding:14, borderRadius:13, backgroundColor:Colors.brand, alignItems:'center' },
});

// ── 문법 전용 스타일 (sg) ─────────────────────────────────────────
const sg = StyleSheet.create({
  // 헤더
  header:        { backgroundColor:Colors.brand, paddingTop:52, paddingHorizontal:16, paddingBottom:14 },
  headerRow:     { flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 },
  backBtn:       { width:28, height:28, borderRadius:8, borderWidth:1, borderColor:'rgba(255,255,255,.3)', alignItems:'center', justifyContent:'center' },
  xpBadge:       { backgroundColor:'rgba(255,255,255,.18)', borderRadius:99, paddingHorizontal:10, paddingVertical:3 },
  progTrack:     { flex:1, height:4, backgroundColor:'rgba(255,255,255,.25)', borderRadius:99, overflow:'hidden' },
  progFill:      { height:'100%', backgroundColor:'#fff', borderRadius:99 },
  // 단계 도트
  dots:          { flexDirection:'row', gap:5 },
  dot:           { height:4, borderRadius:2 },
  dotIdle:       { width:18, backgroundColor:'rgba(255,255,255,.25)' },
  dotActive:     { width:26, backgroundColor:'#fff' },
  dotDone:       { width:18, backgroundColor:'rgba(255,255,255,.6)' },
  // Step 1
  pointCard:     { backgroundColor:Colors.white, borderRadius:14, borderWidth:1.5, borderColor:Colors.line, borderLeftWidth:4, borderLeftColor:Colors.brand, padding:14 },
  pointCardChecked: { borderColor:'#86efac', borderLeftColor:Colors.green, backgroundColor:Colors.greenBg },
  pointCardTop:  { flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 },
  pointBadge:    { width:26, height:26, borderRadius:7, backgroundColor:Colors.brand, alignItems:'center', justifyContent:'center' },
  originCard:    { backgroundColor:Colors.bg, borderRadius:13, padding:14, marginTop:8 },
  nextBtn:       { flex:1, padding:14, borderRadius:13, backgroundColor:Colors.brand, alignItems:'center' },
  // Step 2
  scoreRow:      { flexDirection:'row', backgroundColor:Colors.white, borderRadius:12, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:12 },
  scoreCell:     { flex:1, padding:10, alignItems:'center' },
  pointTag:      { backgroundColor:Colors.brandBg, borderRadius:99, paddingHorizontal:12, paddingVertical:5, marginBottom:10, alignSelf:'flex-start' as any },
  sentenceCard:  { backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:12 },
  oxBtn:         { flex:1, alignItems:'center', paddingVertical:18, borderRadius:14, borderWidth:2 },
  explainBox:    { backgroundColor:Colors.bg, borderRadius:12, borderWidth:1, borderColor:Colors.line, padding:13, marginTop:10 },
  // Step 3/4
  timerBadge:    { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,.12)', borderRadius:9, paddingHorizontal:10, paddingVertical:5 },
  statBar:       { flexDirection:'row', backgroundColor:Colors.white, borderBottomWidth:1, borderBottomColor:Colors.line },
  statCell:      { flex:1, paddingVertical:8, alignItems:'center' },
  kindBadge:     { alignSelf:'flex-start' as any, paddingHorizontal:10, paddingVertical:4, borderRadius:99, marginBottom:8 },
  questionCard:  { backgroundColor:Colors.brandBg, borderRadius:14, borderWidth:1, borderColor:'#DDD9FF', padding:14, marginBottom:12 },
  choice:        { flexDirection:'row', alignItems:'center', gap:10, borderRadius:12, borderWidth:1.5, padding:13 },
  toastBox:      { backgroundColor:Colors.white, borderRadius:12, borderWidth:1, borderColor:Colors.line, paddingHorizontal:14, paddingVertical:10, marginBottom:12 },
  choiceNum:     { width:26, height:26, borderRadius:7, alignItems:'center', justifyContent:'center', flexShrink:0 },
  streakBanner:  { backgroundColor:Colors.amberBg, borderRadius:10, padding:10, marginTop:8, alignItems:'center' },
});
