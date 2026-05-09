// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { generateMockQuestion, MockQType } from '../../../lib/gemini';
import { useStudy } from '../../../hooks/useStudy';
import { useWrongNote } from '../../../hooks/useWrongNote';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

// ── 문항 유형 ──
type QType = 'grammar' | 'fill' | 'topic' | 'order_sentence' | 'reference';

interface Question {
  id:       number;
  type:     QType;
  passage:  string;
  question: string;
  choices:  string[];
  correct:  number;
  explain:  string;
}

// ── 25문항 데이터 ──
const QUESTIONS: Question[] = [
  // 어법 (grammar) 5문항
  { id:1,  type:'grammar', passage:'For most of human history, people (A) _____ the night sky with wonder. Long before modern telescopes (B) _____ invented, ancient astronomers used patterns of stars.', question:'빈칸 (A), (B)에 들어갈 어법으로 옳은 것은?', choices:['have observed · were','observed · was','have observed · was','has observed · were'], correct:0, explain:'(A) for most of human history = 계속적 현재완료. (B) telescopes는 복수 주어, be동사 복수형 were.' },
  { id:2,  type:'grammar', passage:'She insisted that he (A) _____ the truth, which made everyone (B) _____ uncomfortable.', question:'(A), (B)에 알맞은 것은?', choices:['tell · feel','tells · feeling','told · felt','tell · feeling'], correct:0, explain:'insisted 뒤 that절에는 should가 생략된 동사원형 사용. make + 목적어 + 동사원형.' },
  { id:3,  type:'grammar', passage:'The number of students who _____ interested in astronomy has increased dramatically.', question:'빈칸에 알맞은 것은?', choices:['are','is','were','be'], correct:1, explain:'The number of + 복수명사 → 단수 동사. The number is ...로 받음.' },
  { id:4,  type:'grammar', passage:'_____ by modern technology, ancient navigation methods are still taught in some schools.', question:'빈칸에 알맞은 것은?', choices:['Replacing','Replaced','Having replaced','To replace'], correct:1, explain:'분사구문: 수동 관계 → 과거분사 Replaced.' },
  { id:5,  type:'grammar', passage:'It is essential that every student _____ the safety rules before using the laboratory.', question:'빈칸에 알맞은 것은?', choices:['knows','know','will know','has known'], correct:1, explain:'It is essential that 뒤 → (should) + 동사원형.' },

  // 빈칸 (fill) 6문항
  { id:6,  type:'fill', passage:'The ancient Egyptians built the pyramids as tombs for their pharaohs. These massive structures show the _____ engineering skills of ancient civilizations.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['primitive','remarkable','limited','accidental'], correct:1, explain:'피라미드의 정교함을 설명하는 문맥 → remarkable(놀라운).' },
  { id:7,  type:'fill', passage:'Despite being thousands of years old, the pyramids have _____ the test of time, standing tall against all natural forces.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['failed','passed','taken','broken'], correct:1, explain:'stand the test of time = 세월을 견디다. pass the test = 시험을 통과하다.' },
  { id:8,  type:'fill', passage:'Astronomers use telescopes to _____ light from distant stars, allowing them to study the composition of those stars.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['emit','ignore','collect','destroy'], correct:2, explain:'망원경으로 별빛을 수집(collect)하여 분석하는 문맥.' },
  { id:9,  type:'fill', passage:'The discovery of penicillin was _____ ; Alexander Fleming noticed it by accident while studying bacteria.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['deliberate','intentional','accidental','planned'], correct:2, explain:'by accident = 우연히 → accidental(우연한).' },
  { id:10, type:'fill', passage:'Scientists believe that regular exercise can _____ the risk of developing heart disease by improving cardiovascular health.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['increase','reduce','ignore','confirm'], correct:1, explain:'운동이 심장병 위험을 줄인다는 문맥 → reduce.' },
  { id:11, type:'fill', passage:'The artist spent years _____ her technique before finally gaining recognition for her unique style.', question:'빈칸에 들어갈 말로 가장 적절한 것은?', choices:['abandoning','ignoring','perfecting','forgetting'], correct:2, explain:'인정받기 전 기술을 연마하는 문맥 → perfecting(완성시키다).' },

  // 주제/요지 (topic) 5문항
  { id:12, type:'topic', passage:'Laughter is often called the best medicine. Studies show that laughing reduces stress hormones and increases immune cells. People who laugh regularly tend to live longer and report higher levels of happiness. Even forced laughter has been shown to have positive health effects.', question:'위 글의 주제로 가장 적절한 것은?', choices:['웃음의 건강상 이점','스트레스 호르몬의 종류','면역 세포의 기능','행복의 정의'], correct:0, explain:'웃음이 건강에 미치는 긍정적 효과를 전체적으로 다루고 있습니다.' },
  { id:13, type:'topic', passage:'The internet has transformed the way we access information. Instead of visiting a library, people can now find answers in seconds. However, this ease of access has also led to the spread of misinformation. Critical thinking has become more important than ever.', question:'위 글의 요지로 가장 적절한 것은?', choices:['인터넷은 도서관을 대체했다','인터넷은 정보 접근을 바꿨지만 비판적 사고가 필요하다','미디어 리터러시는 불필요하다','인터넷에서 모든 정보는 신뢰할 수 있다'], correct:1, explain:'인터넷의 장점과 함께 비판적 사고의 필요성을 강조하고 있습니다.' },
  { id:14, type:'topic', passage:'Many cities are investing in green spaces to combat urban heat islands. Parks and trees absorb heat and provide shade, reducing temperatures by up to 5 degrees. Green roofs and vertical gardens are also becoming popular solutions to make cities more livable.', question:'위 글의 제목으로 가장 적절한 것은?', choices:['도시 열섬 현상의 원인','녹지 공간으로 도시 온도 낮추기','수직 정원의 역사','공원 설계의 기본 원칙'], correct:1, explain:'도시 녹지가 열섬 현상을 완화하는 방법에 대한 글입니다.' },
  { id:15, type:'topic', passage:'Sleep deprivation affects millions of people worldwide. Lack of sleep impairs cognitive function, weakens the immune system, and increases the risk of chronic diseases. Despite knowing its importance, many people sacrifice sleep for work or entertainment.', question:'위 글이 주로 주장하는 것은?', choices:['수면은 건강에 매우 중요하다','만성 질환의 치료법','오락이 수면보다 중요하다','인지 기능 향상 방법'], correct:0, explain:'수면 부족의 부작용을 나열하며 수면의 중요성을 강조합니다.' },
  { id:16, type:'topic', passage:'Volunteering benefits not only the community but also the volunteers themselves. People who volunteer regularly report lower levels of depression, greater sense of purpose, and improved social connections. Even a few hours a month can make a significant difference.', question:'위 글의 주제로 가장 적절한 것은?', choices:['자원봉사의 상호적 혜택','지역사회 개발의 방법','우울증 치료의 종류','사회적 연결의 중요성'], correct:0, explain:'자원봉사가 지역사회와 봉사자 모두에게 이익이 된다는 내용입니다.' },

  // 순서배열 (order_sentence) 4문항
  { id:17, type:'order_sentence', passage:'(A) However, once people began farming, they settled in one place and built more permanent structures.\n(B) For thousands of years, early humans lived as nomads, moving from place to place to find food.\n(C) This shift to a settled lifestyle led to the development of the first cities and civilizations.\n(D) These early cities were the birthplace of writing, law, and organized religion.', question:'글의 순서로 가장 알맞은 것은?', choices:['(B)-(A)-(C)-(D)','(A)-(B)-(C)-(D)','(B)-(C)-(A)-(D)','(A)-(C)-(B)-(D)'], correct:0, explain:'(B) 유목민 생활 → (A) 농업 시작으로 정착 → (C) 정착 생활의 결과 → (D) 최초 도시의 특징.' },
  { id:18, type:'order_sentence', passage:'(A) As a result, companies have started offering flexible work-from-home options.\n(B) The COVID-19 pandemic forced millions of workers to work remotely.\n(C) Studies show that many employees actually prefer this new arrangement.\n(D) This suggests that the traditional 9-to-5 office model may be permanently changing.', question:'글의 순서로 가장 알맞은 것은?', choices:['(B)-(A)-(C)-(D)','(A)-(B)-(C)-(D)','(B)-(C)-(A)-(D)','(C)-(B)-(A)-(D)'], correct:0, explain:'(B) 팬데믹으로 재택근무 시작 → (A) 기업들의 대응 → (C) 직원들의 선호 → (D) 결론.' },
  { id:19, type:'order_sentence', passage:'(A) This allows the plant to survive long periods without rain.\n(B) Cacti have evolved remarkable adaptations to desert environments.\n(C) Their thick, waxy skin prevents water loss through evaporation.\n(D) Additionally, their shallow but wide roots quickly absorb any rainfall.', question:'글의 순서로 가장 알맞은 것은?', choices:['(B)-(C)-(D)-(A)','(A)-(B)-(C)-(D)','(C)-(D)-(B)-(A)','(B)-(A)-(C)-(D)'], correct:0, explain:'(B) 선인장의 적응 일반 언급 → (C) 피부의 특성 → (D) 뿌리의 특성 → (A) 결론.' },
  { id:20, type:'order_sentence', passage:'(A) Researchers discovered that the pigment melanin is responsible for these colors.\n(B) For centuries, the vibrant colors of butterfly wings fascinated scientists.\n(C) Modern microscopes revealed that the wings contain thousands of tiny scales.\n(D) Each scale reflects light differently, creating the beautiful patterns we see.', question:'글의 순서로 가장 알맞은 것은?', choices:['(B)-(C)-(D)-(A)','(A)-(B)-(C)-(D)','(B)-(A)-(C)-(D)','(C)-(B)-(D)-(A)'], correct:0, explain:'(B) 나비 날개 색에 대한 흥미 → (C) 현미경으로 발견 → (D) 빛 반사 원리 → (A) 멜라닌 역할.' },

  // 지칭·어휘 추론 (reference) 5문항
  { id:21, type:'reference', passage:'The sun is a star located at the center of our solar system. It provides light and heat to all the planets. Without it, life on Earth would be impossible. Scientists study it to better understand other stars.', question:"밑줄 친 'it'가 가리키는 것은?", choices:['the solar system','the sun','Earth','life'], correct:1, explain:"it은 앞 문장의 the sun을 지칭합니다." },
  { id:22, type:'reference', passage:'Marie Curie was a pioneering scientist who discovered two elements: polonium and radium. Despite facing discrimination as a woman in science, she won the Nobel Prize twice. Her dedication inspired generations of female scientists.', question:"밑줄 친 'Her'가 가리키는 것은?", choices:['a female scientist','polonium','Marie Curie','the Nobel Prize'], correct:2, explain:"Her는 문장의 주어 Marie Curie를 지칭합니다." },
  { id:23, type:'reference', passage:'The Amazon rainforest is often called the "lungs of the Earth" because it produces about 20% of the world\'s oxygen. This vast ecosystem also holds more than half of the world\'s species. Protecting it is crucial for global biodiversity.', question:"밑줄 친 'it'(마지막 문장)가 가리키는 것은?", choices:['oxygen','the Earth','the Amazon rainforest','global biodiversity'], correct:2, explain:"마지막 문장의 it은 The Amazon rainforest를 지칭합니다." },
  { id:24, type:'reference', passage:'Albert Einstein proposed the theory of relativity, which revolutionized our understanding of space and time. This groundbreaking idea challenged centuries of scientific thought. Many of its predictions have since been confirmed by experiments.', question:"밑줄 친 'its'가 가리키는 것은?", choices:['Einstein','space and time','the theory of relativity','scientific thought'], correct:2, explain:"its는 바로 앞 문장의 This groundbreaking idea = the theory of relativity를 지칭합니다." },
  { id:25, type:'reference', passage:'Ocean currents play a vital role in regulating Earth\'s climate. They distribute heat from the equator to the poles, preventing extreme temperature differences. Without them, many regions would become uninhabitable.', question:"밑줄 친 'them'이 가리키는 것은?", choices:['ocean currents','temperature differences','the poles','regions'], correct:0, explain:"them은 복수 주어 Ocean currents를 지칭합니다." },
];

const TYPE_LABELS: Record<QType, string> = {
  grammar:          '어법',
  fill:             '빈칸',
  topic:            '주제/요지',
  order_sentence:   '순서배열',
  reference:        '지칭/추론',
};
const TYPE_COLOR: Record<QType, string> = {
  grammar:        Colors.brand,
  fill:           Colors.green,
  topic:          Colors.orange,
  order_sentence: Colors.blue,
  reference:      Colors.amber,
};

const TOTAL_SECS = 25 * 60;

export default function MockExamScreen() {
  const router = useRouter();
  const { completeActivity } = useStudy();
  const { saveWrongNote } = useWrongNote();

  const { notes } = useWrongNote();  // 오답노트 데이터

  const [questions, setQuestions] = useState<typeof QUESTIONS>(QUESTIONS);
  const [preparing, setPreparing] = useState(true);   // 문항 준비 중
  const [cur,       setCur]       = useState(0);
  const [answers,   setAnswers]   = useState<Record<number, number>>({});
  const [seconds,   setSeconds]   = useState(TOTAL_SECS);
  const [done,      setDone]      = useState(false);
  const [showQuit,  setShowQuit]  = useState(false);
  const [saving,    setSaving]    = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // ── 약점 분석 → 가중 배분 → 동적 문항 준비 ──
  useEffect(() => {
    prepareQuestions();
  }, []);

  async function prepareQuestions() {
    setPreparing(true);
    try {
      // 1. 오답 유형별 집계
      const errorCount: Record<MockQType, number> = {
        grammar: 0, fill: 0, topic: 0, order_sentence: 0, reference: 0,
      };
      for (const n of notes) {
        const t = n.type === 'grammar' ? 'grammar' : 'fill';
        // questionType으로 세분화
        if (n.questionType?.includes('어법') || n.questionType?.includes('문법')) errorCount.grammar++;
        else if (n.questionType?.includes('빈칸')) errorCount.fill++;
        else if (n.questionType?.includes('주제') || n.questionType?.includes('요지')) errorCount.topic++;
        else if (n.questionType?.includes('순서')) errorCount.order_sentence++;
        else if (n.questionType?.includes('지칭') || n.questionType?.includes('추론')) errorCount.reference++;
        else errorCount[t]++;
      }

      // 2. 총 오답 수 → 약점 유형 파악
      const totalErrors = Object.values(errorCount).reduce((a, b) => a + b, 0);

      // 오답이 없으면 고정 문항 사용
      if (totalErrors === 0) { setPreparing(false); return; }

      // 3. 약점 유형별 추가 문항 수 계산 (총 +5문항, 고정 25 유지)
      // 기본 배분: grammar5 fill6 topic5 order4 reference5 = 25
      const BASE: Record<MockQType, number> = {
        grammar: 5, fill: 6, topic: 5, order_sentence: 4, reference: 5,
      };
      // 오답 비율 기준으로 약점 유형에 +1~3 추가, 다른 유형에서 -1씩 감소
      const sorted = (Object.entries(errorCount) as [MockQType, number][])
        .sort((a, b) => b[1] - a[1]);
      const weakTypes = sorted.filter(([, c]) => c > 0).map(([t]) => t).slice(0, 2);

      // 4. 약점 유형 추가 문항 Gemini 생성 (최대 6개, 병렬)
      const extraNeeded: { type: MockQType; id: number }[] = [];
      let nextId = questions.length + 1;
      for (const wt of weakTypes) {
        const extra = Math.min(3, Math.round((errorCount[wt] / totalErrors) * 6));
        for (let i = 0; i < extra; i++) {
          extraNeeded.push({ type: wt, id: nextId++ });
        }
      }

      if (extraNeeded.length === 0) { setPreparing(false); return; }

      // 5. 병렬 생성
      const generated = await Promise.all(
        extraNeeded.map(({ type, id }) => generateMockQuestion(type, id, '중3'))
      );
      const validGenerated = generated.filter(Boolean) as typeof QUESTIONS;

      if (validGenerated.length === 0) { setPreparing(false); return; }

      // 6. 약점 유형에서 고정 문항 일부 제거하고 생성 문항으로 교체 (총 25 유지)
      let base = [...QUESTIONS];
      for (const wt of weakTypes) {
        const removeCount = Math.min(
          validGenerated.filter(q => q.type === wt).length,
          base.filter(q => q.type === wt).length - 1  // 최소 1개는 유지
        );
        let removed = 0;
        base = base.filter(q => {
          if (q.type === wt && removed < removeCount) { removed++; return false; }
          return true;
        });
      }

      // 7. 생성 문항 삽입 후 셔플
      const merged = [...base, ...validGenerated];
      // 유형별로 정렬 유지하되 내부 순서 셔플
      const shuffled = merged
        .map(q => ({ q, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ q }, i) => ({ ...q, id: i + 1 }));

      // 25개로 자르기
      setQuestions(shuffled.slice(0, 25) as typeof QUESTIONS);
    } catch {
      // 생성 실패 시 고정 문항 사용
    } finally {
      setPreparing(false);
    }
  }

  // 타이머
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); submitExam(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const mm  = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss  = (seconds % 60).toString().padStart(2, '0');
  const isLow = seconds < 5 * 60;

  // 답 선택
  const selectAnswer = (choiceIdx: number) => {
    setAnswers(prev => ({ ...prev, [cur]: choiceIdx }));
  };

  // 문항 이동
  const goTo = (idx: number) => {
    if (idx >= 0 && idx < questions.length) setCur(idx);
  };

  // 제출
  const submitExam = useCallback(async (timeUp = false) => {
    clearInterval(timerRef.current);
    setSaving(true);

    let score = 0;
    const wrongIdxs: number[] = [];

    questions.forEach((q, i) => {
      const sel = answers[i];
      if (sel === q.correct) {
        score++;
      } else {
        wrongIdxs.push(i);
      }
    });

    // 오답 저장
    for (const i of wrongIdxs) {
      const q = questions[i];
      await saveWrongNote({
        question:       `[Q${q.id}] ${q.question}`,
        questionType:   TYPE_LABELS[q.type],
        myAnswer:       answers[i] !== undefined ? q.choices[answers[i]] : '미응답',
        correctAnswer:  q.choices[q.correct],
        passageSnippet: q.passage.slice(0, 100),
        explanation:    q.explain,
        type:           q.type === 'grammar' || q.type === 'order_sentence' ? 'grammar' : 'reading',
        contentId:      'mock-exam',
        unitId:         'mock',
      });
    }

    const xp = Math.round((score / questions.length) * 80) + 20;
    await completeActivity('mock_exam', xp);

    setSaving(false);
    setDone(true);
  }, [answers]);

  // ── 결과 화면 ──
  if (done) {
    const score     = questions.filter((q, i) => answers[i] === q.correct).length;
    const pct       = Math.round((score / questions.length) * 100);
    const grade     = pct >= 90 ? '1등급' : pct >= 80 ? '2등급' : pct >= 70 ? '3등급' : pct >= 60 ? '4등급' : '5등급';
    const gradeColor= pct >= 90 ? Colors.brand : pct >= 70 ? Colors.green : pct >= 50 ? Colors.amber : Colors.red;

    // 영역별 분석
    const typeStats = Object.entries(TYPE_LABELS).map(([type, label]) => {
      const qs     = questions.filter(q => q.type === type);
      const correct= qs.filter((q, _) => answers[questions.indexOf(q)] === q.correct).length;
      return { type, label, total: qs.length, correct, pct: Math.round((correct / qs.length) * 100) };
    });

    return (
      <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 결과 헤더 */}
        <View style={[s.resultHeader, { backgroundColor: gradeColor }]}>
          <Text style={[Typography.label2, { color: 'rgba(255,255,255,.7)', marginBottom: 4 }]}>
            중간고사 모의 · 25문항
          </Text>
          <Text style={[Typography.h1, { color: '#fff', marginBottom: 4 }]}>
            {score}점 / 25점
          </Text>
          <View style={s.gradeBadge}>
            <Text style={[Typography.bold2, { color: gradeColor }]}>{grade}</Text>
          </View>
          <View style={s.resultStats}>
            <View style={s.rStatCell}>
              <Text style={[Typography.statSm, { color: '#fff' }]}>{pct}%</Text>
              <Text style={[Typography.label3, { color: 'rgba(255,255,255,.7)', marginTop:2 }]}>정답률</Text>
            </View>
            <View style={[s.rStatCell, { borderLeftWidth:0.5, borderLeftColor:'rgba(255,255,255,.25)' }]}>
              <Text style={[Typography.statSm, { color: '#fff' }]}>{questions.length - score}</Text>
              <Text style={[Typography.label3, { color: 'rgba(255,255,255,.7)', marginTop:2 }]}>오답 수</Text>
            </View>
            <View style={[s.rStatCell, { borderLeftWidth:0.5, borderLeftColor:'rgba(255,255,255,.25)' }]}>
              <Text style={[Typography.statSm, { color: '#fff' }]}>
                {Math.floor((TOTAL_SECS - seconds) / 60)}분
              </Text>
              <Text style={[Typography.label3, { color: 'rgba(255,255,255,.7)', marginTop:2 }]}>소요 시간</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 16 }}>
          {/* 영역별 분석 */}
          <Text style={[Typography.h4, { marginBottom: 12 }]}>영역별 분석</Text>
          <View style={s.card}>
            {typeStats.map((ts, i) => (
              <View key={i} style={[s.typeRow, i < typeStats.length - 1 && { marginBottom: 12 }]}>
                <View style={[s.typeDot, { backgroundColor: TYPE_COLOR[ts.type as QType] }]} />
                <Text style={[Typography.bold3, { color: Colors.ink, width: 72 }]}>{ts.label}</Text>
                <View style={s.miniBar}>
                  <View style={[s.miniBarFill, {
                    width: `${ts.pct}%` as any,
                    backgroundColor: ts.pct >= 80 ? Colors.green : ts.pct >= 60 ? Colors.amber : Colors.red,
                  }]} />
                </View>
                <Text style={[Typography.bold3, { width: 44, textAlign: 'right',
                  color: ts.pct >= 80 ? Colors.green : ts.pct >= 60 ? Colors.amber : Colors.red }]}>
                  {ts.correct}/{ts.total}
                </Text>
              </View>
            ))}
          </View>

          {/* 문항별 결과 */}
          <Text style={[Typography.h4, { marginBottom: 12 }]}>문항별 결과</Text>
          <View style={s.card}>
            <View style={s.answerGrid}>
              {questions.map((q, i) => {
                const sel = answers[i];
                const ok  = sel === q.correct;
                const unanswered = sel === undefined;
                return (
                  <View key={i} style={[s.ansCell, {
                    backgroundColor: unanswered ? Colors.bg : ok ? Colors.greenBg : Colors.redBg,
                    borderColor: unanswered ? Colors.line : ok ? '#86efac' : '#fca5a5',
                  }]}>
                    <Text style={[Typography.label3, {
                      color: unanswered ? Colors.ink3 : ok ? Colors.greenDk : Colors.red,
                      fontWeight: '700',
                    }]}>
                      {unanswered ? '-' : ok ? 'V' : 'X'}
                    </Text>
                    <Text style={[Typography.label3, {
                      color: unanswered ? Colors.ink3 : ok ? Colors.greenDk : Colors.red,
                    }]}>
                      {q.id}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 버튼 */}
          <Pressable style={s.btnPrimary} onPress={() => router.push('/(student)/wrong-notes/' as any)}>
            <Text style={[Typography.bold1, { color: '#fff' }]}>
              오답노트 확인하기 ({questions.length - score}개)
            </Text>
          </Pressable>
          <Pressable style={[s.btnSecondary, { marginTop: 10 }]}
            onPress={() => router.replace('/(student)/' as any)}>
            <Text style={[Typography.bold1, { color: Colors.ink2 }]}>홈으로</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── 문항 준비 중 로딩 ──
  if (preparing) {
    return (
      <View style={[s.wrap, { alignItems:'center', justifyContent:'center', gap:14 }]}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={[Typography.bold2, { color:Colors.ink }]}>시험 준비 중...</Text>
        <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', lineHeight:22 }]}>
          오답 기록을 분석해서{'\n'}맞춤형 문제를 구성하고 있어요
        </Text>
      </View>
    );
  }

  // ── 시험 화면 ──
  const q   = questions[cur];
  const sel = answers[cur];
  const answered = sel !== undefined;
  const allAnswered = Object.keys(answers).length;

  return (
    <View style={s.wrap}>
      {/* 상단 바 */}
      <View style={s.topBar}>
        <Pressable style={s.quitBtn} onPress={() => setShowQuit(true)}>
          <Text style={{fontSize:14}}>X</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[Typography.label2, { color: 'rgba(255,255,255,.6)' }]}>
            중간고사 모의 · 25문항
          </Text>
        </View>
        <View style={[s.timer, isLow && { backgroundColor: Colors.red }]}>
          <Text style={{fontSize:14}}>●</Text>
          <Text style={[Typography.bold2, { color: '#fff' }]}>{mm}:{ss}</Text>
        </View>
      </View>

      {/* 진행바 */}
      <View style={s.progressWrap}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom: 5 }}>
          <Text style={[Typography.label2, { color: Colors.ink3 }]}>
            {cur + 1} / {questions.length}
          </Text>
          <Text style={[Typography.label2, { color: Colors.ink3 }]}>
            응답 {allAnswered} / {questions.length}
          </Text>
        </View>
        <View style={s.progTrack}>
          <View style={[s.progFill, { width: `${((cur + 1) / questions.length) * 100}%` as any }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ padding: 16 }}>
          {/* 문항 번호 + 유형 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={[s.qNumBadge, { backgroundColor: TYPE_COLOR[q.type] }]}>
              <Text style={[Typography.bold2, { color: '#fff' }]}>Q{q.id}</Text>
            </View>
            <View style={[s.typeBadge, { backgroundColor: TYPE_COLOR[q.type] + '22' }]}>
              <Text style={[Typography.label2, { color: TYPE_COLOR[q.type] }]}>
                {TYPE_LABELS[q.type]}
              </Text>
            </View>
            {answered && (
              <View style={[s.typeBadge, { backgroundColor: Colors.greenBg, marginLeft: 'auto' as any }]}>
                <Text style={[Typography.label3, { color: Colors.greenDk }]}>응답 완료</Text>
              </View>
            )}
          </View>

          {/* 지문 */}
          {q.type === 'order_sentence' ? (
            <View style={s.passageCard}>
              <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 8, letterSpacing: .4 }]}>
                지문 (순서 배열)
              </Text>
              {q.passage.split('\n').map((line, i) => (
                <Text key={i} style={[Typography.body3, { color: Colors.ink, lineHeight: 22, marginBottom: 4 }]}>
                  {line}
                </Text>
              ))}
            </View>
          ) : (
            <View style={s.passageCard}>
              <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 8, letterSpacing: .4 }]}>
                지문
              </Text>
              <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 24 }]}>
                {q.passage}
              </Text>
            </View>
          )}

          {/* 질문 */}
          <View style={s.questionBox}>
            <Text style={[Typography.bold2, { color: Colors.ink, lineHeight: 24 }]}>
              {q.question}
            </Text>
          </View>

          {/* 선택지 */}
          <View style={{ gap: 9 }}>
            {q.choices.map((c, i) => (
              <Pressable
                key={i}
                onPress={() => selectAnswer(i)}
                style={[s.choice, sel === i && s.choiceSel]}
              >
                <View style={[s.choiceNum, sel === i && { backgroundColor: Colors.brand }]}>
                  <Text style={[Typography.label2, {
                    color: sel === i ? '#fff' : Colors.ink3,
                  }]}>
                    {['①','②','③','④'][i]}
                  </Text>
                </View>
                <Text style={[Typography.body3, { flex: 1, color: Colors.ink, lineHeight: 20 }]}>
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 하단 내비게이션 */}
      <View style={s.bottomNav}>
        <Pressable
          style={[s.navBtn, cur === 0 && { opacity: 0.3 }]}
          onPress={() => goTo(cur - 1)}
          disabled={cur === 0}
        >
          <Text style={{fontSize:14}}>●</Text>
          <Text style={[Typography.bold3, { color: Colors.ink }]}>이전</Text>
        </Pressable>

        {/* 문항 번호 점프 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
          {questions.map((_, i) => {
            const isAnswered = answers[i] !== undefined;
            const isCur = i === cur;
            return (
              <Pressable key={i} onPress={() => setCur(i)}
                style={[s.dotBtn,
                  isCur     && { backgroundColor: Colors.brand, borderColor: Colors.brand },
                  isAnswered && !isCur && { backgroundColor: Colors.greenBg, borderColor: '#86efac' },
                ]}>
                <Text style={[Typography.label3, {
                  color: isCur ? '#fff' : isAnswered ? Colors.greenDk : Colors.ink3,
                  fontWeight: '700',
                }]}>{i + 1}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {cur < questions.length - 1 ? (
          <Pressable style={[s.navBtn, s.navBtnNext]} onPress={() => goTo(cur + 1)}>
            <Text style={[Typography.bold3, { color: '#fff' }]}>다음</Text>
            <Text style={{fontSize:14}}>→</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.navBtn, s.navBtnNext, { backgroundColor: Colors.green }]}
            onPress={() => submitExam(false)}
            disabled={saving}
          >
            <Text style={[Typography.bold3, { color: '#fff' }]}>
              {saving ? '저장 중...' : '제출'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* 종료 확인 모달 */}
      <Modal visible={showQuit} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={[Typography.h4, { marginBottom: 8 }]}>시험을 종료할까요?</Text>
            <Text style={[Typography.body3, { color: Colors.ink3, marginBottom: 20, lineHeight: 20 }]}>
              응답하지 않은 문항은 오답 처리됩니다.{'\n'}
              현재 응답: {allAnswered} / {questions.length}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.modalBtn, { backgroundColor: Colors.bg }]}
                onPress={() => setShowQuit(false)}>
                <Text style={[Typography.bold2, { color: Colors.ink2 }]}>계속 풀기</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, { backgroundColor: Colors.red }]}
                onPress={() => { setShowQuit(false); submitExam(false); }}>
                <Text style={[Typography.bold2, { color: '#fff' }]}>제출하기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: Colors.bg },
  // 상단 바 (어두운 배경)
  topBar:       { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: Colors.ink },
  quitBtn:      { width: 32, height: 32, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)', alignItems: 'center', justifyContent: 'center' },
  timer:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6 },
  // 진행바
  progressWrap: { backgroundColor: Colors.white, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.line },
  progTrack:    { height: 5, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  progFill:     { height: '100%', backgroundColor: Colors.brand, borderRadius: 99 },
  // 지문/문제
  passageCard:  { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 15, marginBottom: 12 },
  questionBox:  { backgroundColor: Colors.brandBg, borderRadius: 13, borderWidth: 1, borderColor: '#DDD9FF', padding: 14, marginBottom: 14 },
  qNumBadge:    { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  typeBadge:    { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  // 선택지
  choice:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white, padding: 13 },
  choiceSel:    { borderColor: Colors.brand, backgroundColor: Colors.brandBg },
  choiceNum:    { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // 하단 네비
  bottomNav:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 28, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.line },
  navBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white },
  navBtnNext:   { backgroundColor: Colors.brand, borderColor: Colors.brand },
  dotBtn:       { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  // 결과 화면
  resultHeader: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  gradeBadge:   { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
  resultStats:  { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,.25)', paddingTop: 14 },
  rStatCell:    { flex: 1, alignItems: 'center' },
  card:         { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.line, padding: 14, marginBottom: 14 },
  typeRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeDot:      { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  miniBar:      { flex: 1, height: 5, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  miniBarFill:  { height: '100%', borderRadius: 99 },
  answerGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  ansCell:      { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  btnPrimary:   { borderRadius: 14, backgroundColor: Colors.brand, paddingVertical: 16, alignItems: 'center' },
  btnSecondary: { borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white, paddingVertical: 14, alignItems: 'center' },
  // 모달
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:    { width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 22 },
  modalBtn:     { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
});
