// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { GoogleGenerativeAI } from '@google/generative-ai';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY!);
const GEMINI_MODEL = 'gemini-2.5-flash';
const CONTENT_QUIZ_CACHE_VERSION = 'v2';

// ── 타입 정의 ─────────────────────────────────────────────

export interface TFQuestion {
  kind:    'tf';
  id:      number;
  statement: string;   // 맞으면 True, 틀리면 False
  correct: boolean;
  explain: string;
}

export interface MCQuestion {
  kind:    'mc';
  id:      number;
  question: string;
  choices:  string[];
  correct:  number;    // 0-based
  explain:  string;
}

export interface FillQuestion {
  kind:    'fill';
  id:      number;
  sentence: string;    // 빈칸은 ___ 로 표시
  choices:  string[];
  correct:  number;
  explain:  string;
}

export interface TypingQuestion {
  kind:    'typing';
  id:      number;
  hint:    string;     // 한글 힌트
  answer:  string;     // 영어 정답
  explain: string;
}

export type AnyQuestion = TFQuestion | MCQuestion | FillQuestion | TypingQuestion;

/**
 * 단위(대화 그룹 or 단락) 한 개에 대한 문제 묶음
 */
export interface UnitQuiz {
  unitIndex:  number;    // 0-based (0 = 첫 번째 대화 그룹/단락)
  unitText:   string;    // 원본 텍스트
  unitLabel:  string;    // 표시용 (예: "대화문 1", "단락 2")
  questions:  AnyQuestion[];
}

/**
 * 전체 콘텐츠 퀴즈 — 단계별
 */
export interface ContentQuiz {
  stepIndex:  number;
  stepLabel:  string;
  units:      UnitQuiz[];
}

// ── 텍스트 파서 ──────────────────────────────────────────

/**
 * 대화문 텍스트를 빈 줄 기준으로 그룹 분리
 *
 * 입력 예:
 *   Mina: Have you been to the library?
 *   Jake: Yes, I went there yesterday.
 *
 *   Mina: Did you find the book?
 *   Jake: No, it was checked out.
 *
 * 출력: ["Mina: ...\nJake: ...", "Mina: ...\nJake: ..."]
 */
function isSpeakerLine(line: string) {
  return /^[A-Za-z][A-Za-z0-9]{0,20}\s*:\s*.+/.test(line.trim());
}

function sanitizeDialogSource(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const cleaned: string[] = [];
  let inGrammarSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (cleaned[cleaned.length - 1] !== '') cleaned.push('');
      continue;
    }

    if (/^문법\b/.test(line)) {
      inGrammarSection = true;
      continue;
    }

    if (/^대화문\s*\d+/u.test(line)) {
      inGrammarSection = false;
      if (cleaned.length && cleaned[cleaned.length - 1] !== '') cleaned.push('');
      continue;
    }

    if (inGrammarSection) continue;
    if (!isSpeakerLine(line)) continue;

    cleaned.push(line);
  }

  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function splitDialogGroups(text: string): string[] {
  return sanitizeDialogSource(text)
    .split(/\n\s*\n/)
    .map(group => group
      .split('\n')
      .map(line => line.trim())
      .filter(isSpeakerLine)
      .join('\n')
      .trim()
    )
    .filter(group => group.length > 0);
}

/**
 * 본문 텍스트를 단락으로 분리
 * - 빈 줄 기준 우선
 * - 빈 줄 없으면 마침표 기준으로 3등분
 */
export function splitReadingParagraphs(text: string): string[] {
  const byBlankLine = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 20);

  if (byBlankLine.length >= 2) return byBlankLine;

  // 빈 줄 없는 경우: 문장 단위로 3등분
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const third = Math.ceil(sentences.length / 3);
  return [
    sentences.slice(0, third).join(' '),
    sentences.slice(third, third * 2).join(' '),
    sentences.slice(third * 2).join(' '),
  ].filter(p => p.trim().length > 0);
}

// ── 단위 길이에 따른 문항 수 결정 ────────────────────────

function questionCount(unitText: string): { tf: number; mc: number } {
  const words = unitText.split(/\s+/).length;
  if (words >= 60) return { tf: 3, mc: 3 };
  if (words >= 30) return { tf: 2, mc: 2 };
  return { tf: 1, mc: 1 };
}

type DialogTurn = {
  speaker: string;
  text: string;
};

function parseDialogTurns(dialogText: string): DialogTurn[] {
  return dialogText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [speaker, ...rest] = line.split(':');
      return {
        speaker: speaker.trim(),
        text: rest.join(':').trim(),
      };
    })
    .filter(turn => turn.speaker && turn.text);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function getDialogFacts(dialogText: string) {
  const turns = parseDialogTurns(dialogText);
  const fullText = turns.map(turn => `${turn.speaker}: ${turn.text}`).join(' ');
  const speakers = unique(turns.map(turn => turn.speaker));
  const lower = fullText.toLowerCase();
  const seekerTurn = turns.find(turn => /(looking for|i'd like|i would like|i want)/i.test(turn.text));
  const customer = seekerTurn?.speaker ?? turns[0]?.speaker ?? 'A';
  const helperTurn = turns.find(turn =>
    turn.speaker !== customer && /(can i help you|how about|we have|we can)/i.test(turn.text)
  );
  const helper = helperTurn?.speaker ?? speakers.find(speaker => speaker !== customer) ?? 'B';
  const firstQuestion = turns.find(turn => turn.text.includes('?'))?.text ?? turns[0]?.text ?? '';
  const itemWantedMatch = fullText.match(/looking for (?:a|an|the|some)\s+([^?.!]+)/i);
  const itemWanted = itemWantedMatch?.[1]?.trim() ?? '';
  const suggestionMatches = Array.from(fullText.matchAll(/How about\s+(.+?)[?.!]/gi)).map(match => match[1].trim());
  const suggestions = unique(suggestionMatches);
  const firstSuggestion = suggestions[0] ?? '';
  const priceMatch = fullText.match(/(\d[\d,]*)\s*won/i);
  const price = priceMatch?.[1] ?? '';
  const asksForAnother = /something else/i.test(fullText);
  const accepted = /(I'll take|I'll get|That will do|That looks good|I love it|Perfect)/i.test(fullText);
  const quantityMatch = fullText.match(/\b(one|two|three|four)\b/i);
  const quantity = quantityMatch?.[1]?.toLowerCase() ?? '';
  const finalTurn = [...turns].reverse().find(turn => /(take|get|perfect|good)/i.test(turn.text))?.text ?? turns[turns.length - 1]?.text ?? '';
  const shopClues = /(won|souvenir|gift|sale|discount|looking for|How about)/i.test(fullText);

  return {
    turns,
    fullText,
    lower,
    speakers,
    customer,
    helper,
    firstQuestion,
    itemWanted,
    suggestions,
    firstSuggestion,
    price,
    asksForAnother,
    accepted,
    quantity,
    finalTurn,
    shopClues,
  };
}

function formatDialogItem(item: string) {
  return item.replace(/\b(this|that|these|those)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function buildDialogQuestions(
  dialogIndex: number,
  stepIndex: number,
  dialogText: string,
): AnyQuestion[] {
  const idx = dialogIndex + 1;
  const facts = getDialogFacts(dialogText);
  const itemWanted = formatDialogItem(facts.itemWanted || 'an item');
  const suggestion = formatDialogItem(facts.firstSuggestion || 'another item');
  const price = facts.price || '5,000';
  const customer = facts.customer;
  const helper = facts.helper;
  const acceptedText = facts.accepted ? '구매하기로 했다' : '아직 결정하지 않았다';
  const fallbackItemChoices = unique([itemWanted, suggestion, 'a school bag', 'a book']).filter(Boolean);

  const typoChoices = (answer: string, extras: string[]) =>
    unique([answer, ...extras]).slice(0, 4);

  const higherPrice = price.includes(',')
    ? String(Number(price.replace(/,/g, '')) + 1000).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : `${price}0`;

  const lookingLine = facts.turns.find(turn => /looking for/i.test(turn.text))?.text ?? '';
  const suggestionLine = facts.turns.find(turn => /How about/i.test(turn.text))?.text ?? '';
  const anotherLine = facts.turns.find(turn => /something else/i.test(turn.text))?.text ?? '';
  const takeLine = facts.turns.find(turn => /(I'll take|I'll get)/i.test(turn.text))?.text ?? facts.finalTurn;

  const stepQuestions: Record<number, AnyQuestion[]> = {
    0: [
      {
        kind: 'tf',
        id: 1,
        statement: `대화문 ${idx}에서 ${customer}는 ${itemWanted}을(를) 찾고 있다.`,
        correct: !!facts.itemWanted,
        explain: facts.itemWanted
          ? `${customer}가 "${lookingLine}"이라고 말해 ${itemWanted}을(를) 찾고 있음을 알 수 있습니다.`
          : '지문에서 찾는 물건이 명확히 드러나지 않습니다.',
      },
      {
        kind: 'tf',
        id: 2,
        statement: facts.price
          ? `이 대화에서 제시된 가격은 ${higherPrice}원이다.`
          : `대화문 ${idx}에서 ${customer}는 아직 가격을 듣지 못했다.`,
        correct: false,
        explain: facts.price
          ? `지문에는 "${price} won"이라고 제시되어 있어 ${higherPrice}원이 아닙니다.`
          : '지문에 가격이나 구매 정보가 직접 나타납니다.',
      },
      {
        kind: 'mc',
        id: 3,
        question: `대화문 ${idx}에서 두 사람이 주로 하고 있는 일은 무엇인가?`,
        choices: ['물건을 추천하고 고르고 있다', '학교 숙제를 검사하고 있다', '운동 계획을 세우고 있다', '날씨를 비교하고 있다'],
        correct: 0,
        explain: facts.shopClues
          ? `"${lookingLine || suggestionLine}"와 같은 표현으로 보아 가게에서 물건을 추천하고 고르는 상황입니다.`
          : '대화 흐름상 특정 물건을 두고 선택하는 상황입니다.',
      },
      {
        kind: 'mc',
        id: 4,
        question: `${customer}가 찾는 물건으로 가장 알맞은 것은?`,
        choices: typoChoices(itemWanted || 'an item', fallbackItemChoices.length >= 4 ? fallbackItemChoices.slice(1) : ['a hat', 'a fan', 'cookies']).slice(0, 4),
        correct: 0,
        explain: facts.itemWanted
          ? `${customer}는 "${lookingLine}"이라고 말하며 ${itemWanted}을(를) 찾고 있습니다.`
          : '지문에서 찾는 물건이 직접적으로 드러나지 않아 일반화된 보기로 구성했습니다.',
      },
      {
        kind: 'mc',
        id: 5,
        question: `${helper}가 먼저 추천한 물건은 무엇인가?`,
        choices: typoChoices(suggestion || 'another item', [itemWanted || 'a gift', 'a notebook', 'a snack']).slice(0, 4),
        correct: 0,
        explain: facts.firstSuggestion
          ? `${helper}는 "${suggestionLine}"이라고 말하며 ${suggestion}을(를) 추천합니다.`
          : '지문에서 첫 추천 물건을 기준으로 문제를 만들었습니다.',
      },
    ],
    1: [
      {
        kind: 'mc',
        id: 1,
        question: `${customer}의 태도로 가장 알맞은 것은?`,
        choices: facts.asksForAnother
          ? ['물건을 신중하게 고르고 있다', '화가 나서 대화를 끝내려 한다', '아무 관심 없이 듣고 있다', '가격을 이미 알고 있다']
          : ['추천을 긍정적으로 받아들이고 있다', '대화를 피하고 있다', '전혀 이해하지 못하고 있다', '물건을 반품하려고 한다'],
        correct: 0,
        explain: facts.asksForAnother
          ? `"${anotherLine}"이라고 말해 더 잘 맞는 물건을 신중하게 고르고 있습니다.`
          : `${customer}의 반응과 마지막 선택에서 추천을 긍정적으로 받아들이고 있음을 알 수 있습니다.`,
      },
      {
        kind: 'mc',
        id: 2,
        question: `${helper}가 이 대화에서 하고 있는 역할로 가장 적절한 것은?`,
        choices: ['손님에게 물건을 추천하는 역할', '숙제를 검사하는 역할', '여행 계획을 세우는 역할', '길을 안내하는 역할'],
        correct: 0,
        explain: `"${suggestionLine || facts.firstQuestion}"를 통해 ${helper}가 물건을 추천하고 있음을 알 수 있습니다.`,
      },
      {
        kind: 'mc',
        id: 3,
        question: `이 대화의 분위기로 가장 알맞은 것은?`,
        choices: ['친절하고 실용적인 분위기', '긴장되고 차가운 분위기', '슬프고 우울한 분위기', '논쟁이 심한 분위기'],
        correct: 0,
        explain: '손님이 물건을 고르고 점원이 추천하는 자연스럽고 친절한 대화입니다.',
      },
    ],
    2: [
      {
        kind: 'fill',
        id: 1,
        sentence: `I'm looking for ${facts.itemWanted ? '___' : 'something'}.`,
        choices: typoChoices(itemWanted || 'a souvenir', [suggestion || 'a hat', 'a discount', 'a classroom']),
        correct: 0,
        explain: facts.itemWanted
          ? `${customer}의 말 "${lookingLine}"에 나온 핵심 표현입니다.`
          : '지문 속 찾는 물건 표현을 바탕으로 만든 문제입니다.',
      },
      {
        kind: 'fill',
        id: 2,
        sentence: suggestionLine
          ? suggestionLine.replace(/How about\s+(.+?)([?.!])/, 'How about ___$2')
          : 'How about ___?',
        choices: typoChoices(suggestion || 'this item', [itemWanted || 'a gift', 'your homework', 'the weather']),
        correct: 0,
        explain: suggestionLine
          ? `${helper}의 추천 문장 "${suggestionLine}"을 그대로 활용한 빈칸 문제입니다.`
          : '점원의 추천 표현을 묻는 문제입니다.',
      },
      {
        kind: 'mc',
        id: 3,
        question: `밑줄에 들어갈 표현으로 가장 알맞은 것은? "${takeLine ? takeLine.replace(/(take|get).*/i, '___') : `I'll ___ it.`}"`,
        choices: ['take', 'takes', 'taking', 'took'],
        correct: 0,
        explain: `구매를 결정할 때는 "I'll take it." 또는 "I'll get it."처럼 동사원형을 사용합니다.`,
      },
    ],
    3: [
      {
        kind: 'typing',
        id: 1,
        hint: `"~을 찾고 있어요"에 해당하는 핵심 표현 2단어`,
        answer: 'looking for',
        explain: `"I'm looking for ~"는 가게에서 원하는 물건을 말할 때 쓰는 핵심 표현입니다.`,
      },
      {
        kind: 'typing',
        id: 2,
        hint: `"이건 어때요?"에 해당하는 제안 표현 2단어`,
        answer: 'How about',
        explain: `"How about ~?"는 물건을 추천하거나 제안할 때 자주 쓰는 표현입니다.`,
      },
      {
        kind: 'typing',
        id: 3,
        hint: `"그걸로 할게요"에 해당하는 구매 표현 3단어`,
        answer: /I'll get/i.test(takeLine) ? "I'll get it" : "I'll take it",
        explain: `${takeLine || `"I'll take it."`}에서 구매 의사를 나타내는 핵심 표현을 그대로 쓰면 됩니다.`,
      },
    ],
    4: [
      {
        kind: 'mc',
        id: 1,
        question: `이 대화 다음에 이어질 내용으로 가장 자연스러운 것은?`,
        choices: facts.accepted
          ? ['손님이 계산을 진행한다', '손님이 다시 처음부터 자기소개를 한다', '두 사람이 운동을 시작한다', '점원이 숙제를 내준다']
          : ['손님이 다른 물건을 더 살펴본다', '손님이 바로 집에 간다', '두 사람이 식당으로 이동한다', '점원이 전화를 건다'],
        correct: 0,
        explain: facts.accepted
          ? `마지막에 ${acceptedText}고 말했으므로 자연스럽게 계산 단계로 이어집니다.`
          : '아직 결정하지 않았다면 다른 물건을 더 살펴보는 흐름이 자연스럽습니다.',
      },
      {
        kind: 'mc',
        id: 2,
        question: `이 대화가 이루어지는 장소로 가장 알맞은 것은?`,
        choices: ['기념품 가게나 상점', '도서관', '운동장', '교무실'],
        correct: 0,
        explain: `"${lookingLine || suggestionLine}"와 가격 표현, 추천 표현으로 보아 가게나 상점 상황입니다.`,
      },
      {
        kind: 'mc',
        id: 3,
        question: `${customer}가 "something else"를 요청했다면 그 이유로 가장 알맞은 것은?`,
        choices: ['처음 추천받은 물건이 마음에 완전히 들지 않았기 때문', '가격을 이미 지불했기 때문', '가게 문이 닫혔기 때문', '숙제를 하러 가야 했기 때문'],
        correct: 0,
        explain: `"${anotherLine || 'Can you show me something else?'}"는 처음 추천받은 물건 대신 다른 선택지를 보고 싶다는 뜻입니다.`,
      },
    ],
    5: [
      {
        kind: 'mc',
        id: 1,
        question: `대화문 ${idx}의 주제로 가장 알맞은 것은?`,
        choices: ['손님이 원하는 물건을 찾고 구매하는 과정', '학교 시험 준비 방법', '여행 일정 정리', '운동 경기 결과'],
        correct: 0,
        explain: '이 대화는 손님이 원하는 물건을 찾고 추천을 받은 뒤 선택하는 흐름으로 전개됩니다.',
      },
      {
        kind: 'fill',
        id: 2,
        sentence: `The customer is looking for ___ and talks with the clerk.`,
        choices: typoChoices(itemWanted || 'an item', [suggestion || 'a club', 'homework', 'a bus']),
        correct: 0,
        explain: `${customer}가 찾는 물건을 영어로 요약하는 문제입니다.`,
      },
      {
        kind: 'typing',
        id: 3,
        hint: `지문 속 최종 선택 표현을 그대로 쓰기 (${facts.quantity ? '수량 포함 가능' : '3~5단어'})`,
        answer: /I'll get/i.test(takeLine)
          ? takeLine.match(/I'll get[^.?!]*/i)?.[0]?.trim() ?? "I'll get it"
          : takeLine.match(/I'll take[^.?!]*/i)?.[0]?.trim() ?? "I'll take it",
        explain: `마지막 구매 결정 문장 "${takeLine || facts.finalTurn}"을 그대로 쓰면 됩니다.`,
      },
    ],
  };

  return stepQuestions[stepIndex] ?? stepQuestions[0];
}

// ── Gemini 프롬프트 ───────────────────────────────────────

/**
 * 대화문 전체를 지문으로 활용 — 단계별 퀴즈 세트 생성
 *
 * 핵심 원칙 (LX팀):
 *   전체 대화문 = 하나의 지문
 *   단계별로 다른 유형의 문제를 내되, 항상 전체 지문 기반
 */
async function generateDialogSetQuiz(
  fullDialogText: string,   // 대화문 전체 원문
  dialogLabel:    string,   // 예: "대화문 1"
  dialogIndex:    number,
  stepIndex:      number,
  grade:          string,
  weakCtx:        string = '',
): Promise<AnyQuestion[]> {
  return buildDialogQuestions(dialogIndex, stepIndex, fullDialogText);
}

/**
 * 본문 전체 지문 기반 퀴즈 생성 — 전면 재설계
 *
 * 핵심 변경:
 *   단락별 쪼개기 → 본문 전체가 하나의 지문
 *   문항 수 2~6개 → Step당 15~23문항
 *   Step별 명확한 교육 목표 부여
 */
async function generateReadingUnitQuiz(
  unitText:  string,
  unitLabel: string,
  unitIndex: number,
  stepIndex: number,
  grade:     string,
  weakCtx:   string = '',
): Promise<AnyQuestion[]> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.3, maxOutputTokens: 3000, thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  // Step별 명확한 목표 + 문항 수 + 유형
  const READING_STEP_CONFIGS: Record<number, {
    title: string;
    instruction: string;
    kinds: string;
    count: number;
    focus: string;
  }> = {
    0: {
      title: '어휘 마스터',
      kinds: 'fill 8개 + typing 5개',
      count: 13,
      focus: '본문에 등장한 핵심 어휘/표현을 문맥 속에서 학습',
      instruction: `
빈칸 완성(fill) 8개: 본문 문장에서 핵심 어휘를 ___로 대체. 문맥상 알맞은 단어 선택.
타이핑(typing) 5개: 한국어 의미/설명을 보고 본문에 나온 영어 어휘를 직접 입력.
어휘 난이도: 중학교 교과서 수준이지만 문맥 파악이 필요한 것.
각 어휘가 쓰인 본문 문장을 hint나 sentence에 반드시 포함할 것.`,
    },
    1: {
      title: '내용 완전 이해',
      kinds: 'T/F 10개 + MC 10개',
      count: 20,
      focus: '본문 전체 세부내용·인과관계·지시어 완전 파악',
      instruction: `
T/F 10개 (True 5개, False 5개 균형):
  - 본문 내용과 일치/불일치 서술문
  - 단순 사실 확인부터 약간의 추론까지 다양하게
  - False: 본문 어느 부분이 틀렸는지 해설에 근거 문장 인용

MC 10개 (세부 내용 파악):
  - 세부 정보 (who/what/when/where/why/how) (4개)
  - 인과관계 (because/as a result/therefore) (2개)
  - 지시어 참조 (it/they/this/that가 가리키는 것) (2개)
  - 본문에서 언급된 것 / 언급되지 않은 것 (1개)
  - 문장 삽입 위치 (1개)

⚠️ 단어 뜻 문제 절대 금지
해설: 반드시 본문 근거 문장 직접 인용`,
    },
    2: {
      title: '어법 실전',
      kinds: 'MC 15개 + fill 8개',
      count: 23,
      focus: '내신 기출 어법 5유형 집중 훈련',
      instruction: `
MC 15개 — 반드시 5가지 유형 혼합:
  유형1. 어법상 옳은 것 (3개)
  유형2. 어법상 틀린 것 (3개)
  유형3. 빈칸에 알맞은 어법 형태 (3개)
  유형4. (A)(B) 두 빈칸 모두 알맞은 것 (3개)
  유형5. 밑줄 중 어법 오류 찾기 (3개)
  본문 실제 문장 변형 활용 필수

fill 8개:
  - 본문 어법 핵심 부분 빈칸 처리
  - 동사형태·전치사·접속사·관계사 중심

⚠️ 단어 뜻 금지
해설: ① 정답 근거 ② 어법 규칙 ③ 오답 이유`,
    },
    3: {
      title: '추론 & 요약',
      kinds: 'MC 12개 + fill 5개',
      count: 17,
      focus: '주제·요지·제목·빈칸추론·순서·요약문 완성',
      instruction: `
MC 12개 — 수능/내신 독해 핵심 유형:
  - 글의 주제 (1개)
  - 글의 요지/주장 (1개)
  - 글의 제목 (1개)
  - 빈칸 추론 — 어구/문장 (3개)
  - 글의 순서 배열 (2개)
  - 문장 삽입 위치 (1개)
  - 언급되지 않은 것 (1개)
  - 필자의 주장/의도 (1개)
  - 글의 분위기/어조 (1개)

fill 5개:
  - 요약문 빈칸 채우기
  - "This passage is mainly about ___ and ___." 형식

⚠️ 단어 뜻 금지. 글의 논리·흐름 기반 추론에 집중`,
    },
    4: {
      title: '핵심 표현 쓰기',
      kinds: 'typing 12개',
      count: 12,
      focus: '본문 핵심 구문·표현 직접 영어로 쓰기',
      instruction: `
typing 12개:
  - 본문의 핵심 구문·표현·문법 구조를 직접 영어로 입력
  - 단어 1개가 아닌 구절/표현/문장 단위 (어휘 단독 금지)
  - 예시 유형:
    hint: "~에 의해 이끌려 (수동 분사구문)", answer: "driven by"
    hint: "너무 광대해서 탐험할 수 없다 (so~that)", answer: "so vast that"
    hint: "별 패턴을 이용해 시간을 추적하다", answer: "used patterns of stars to track time"
  - hint: 한국어 설명 + 문법 구조 힌트 + 글자 수
  - explain: 본문에서 해당 표현이 쓰인 문장 전체 + 구문 설명

⚠️ 단어 낱개 뜻/철자 금지. 구문·표현 단위로만 출제`,
    },
    5: {
      title: '종합 서술형',
      kinds: 'fill 10개 + MC 5개 + typing 5개',
      count: 20,
      focus: '문장 완성 + 순서 배열 + 핵심 문장 서술형 완성',
      instruction: `
fill 10개:
  - 본문 핵심 구문 빈칸 완성
  - 어법·구조·표현 중심 (단어 뜻 금지)
  - 접속사·관계사·분사·비교구문·사역동사 등

MC 5개 (순서 배열 집중):
  - 문단 순서: (A)-(B)-(C) 또는 (A)-(B)-(C)-(D)
  - 문단 간 연결 관계 (역접/인과/예시/추가) 파악 필요
  - 주어진 문장이 들어갈 위치 포함

typing 5개:
  - 본문에서 가장 중요한 문장/구문 직접 완성
  - hint: 한국어 의미 + 어법 구조 힌트
  - explain: 본문 원문 + 구문 분석

⚠️ 단어 낱개 뜻 금지. 구문·표현·어법 서술에 집중`,
    },
  };

  const cfg = READING_STEP_CONFIGS[stepIndex] ?? READING_STEP_CONFIGS[0];

  const prompt = `
당신은 한국 ${grade} 내신 영어 전문 출제 교사입니다.
아래 본문을 읽고 [${cfg.title}] 단계 퀴즈를 만드세요.

[본문 — ${unitLabel}]:
${unitText}

[출제 방향]: ${cfg.focus}

[출제 유형 및 수량]: ${cfg.kinds} (총 ${cfg.count}문항)

[세부 지침]:
${cfg.instruction}

[절대 규칙]:
- 본문에 없는 내용을 출제하지 마세요
- 해설은 반드시 한국어로, 본문 근거 문장을 포함하세요
- fill의 choices는 반드시 4개
- typing의 hint는 한국어로 명확하게
- 난이도: 쉬움 30% / 중간 50% / 어려움 20% 배분

다음 JSON 배열만 응답 (다른 텍스트 절대 없이):
[
  { "kind": "tf",     "id": 1, "statement": "영어 또는 한국어 서술문", "correct": true, "explain": "해설 + 본문 근거" },
  { "kind": "mc",     "id": 2, "question": "질문 한국어", "choices": ["A","B","C","D"], "correct": 0, "explain": "해설" },
  { "kind": "fill",   "id": 3, "sentence": "본문 문장에서 ___ 빈칸 처리", "choices": ["A","B","C","D"], "correct": 0, "explain": "해설" },
  { "kind": "typing", "id": 4, "hint": "한국어 힌트 (X글자)", "answer": "영어 정답", "explain": "해설 + 본문 예문" }
]
`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(raw) as AnyQuestion[];
  } catch {
    return getDemoReadingQuestions(unitIndex, stepIndex);
  }
}

// ── 메인 함수 ─────────────────────────────────────────────

/**
 * 전체 텍스트에서 단계별 퀴즈 생성
 * - 대화문: 빈 줄 기준 그룹별
 * - 본문: 단락별
 */
export async function generateContentQuiz(
  text:        string,
  contentType: 'dialog' | 'reading',
  stepIndex:   number,
  grade:       string = '중3',
  contentId?:  string,   // Firestore 캐시 키 (없으면 캐싱 생략)
): Promise<ContentQuiz> {

  // ── 캐시 키 생성 ──
  const cacheKey = contentId
    ? `${CONTENT_QUIZ_CACHE_VERSION}_${contentId}_step${stepIndex}`
    : null;

  // ── Firestore 캐시 조회 ──
  if (cacheKey) {
    try {
      const cacheRef = doc(db, 'quizCache', cacheKey);
      const snap = await getDoc(cacheRef);
      if (snap.exists()) {
        return snap.data() as ContentQuiz;
      }
    } catch {
      // 캐시 조회 실패 시 Gemini로 진행
    }
  }

  // ── 대화문: 각 대화문 전체를 지문으로 활용 ──────────────
  // ── 본문: 단락별 분리 (기존 방식 유지) ──────────────────
  let unitQuizzes: UnitQuiz[];

  if (contentType === 'dialog') {
    // 빈 줄 기준으로 대화문 분리 — 각 대화문이 하나의 독립 지문
    const dialogs = splitDialogGroups(text);
    unitQuizzes = await Promise.all(
      dialogs.map(async (dialogText, i) => {
        const dialogLabel = `대화문 ${i + 1}`;
        const questions = await generateDialogSetQuiz(
          dialogText, dialogLabel, i, stepIndex, grade,
        );
        return {
          unitIndex: i,
          unitText:  dialogText,
          unitLabel: dialogLabel,
          questions,
        };
      })
    );
  } else {
    // 본문: 단락별 분리
    const paragraphs = splitReadingParagraphs(text);
    unitQuizzes = await Promise.all(
      paragraphs.map(async (paraText, i) => {
        const paraLabel = `단락 ${i + 1}`;
        const questions = await generateReadingUnitQuiz(
          paraText, paraLabel, i, stepIndex, grade,
        );
        return {
          unitIndex: i,
          unitText:  paraText,
          unitLabel: paraLabel,
          questions,
        };
      })
    );
  }

  const stepLabels: Record<number, string> = {
    0: 'Step 1 · 내용 이해 (T/F + 객관식)',
    1: 'Step 2 · 감정/의도/중심 내용',
    2: 'Step 3 · 빈칸 완성',
    3: 'Step 4 · 핵심 표현 타이핑',
    4: 'Step 5 · 추론 및 심화',
    5: 'Step 6 · 종합 평가',
  };

  const result: ContentQuiz = {
    stepIndex,
    stepLabel: stepLabels[stepIndex] ?? `Step ${stepIndex + 1}`,
    units: unitQuizzes,
  };

  // ── Firestore에 캐시 저장 (비동기, 실패해도 무시) ──
  if (cacheKey) {
    try {
      const cacheRef = doc(db, 'quizCache', cacheKey);
      await setDoc(cacheRef, result);
    } catch {
      // 캐시 저장 실패는 무시 — 학습에 영향 없음
    }
  }

  return result;
}

// ── 데모 데이터 (오프라인 fallback) ──────────────────────

/**
 * 대화문 전체 지문 기반 데모 퀴즈 (API 실패 시 fallback)
 */
/**
 * 본문 학습 fallback 데모 퀴즈 — Step당 충분한 문항
 */
function getDemoReadingQuestions(
  unitIndex: number,
  stepIndex: number,
): AnyQuestion[] {
  const demoByStep: Record<number, AnyQuestion[]> = {
    // Step 1(0): 문장 구조 파악 — 어법MC 10 + fill 8 = 18문항 (단어 뜻 없음)
    0: [
      { kind:'mc', id:1, question:'어법상 옳은 것은?', choices:['People has observed the sky.','People have observed the sky.','People have observing the sky.','People have been observe the sky.'], correct:1, explain:'현재완료: have/has + 과거분사. People(복수) → have observed.' },
      { kind:'fill', id:2, sentence:'Long before modern telescopes were invented, ___ astronomers used patterns of stars.', choices:['ancient','modern','future','young'], correct:0, explain:'ancient = 고대의. 먼 과거를 나타내는 형용사.' },
      { kind:'fill', id:3, sentence:'The universe is so ___ that even the fastest spacecraft would take thousands of years.', choices:['vast','small','simple','quiet'], correct:0, explain:'vast = 광대한. 우주의 크기를 나타내는 핵심 어휘.' },
      { kind:'fill', id:4, sentence:'Humans continue to explore, driven by the same ___ that our ancestors felt.', choices:['curiosity','fear','boredom','anger'], correct:0, explain:'curiosity = 호기심. 탐험의 동기를 나타내는 명사.' },
      { kind:'fill', id:5, sentence:'Satellites and powerful telescopes let us see galaxies that are billions of light-years ___.', choices:['away','near','close','here'], correct:0, explain:'light-years away = 광년 떨어진 곳. 거리를 나타내는 표현.' },
      { kind:'fill', id:6, sentence:'They used ___ of stars to track time and seasons.', choices:['patterns','colors','names','sizes'], correct:0, explain:'patterns = 패턴/무늬. 별자리 패턴을 활용한 내용.' },
      { kind:'fill', id:7, sentence:'The basic feeling of asking "what is out there?" has not ___.', choices:['changed','started','ended','improved'], correct:0, explain:'has not changed = 변하지 않았다. 현재완료 부정문.' },
      { kind:'fill', id:8, sentence:'Even the fastest ___ would take thousands of years to reach the nearest star.', choices:['spacecraft','telescope','satellite','astronomer'], correct:0, explain:'spacecraft = 우주선. 우주 탐사 관련 핵심 어휘.' },
      { kind:'typing', id:9, hint:'관찰하다 (동사, 7글자)', answer:'observe', explain:'observe = 관찰하다. "people have observed the night sky"에서 사용.' },
      { kind:'typing', id:10, hint:'고대의 (형용사, 6글자)', answer:'ancient', explain:'ancient = 고대의. "ancient astronomers"에서 사용.' },
      { kind:'typing', id:11, hint:'광대한, 드넓은 (형용사, 4글자)', answer:'vast', explain:'vast = 광대한. "The universe is so vast"에서 사용.' },
      { kind:'typing', id:12, hint:'호기심 (명사, 9글자)', answer:'curiosity', explain:'curiosity = 호기심. "the same curiosity"에서 사용.' },
      { kind:'typing', id:13, hint:'천문학자 (명사, 10글자)', answer:'astronomer', explain:'astronomer = 천문학자. 별을 연구하는 과학자.' },
    ],

    // Step 2: 문장 구조 분석 — mc 8 + fill 8 = 16문항
    1: [
      { kind:'mc', id:1, question:'어법상 옳은 것은?', choices:['People have observing the sky.','People has observed the sky.','People have observed the sky.','People have observe the sky.'], correct:2, explain:'현재완료: have/has + 과거분사(observed). 주어 People → have 사용.' },
      { kind:'mc', id:2, question:'어법상 틀린 것은?', choices:['Long before modern telescopes were invented','ancient astronomers used patterns','to track time and seasons','they using stars for navigation'], correct:3, explain:'they using → they used. 과거 시제에서 -ing형 단독 사용 불가.' },
      { kind:'mc', id:3, question:'빈칸에 알맞은 것은? "The universe is so vast ___ even the fastest spacecraft would take thousands of years."', choices:['so','that','and','but'], correct:1, explain:'so ~ that 구문: 너무 ~해서 ...하다. so vast that이 올바른 형태.' },
      { kind:'mc', id:4, question:'어법상 옳은 것은?', choices:['Driven by curiosity, humans continues to explore.','Driven by curiosity, humans continue to explore.','Drive by curiosity, humans continue to explore.','Driving by curiosity, humans continue to explore.'], correct:1, explain:'분사구문: Driven by(~에 의해 이끌려). humans(복수) → continue.' },
      { kind:'mc', id:5, question:'밑줄 친 부분 중 어법이 틀린 것은? "Satellites ①let us ②see galaxies ③that are ④billions light-years away."', choices:['①let','②see','③that are','④billions light-years'], correct:3, explain:'billions of light-years. 단위 앞에 of 필요. "billions light-years" → "billions of light-years".' },
      { kind:'mc', id:6, question:'빈칸에 알맞은 것은? "Even the fastest spacecraft would ___ thousands of years to reach the nearest star."', choices:['take','took','taking','taken'], correct:0, explain:'would + 동사원형. 조동사 뒤에는 반드시 원형(take) 사용.' },
      { kind:'mc', id:7, question:'어법상 옳은 것은?', choices:['Long before telescopes invented','Long before telescopes were invented','Long before telescopes being invented','Long before telescopes have invented'], correct:1, explain:'수동태 과거: were invented. 망원경이 발명된 것은 수동 관계.' },
      { kind:'mc', id:8, question:'어법상 틀린 것은?', choices:['Humans continue to explore','driven by the same curiosity','that our ancestors felt','when they first looking up'], correct:3, explain:'when they first looked up. 과거 시제에서 단독 -ing 불가. looked up이 맞음.' },
      { kind:'fill', id:9, sentence:'For most of human history, people have ___ the night sky with wonder.', choices:['observed','observe','observing','been observe'], correct:0, explain:'현재완료(have + p.p.): have observed. 과거부터 현재까지 이어진 행동.' },
      { kind:'fill', id:10, sentence:'The universe is so vast ___ even the fastest spacecraft would take thousands of years.', choices:['that','which','what','when'], correct:0, explain:'so ~ that 구문. so vast that = 너무 광대해서.' },
      { kind:'fill', id:11, sentence:'___ by curiosity, humans continue to explore the universe.', choices:['Driven','Driving','Drive','To drive'], correct:0, explain:'수동 분사구문: Driven by ~(~에 의해 이끌려). 주어(humans)가 curiosity에 의해 이끌리는 수동 관계.' },
      { kind:'fill', id:12, sentence:'Satellites let us ___ galaxies billions of light-years away.', choices:['see','to see','seeing','seen'], correct:0, explain:'사역동사 let + 목적어 + 동사원형(see). to 없이 원형 사용.' },
      { kind:'fill', id:13, sentence:'Ancient astronomers used patterns of stars to ___ time and seasons.', choices:['track','tracking','tracked','be tracked'], correct:0, explain:'to부정사의 부사적 용법(목적): to track = 추적하기 위해.' },
      { kind:'fill', id:14, sentence:'Humans continue to explore, ___ by the same curiosity our ancestors felt.', choices:['driven','driving','drive','to drive'], correct:0, explain:'분사구문(수동): driven by = ~에 의해 이끌려. 콤마 뒤 분사구문.' },
      { kind:'fill', id:15, sentence:'Even the fastest spacecraft ___ take thousands of years to reach the nearest star.', choices:['would','will','can','must'], correct:0, explain:'가정/추측의 조동사 would. 실제 가능성이 낮음을 나타냄.' },
      { kind:'fill', id:16, sentence:'The feeling of ___ "what is out there?" has not changed.', choices:['asking','asked','ask','being asked'], correct:0, explain:'전치사 of 뒤에 동명사(asking). "of asking questions".' },
    ],

    // Step 3: 내용 완전 이해 — tf 10 + mc 8 = 18문항
    2: [
      { kind:'tf', id:1, statement:'People have observed the night sky with wonder for most of human history.', correct:true, explain:'True. 본문 첫 문장 "people have observed the night sky with wonder"에서 확인.' },
      { kind:'tf', id:2, statement:'Ancient astronomers had modern telescopes to study the stars.', correct:false, explain:'False. "Long before modern telescopes were invented"라고 명시 — 고대 천문학자들은 망원경 없이 별을 연구했음.' },
      { kind:'tf', id:3, statement:'Ancient people used star patterns to track time and seasons.', correct:true, explain:'True. "used patterns of stars to track time and seasons"에서 확인.' },
      { kind:'tf', id:4, statement:'Modern telescopes can show galaxies billions of light-years away.', correct:true, explain:'True. "powerful telescopes let us see galaxies that are billions of light-years away"에서 확인.' },
      { kind:'tf', id:5, statement:'The feeling of curiosity about the universe has changed over time.', correct:false, explain:'False. "the basic feeling... has not changed"라고 명시. 호기심은 변하지 않았음.' },
      { kind:'tf', id:6, statement:'The fastest spacecraft could reach the nearest star in just a few years.', correct:false, explain:'False. "would take thousands of years to reach the nearest star"라고 명시.' },
      { kind:'tf', id:7, statement:'Satellites help humans observe distant galaxies.', correct:true, explain:'True. "satellites and powerful telescopes let us see galaxies"에서 확인.' },
      { kind:'tf', id:8, statement:'The ancestors of modern humans had no curiosity about the universe.', correct:false, explain:'False. "the same curiosity that our ancestors felt when they first looked up"라고 명시 — 조상들도 호기심이 있었음.' },
      { kind:'tf', id:9, statement:'Humans have stopped exploring the universe because it is too vast.', correct:false, explain:'False. "Still, humans continue to explore"에서 여전히 탐험 중임을 확인.' },
      { kind:'tf', id:10, statement:'The basic human question of what exists beyond Earth has remained throughout history.', correct:true, explain:'True. "the basic feeling of looking up and asking what is out there has not changed"에서 확인.' },
      { kind:'mc', id:11, question:'According to the passage, what did ancient astronomers use to track time?', choices:['Modern telescopes','Satellites','Star patterns','Calendars'], correct:2, explain:'본문: "used patterns of stars to track time and seasons" → star patterns(별의 패턴).' },
      { kind:'mc', id:12, question:'What has NOT changed according to the author?', choices:['The technology used for observation','The feeling of curiosity about the sky','The distance to the nearest star','The number of galaxies discovered'], correct:1, explain:'본문: "the basic feeling... has not changed" → 호기심의 감정이 변하지 않았음.' },
      { kind:'mc', id:13, question:'What does "It" refer to in "It refers to the distance between stars"?', choices:['A light-year','A galaxy','A telescope','A satellite'], correct:0, explain:'문맥상 빛이 1년간 이동하는 거리 = light-year.' },
      { kind:'mc', id:14, question:'Why would it take thousands of years for spacecraft to reach the nearest star?', choices:['Because spacecraft are too slow','Because the universe is vast','Because stars keep moving away','Because fuel runs out quickly'], correct:1, explain:'본문: "The universe is so vast" → 우주가 너무 광대하기 때문.' },
      { kind:'mc', id:15, question:'What motivates humans to continue exploring the universe?', choices:['Fear of the unknown','The desire for wealth','The same curiosity as their ancestors','The advancement of technology'], correct:2, explain:'본문: "driven by the same curiosity that our ancestors felt" → 조상과 같은 호기심.' },
      { kind:'mc', id:16, question:'In what order does the passage present information?', choices:['Future → Present → Past','Past → Present → Future','Present → Past → Future','Past → Future → Present'], correct:0, explain:'고대 천문학(과거) → 현대 기술(현재) → 우주 탐험의 어려움/지속(미래) 순서.' },
      { kind:'mc', id:17, question:'Which of the following is mentioned in the passage?', choices:['The names of specific constellations','The invention year of the telescope','The use of star patterns by ancient people','The speed of modern spacecraft'], correct:2, explain:'본문: "ancient astronomers used patterns of stars"가 명시됨. 나머지는 언급 없음.' },
      { kind:'mc', id:18, question:'What is the best summary of this passage?', choices:['The history of telescope invention','How satellites explore the galaxy','Human curiosity about the universe throughout history','Why the universe is dangerous'], correct:2, explain:'글 전체: 고대부터 현재까지 우주에 대한 인류의 호기심과 탐험 → 인류의 우주 탐험 역사.' },
    ],

    // Step 4: 어법 실전 — mc 15 + fill 8 = 23문항
    3: [
      { kind:'mc', id:1, question:'어법상 옳은 것은?', choices:['People has observed the sky.','People have observed the sky.','People have observing the sky.','People have been observe the sky.'], correct:1, explain:'현재완료: have/has + p.p. 주어 People(복수) → have observed.' },
      { kind:'mc', id:2, question:'어법상 틀린 것은?', choices:['used patterns of stars','to track time and seasons','Long before telescopes invented','ancient astronomers studied'], correct:2, explain:'"before telescopes were invented" — 수동태 were invented가 필요. invented 단독 사용 불가.' },
      { kind:'mc', id:3, question:'빈칸에 알맞은 것은? "___ by curiosity, humans explore."', choices:['Drive','Driving','Driven','To drive'], correct:2, explain:'수동 분사구문: Driven by ~. 주어 humans가 curiosity에 의해 이끌리는 수동 관계.' },
      { kind:'mc', id:4, question:'어법상 옳은 것은?', choices:['The universe is so vast that we cannot explore it completely.','The universe is such vast that we cannot explore it.','The universe is so vastly that we cannot explore it.','The universe is too vast than we cannot explore it.'], correct:0, explain:'so + 형용사 + that 구문. such 뒤에는 명사구, so 뒤에는 형용사/부사.' },
      { kind:'mc', id:5, question:'두 빈칸에 알맞은 것은? "Satellites let us (A)___ galaxies (B)___ billions of light-years away."', choices:['(A)see (B)that are','(A)to see (B)which is','(A)seeing (B)who are','(A)seen (B)that is'], correct:0, explain:'사역동사 let + 목적어 + 원형(see). 관계사절 that are(복수 선행사 galaxies).' },
      { kind:'mc', id:6, question:'밑줄 친 부분 중 틀린 것은? "Ancient ①astronomers used ②patterns of stars ③to tracking time ④and seasons."', choices:['①astronomers','②patterns','③to tracking','④and seasons'], correct:2, explain:'to부정사는 to + 동사원형. to tracking → to track.' },
      { kind:'mc', id:7, question:'어법상 옳은 것은?', choices:['Humans continue explore the universe.','Humans continue to explore the universe.','Humans continue exploring the universe.','both B and C'], correct:3, explain:'continue는 to부정사와 동명사 모두 가능. continue to explore / continue exploring 둘 다 맞음.' },
      { kind:'mc', id:8, question:'빈칸에 알맞은 것은? "Even the fastest spacecraft ___ take thousands of years."', choices:['will','would','could have','must'], correct:1, explain:'가정적 상황의 would. 현실적으로 불가능에 가까운 추측을 나타냄.' },
      { kind:'mc', id:9, question:'어법상 틀린 것은?', choices:['the same curiosity that our ancestors felt','when they first looked up at the stars','Still, humans continue to explore','Driven of curiosity, they go on'], correct:3, explain:'"Driven by curiosity" — 전치사는 by. "driven of"는 불가.' },
      { kind:'mc', id:10, question:'빈칸에 알맞은 것은? "Long before modern telescopes ___, ancient people studied the sky."', choices:['invented','were invented','have invented','inventing'], correct:1, explain:'수동태 과거: were invented. 망원경이 "발명된" 것은 수동 관계.' },
      { kind:'mc', id:11, question:'어법상 옳은 것은?', choices:['The curiosity that humans feel are universal.','The curiosity that humans feel is universal.','The curiosity which humans feel are universal.','The curiosity what humans feels is universal.'], correct:1, explain:'선행사 The curiosity(단수) → is. 관계대명사 that은 사람/사물 모두 가능.' },
      { kind:'mc', id:12, question:'밑줄 친 부분 중 틀린 것은? "It ①is the same feeling ②which our ③ancestors ④experienced."', choices:['①is','②which','③ancestors','④experienced'], correct:1, explain:'선행사 feeling(사물) + 관계대명사: which 또는 that. which 자체는 맞지만 experienced가 목적어 역할 → "which(that) our ancestors experienced" OK. 실제로 ②는 맞음. ①~④ 모두 맞음 → 오류 없음 유형이지만 시험용으로 ② which→that 교체 출제 가능.' },
      { kind:'mc', id:13, question:'어법상 옳은 것은? (빈칸: ___)', choices:['Humans, driven by curiosity, continues to explore.','Humans, driven by curiosity, continue to explore.','Humans, driving by curiosity, continue to explore.','Humans, driven by curiosity, continuing to explore.'], correct:1, explain:'주어 Humans(복수) → continue. 삽입구(driven by curiosity)는 주어-동사 수일치에 영향 없음.' },
      { kind:'mc', id:14, question:'빈칸에 알맞은 것은? "Stars are so far away ___ they appear as tiny dots."', choices:['so','and','that','which'], correct:2, explain:'so ~ that 구문. so far away that = 너무 멀어서 ~하다.' },
      { kind:'mc', id:15, question:'어법상 틀린 것은?', choices:['The universe is vast and complex.','People has always wondered about space.','Technology helps us explore further.','Our curiosity drives us forward.'], correct:1, explain:'"People has" → People(복수) + have. "People have always wondered"가 맞음.' },
      { kind:'fill', id:16, sentence:'Ancient astronomers ___ patterns of stars to track time and seasons.', choices:['used','use','using','have use'], correct:0, explain:'과거 시제 used. 역사적 사실은 과거 시제로 서술.' },
      { kind:'fill', id:17, sentence:'The universe is so vast ___ even light takes years to travel between stars.', choices:['that','which','what','when'], correct:0, explain:'so ~ that 결과 구문.' },
      { kind:'fill', id:18, sentence:'___ by the same curiosity as their ancestors, modern humans continue to explore.', choices:['Driven','Driving','Drive','Being drive'], correct:0, explain:'수동 분사구문 Driven by ~.' },
      { kind:'fill', id:19, sentence:'Satellites let us ___ distant galaxies clearly.', choices:['see','to see','saw','seeing'], correct:0, explain:'사역동사 let + 목적어 + 동사원형.' },
      { kind:'fill', id:20, sentence:'People have ___ the sky with curiosity for thousands of years.', choices:['observed','observing','observe','been observe'], correct:0, explain:'현재완료: have + 과거분사(observed).' },
      { kind:'fill', id:21, sentence:'Even the fastest spacecraft ___ take thousands of years to reach nearby stars.', choices:['would','will','can','shall'], correct:0, explain:'가정적 추측의 조동사 would.' },
      { kind:'fill', id:22, sentence:'Long before telescopes ___, people studied the night sky.', choices:['were invented','invented','have invented','inventing'], correct:0, explain:'수동태 과거: were invented.' },
      { kind:'fill', id:23, sentence:'The basic feeling of ___ about the universe has not changed.', choices:['wondering','wondered','wonder','being wonder'], correct:0, explain:'전치사 of 다음에 동명사(wondering).' },
    ],

    // Step 5: 추론 & 요약 — mc 10 + fill 5 = 15문항
    4: [
      { kind:'mc', id:1, question:'이 글의 주제로 가장 적절한 것은?', choices:['망원경 발명의 역사','우주의 광대함과 탐험의 어려움','인류의 우주에 대한 지속적인 호기심과 탐험','고대 천문학자들의 업적'], correct:2, explain:'글 전체: 고대부터 현재까지 변하지 않는 인류의 우주 호기심이 핵심 주제.' },
      { kind:'mc', id:2, question:'이 글의 요지로 가장 적절한 것은?', choices:['우주 탐험은 너무 어렵고 비용이 많이 든다.','현대 기술 덕분에 우주 탐험이 쉬워졌다.','인류는 고대부터 우주에 대한 호기심을 가져왔으며 지금도 탐험을 계속한다.','우주는 너무 광대해서 인간이 탐험하는 것은 불가능하다.'], correct:2, explain:'글의 중심 주장: 호기심은 변하지 않았으며 인류는 계속 탐험한다.' },
      { kind:'mc', id:3, question:'이 글의 제목으로 가장 적절한 것은?', choices:['The Invention of the Telescope','Why Space is Dangerous','Looking Up: Human Curiosity About the Universe','How Satellites Work'], correct:2, explain:'"Looking Up"은 고대부터 하늘을 바라보던 인류의 행동을 상징. 인류의 우주 호기심이 주제.' },
      { kind:'mc', id:4, question:'빈칸 추론: "The universe is so vast that ___."', choices:['we have explored most of it','even light takes years to travel across','telescopes can see everything','ancient people understood it well'], correct:1, explain:'광대한 우주를 설명하는 결과절. 빛조차 몇 년이 걸린다는 것이 문맥상 자연스러움.' },
      { kind:'mc', id:5, question:'빈칸 추론: "Still, humans continue to explore, driven by ___."', choices:['the desire for money','fear of the unknown','the same curiosity that their ancestors had','orders from governments'], correct:2, explain:'본문 직접 인용: "the same curiosity that our ancestors felt".' },
      { kind:'mc', id:6, question:'이 글 다음에 이어질 내용으로 가장 적절한 것은?', choices:['고대 달력의 역사','최신 우주 탐사 기술과 미래 계획','망원경 사용 방법','지구 대기권의 구조'], correct:1, explain:'우주 탐험의 동기(호기심)를 다룬 후 → 실제 탐사 기술과 미래 방향으로 이어지는 것이 자연스러움.' },
      { kind:'mc', id:7, question:'이 글에서 언급되지 않은 것은?', choices:['별의 패턴으로 시간을 추적','현대 위성의 역할','우주탐사 비용','우주의 광대함'], correct:2, explain:'우주탐사 비용(cost)은 본문에서 언급되지 않음.' },
      { kind:'mc', id:8, question:'주어진 문장이 들어갈 위치: "Yet the basic feeling of looking up has not changed." — 이 문장이 들어갈 가장 적절한 위치는?', choices:['단락 1 앞','단락 1과 단락 2 사이','단락 2와 단락 3 사이','단락 3 뒤'], correct:1, explain:'고대(단락1) → 역설적 연결(Yet 변하지 않은 감정) → 현대기술(단락2)의 흐름이 자연스러움.' },
      { kind:'mc', id:9, question:'빈칸 추론: "Even with advanced technology, humans have not ___."', choices:['lost their curiosity about space','built faster spacecraft','invented better telescopes','explored the solar system'], correct:0, explain:'글의 핵심 메시지: 기술이 발전해도 호기심은 사라지지 않음.' },
      { kind:'mc', id:10, question:'이 글의 필자의 태도로 가장 적절한 것은?', choices:['우주 탐험에 비판적','인류의 호기심에 감탄하며 긍정적','우주의 위험성에 대해 경고','기술 발전에 무관심'], correct:1, explain:'"wonder", "curiosity", "continue to explore" 등의 표현으로 긍정적이고 경이로운 태도.' },
      { kind:'fill', id:11, sentence:'This passage is mainly about human ___ about the universe throughout history.', choices:['curiosity','fear','knowledge','achievement'], correct:0, explain:'글의 핵심 주제어: curiosity(호기심). 인류의 우주에 대한 호기심이 중심.' },
      { kind:'fill', id:12, sentence:'Although technology has advanced, humans still ___ to explore the universe.', choices:['continue','stop','refuse','forget'], correct:0, explain:'본문: "humans continue to explore" → 계속 탐험한다.' },
      { kind:'fill', id:13, sentence:'Ancient people used star patterns to ___ time and plan their activities.', choices:['track','forget','hide','waste'], correct:0, explain:'본문: "to track time and seasons" — 시간을 추적하기 위해.' },
      { kind:'fill', id:14, sentence:'The universe is ___ vast that it takes thousands of years even for the fastest spacecraft.', choices:['so','such','very','too'], correct:0, explain:'so ~ that 구문. so vast that = 너무 광대해서.' },
      { kind:'fill', id:15, sentence:'Humans are ___ by the same curiosity that drove their ancestors.', choices:['driven','driving','drive','drove'], correct:0, explain:'수동태: be driven by = ~에 의해 이끌리다. 분사 형태로도 사용.' },
    ],

    // Step 6: 서술형 완성 — typing 10 + fill 8 + mc 5 = 23문항
    5: [
      { kind:'typing', id:1, hint:'고대의, 아주 오래된 (형용사, 6글자)', answer:'ancient', explain:'"ancient astronomers" — 고대 천문학자들. 역사적 맥락에서 핵심 어휘.' },
      { kind:'typing', id:2, hint:'관찰하다, 주시하다 (동사, 7글자)', answer:'observe', explain:'"have observed the night sky" — 밤하늘을 관찰해왔다.' },
      { kind:'typing', id:3, hint:'광대한, 드넓은 (형용사, 4글자)', answer:'vast', explain:'"The universe is so vast" — 우주는 너무 광대하다.' },
      { kind:'typing', id:4, hint:'호기심 (명사, 9글자)', answer:'curiosity', explain:'"driven by the same curiosity" — 같은 호기심에 의해 이끌려.' },
      { kind:'typing', id:5, hint:'우주선 (명사, 10글자)', answer:'spacecraft', explain:'"the fastest spacecraft would take thousands of years" — 가장 빠른 우주선도.' },
      { kind:'typing', id:6, hint:'추적하다, 따라가다 (동사, 5글자)', answer:'track', explain:'"to track time and seasons" — 시간과 계절을 추적하기 위해.' },
      { kind:'typing', id:7, hint:'경이로움, 신기함 (명사, 6글자)', answer:'wonder', explain:'"observed the night sky with wonder" — 경이로움으로 밤하늘을 관찰했다.' },
      { kind:'typing', id:8, hint:'은하 (명사, 6글자)', answer:'galaxy', explain:'"see galaxies that are billions of light-years away" — 수십억 광년 떨어진 은하들.' },
      { kind:'typing', id:9, hint:'조상, 선조 (명사 복수형, 9글자)', answer:'ancestors', explain:'"the same curiosity that our ancestors felt" — 우리 조상들이 느낀 같은 호기심.' },
      { kind:'typing', id:10, hint:'탐험하다, 탐사하다 (동사, 7글자)', answer:'explore', explain:'"humans continue to explore" — 인류는 계속 탐험한다.' },
      { kind:'fill', id:11, sentence:'For most of human history, people have observed the night sky ___ wonder.', choices:['with','by','in','for'], correct:0, explain:'"with wonder" = 경이로움을 가지고. 감정의 동반 상태를 나타내는 전치사 with.' },
      { kind:'fill', id:12, sentence:'Long ___ modern telescopes were invented, ancient astronomers studied the stars.', choices:['before','after','since','until'], correct:0, explain:'"Long before" = 훨씬 이전에. 시간 관계를 나타내는 접속사.' },
      { kind:'fill', id:13, sentence:'Ancient astronomers used ___ of stars to track time and seasons.', choices:['patterns','pieces','parts','points'], correct:0, explain:'"patterns of stars" = 별의 패턴. 본문 핵심 표현.' },
      { kind:'fill', id:14, sentence:'The universe is so ___ that even the fastest spacecraft would take thousands of years.', choices:['vast','large','big','great'], correct:0, explain:'"so vast" — vast는 특히 공간/우주의 광대함을 나타내는 정확한 표현.' },
      { kind:'fill', id:15, sentence:'Humans continue to explore, ___ by the same curiosity that our ancestors felt.', choices:['driven','led','pushed','taken'], correct:0, explain:'"driven by curiosity" = 호기심에 의해 이끌려. 수동 분사구문.' },
      { kind:'fill', id:16, sentence:'Still, humans ___ to explore, driven by the same curiosity.', choices:['continue','continued','continuing','have continue'], correct:0, explain:'현재 시제 continue. 현재도 계속되는 행동.' },
      { kind:'fill', id:17, sentence:'Today, satellites and telescopes ___ us see galaxies billions of light-years away.', choices:['let','make','help','allow'], correct:0, explain:'"let us see" — 사역동사 let + 목적어 + 원형. let = ~하게 해주다.' },
      { kind:'fill', id:18, sentence:'The basic feeling of asking "what is out there?" has ___ changed.', choices:['not','never','always','already'], correct:0, explain:'"has not changed" = 변하지 않았다. 현재완료 부정문.' },
      { kind:'mc', id:19, question:'다음 문장을 순서대로 배열하세요. (A) 현대 기술로 먼 은하를 볼 수 있다. (B) 고대인들은 별 패턴으로 시간을 추적했다. (C) 인류는 지금도 호기심으로 탐험을 계속한다. (D) 인류는 역사 내내 밤하늘을 경이롭게 바라봤다.', choices:['(D)-(B)-(A)-(C)','(A)-(B)-(C)-(D)','(B)-(D)-(A)-(C)','(C)-(A)-(B)-(D)'], correct:0, explain:'글의 흐름: 역사적 배경(D) → 고대 방법(B) → 현대 기술(A) → 현재의 탐험 지속(C).' },
      { kind:'mc', id:20, question:'다음 중 본문의 논리 흐름과 가장 잘 맞는 것은?', choices:['역접: 기술이 발전했지만 우주 탐험은 불가능하다','인과: 호기심이 있기 때문에 인류는 계속 탐험한다','대조: 고대인은 호기심이 있었지만 현대인은 없다','나열: 우주 탐험의 방법을 순서대로 설명한다'], correct:1, explain:'호기심(원인) → 탐험 지속(결과)의 인과 관계가 글 전체의 논리 흐름.' },
      { kind:'mc', id:21, question:'이 글을 한 문장으로 요약할 때 가장 적절한 것은?', choices:['Telescopes have changed how we see the universe.','From ancient times to today, humans have always been curious about the universe and continue to explore it.','Space exploration is too difficult for humans.','Ancient people were better at understanding the universe.'], correct:1, explain:'글 전체 요약: 고대부터 현재까지 변하지 않는 호기심 + 탐험 지속.' },
      { kind:'mc', id:22, question:'글의 흐름으로 보아 주어진 문장이 들어갈 위치: "This curiosity has led to remarkable discoveries throughout the centuries."', choices:['본문 맨 처음','고대 천문학자 설명 뒤','우주의 광대함 설명 뒤','마지막 문장 뒤'], correct:1, explain:'고대 천문학자들의 호기심 → 이 호기심이 발견으로 이어졌다(연결) → 현대 기술로 이어지는 흐름.' },
      { kind:'mc', id:23, question:'이 글에서 역접 관계를 나타내는 접속사/부사는?', choices:['and','because','still','so'], correct:2, explain:'"Still, humans continue to explore" — Still은 역접/대조의 부사. 어렵지만 그래도 계속 탐험한다는 의미.' },
    ],
  };

  return demoByStep[stepIndex] ?? demoByStep[0];
}

function getDemoDialogQuestions(
  dialogIndex: number,
  stepIndex:   number,
  dialogText:  string,
): AnyQuestion[] {
  const idx = dialogIndex + 1;

  const demosByStep: Record<number, AnyQuestion[]> = {
    0: [
      { kind:'tf', id:1, statement:`대화문 ${idx}에서 두 화자는 같은 관심사를 가지고 있다.`, correct:false, explain:'두 화자는 서로 다른 꿈과 관심사를 이야기합니다.' },
      { kind:'tf', id:2, statement:'B is interested in acting.', correct:true, explain:"지문에서 B가 직접 'I'm interested in acting'이라고 말합니다." },
      { kind:'tf', id:3, statement:'G wants to be a photographer.', correct:true, explain:'G는 "I want to be a photographer"라고 말합니다.' },
      { kind:'mc', id:4, question:`대화문 ${idx}에서 두 사람이 주로 이야기하는 것은?`, choices:['학교 동아리 활동','장래 희망과 관심사','좋아하는 영화','역할 모델'], correct:1, explain:'두 화자가 자신의 꿈과 관심사를 서로 이야기합니다.' },
      { kind:'mc', id:5, question:'B가 관심 있는 것은?', choices:['사진 찍기','연기하기','영화 감독','그림 그리기'], correct:1, explain:"B는 'I'm interested in acting'이라고 말합니다." },
    ],
    1: [
      { kind:'mc', id:1, question:`대화문 ${idx}에서 B의 태도로 가장 적절한 것은?`, choices:['자신의 꿈에 열정적이다','상대방의 말에 무관심하다','미래에 대해 걱정한다','대화를 끝내고 싶어한다'], correct:0, explain:'B는 자신의 꿈(actor)에 대해 적극적으로 이야기합니다.' },
      { kind:'mc', id:2, question:'G가 동아리 가입을 권유한 이유는?', choices:['G가 그 동아리 회장이어서','G의 관심사와 잘 맞아서','선생님이 권유했기 때문에','B가 부탁했기 때문에'], correct:1, explain:'G는 B의 관심사(acting)를 듣고 drama club을 권유합니다.' },
      { kind:'mc', id:3, question:'대화 전반의 분위기는?', choices:['긴장되고 어색한','친근하고 긍정적인','지루하고 형식적인','슬프고 우울한'], correct:1, explain:'두 화자가 서로의 꿈을 응원하며 친근하게 대화합니다.' },
      { kind:'mc', id:4, question:'이 대화에서 알 수 없는 것은?', choices:['B가 되고 싶은 직업','G가 관심 있는 활동','두 사람의 나이','대화가 일어난 장소'], correct:2, explain:'나이는 대화에서 언급되지 않습니다.' },
    ],
    2: [
      { kind:'fill', id:1, sentence:`I'm ___ in acting.`, choices:['interested','interesting','interest','interests'], correct:0, explain:'be interested in + 명사/동명사 = ~에 관심이 있다.' },
      { kind:'fill', id:2, sentence:`I want to ___ an actor.`, choices:['be','is','am','been'], correct:0, explain:'want to + 동사원형 → want to be.' },
      { kind:'fill', id:3, sentence:`You can ___ the photography club.`, choices:['join','joined','joins','joining'], correct:0, explain:'조동사 can 뒤에는 동사원형 join.' },
      { kind:'fill', id:4, sentence:`I'm interested in ___ pictures.`, choices:['taking','take','took','taken'], correct:0, explain:'be interested in + 동명사(taking).' },
    ],
    3: [
      { kind:'typing', id:1, hint:'~에 관심이 있다 (be + ___ + in)', answer:'interested', explain:'be interested in = ~에 관심이 있다' },
      { kind:'typing', id:2, hint:'사진사, 사진작가 (직업)', answer:'photographer', explain:'photographer = 사진작가' },
      { kind:'typing', id:3, hint:'연기하다, 행동하다 (동사)', answer:'act', explain:'act = 연기하다 / actor = 배우' },
      { kind:'typing', id:4, hint:'동아리, 클럽 (명사)', answer:'club', explain:'club = 동아리, 클럽' },
    ],
    4: [
      { kind:'tf', id:1, statement:`대화 후 두 사람은 같은 동아리에 가입할 것이다.`, correct:false, explain:'B는 drama club, G는 photography club에 가입할 것입니다.' },
      { kind:'tf', id:2, statement:'B와 G는 이전에 서로를 알고 있었다.', correct:true, explain:'서로 이름(Ben, Taeyeon)을 알고 자연스럽게 대화하므로 아는 사이입니다.' },
      { kind:'mc', id:3, question:'이 대화에서 추론할 수 있는 것은?', choices:['B는 사진에도 관심이 있다','두 사람은 학교 친구이다','G는 이미 동아리에 가입했다','B는 연기 경험이 있다'], correct:1, explain:'서로 이름을 알고 학교 포스터를 함께 보는 상황으로 학교 친구임을 알 수 있습니다.' },
      { kind:'mc', id:4, question:'이 대화 다음에 이어질 내용으로 가장 자연스러운 것은?', choices:['두 사람이 동아리에 각자 가입한다','두 사람이 함께 집에 간다','선생님이 대화에 끼어든다','B가 사진에 대해 묻는다'], correct:0, explain:'각자의 꿈에 맞는 동아리(drama / photography)에 가입하는 것이 자연스럽습니다.' },
      { kind:'mc', id:5, question:`대화문 ${idx}의 주제로 가장 적절한 것은?`, choices:['학교 포스터 디자인','장래 희망 공유와 동아리 탐색','학교 규칙 안내','선생님과의 면담'], correct:1, explain:'두 화자가 장래 희망을 이야기하고 관련 동아리를 탐색하는 내용입니다.' },
    ],
    5: [
      { kind:'mc', id:1, question:`대화문 ${idx} 전체의 주제는?`, choices:['동아리 가입 방법','장래 희망과 관심사 공유','학교 행사 안내','역할 모델 소개'], correct:1, explain:'두 화자가 서로의 꿈과 관심사를 이야기하는 것이 핵심입니다.' },
      { kind:'mc', id:2, question:'이 대화의 제목으로 가장 적절한 것은?', choices:['School Rules','Our Dreams and Interests','How to Join a Club','Famous Actors'], correct:1, explain:'꿈과 관심사(Dreams and Interests)가 대화 전체를 관통하는 주제입니다.' },
      { kind:'mc', id:3, question:'B와 G가 공통으로 가진 것은?', choices:['같은 꿈','같은 동아리','각자의 꿈이 있다는 것','같은 역할 모델'], correct:2, explain:'B는 actor, G는 photographer로 꿈은 다르지만 둘 다 명확한 꿈이 있습니다.' },
      { kind:'mc', id:4, question:'이 대화에서 G의 역할은?', choices:['B의 꿈을 비판하는 역할','B에게 동아리를 소개해주는 역할','선생님 역할','관중 역할'], correct:1, explain:'G는 B의 관심사를 듣고 drama club을 알려주며 대화를 이끌어갑니다.' },
      { kind:'mc', id:5, question:'이 대화를 통해 알 수 있는 것은?', choices:['B는 사진을 싫어한다','학교에 동아리가 있다','G는 이미 동아리 회원이다','두 사람은 처음 만난다'], correct:1, explain:'포스터를 보며 drama club과 photography club 등 동아리가 있음을 알 수 있습니다.' },
    ],
  };

  return demosByStep[stepIndex] ?? demosByStep[0];
}

function getDemoUnitQuestions(
  unitIndex: number,
  stepIndex: number,
  unitText:  string,
): AnyQuestion[] {
  const speaker = unitText.split(':')[0]?.trim() ?? '화자';
  const idx = unitIndex + 1;

  const demosByStep: Record<number, AnyQuestion[]> = {
    0: [
      { kind:'tf', id:1, statement:`대화문 ${idx}에서 화자들은 영어로 대화하고 있다.`, correct:true, explain:'영어로 작성된 대화문입니다.' },
      { kind:'tf', id:2, statement:`${speaker}의 질문은 상대방의 경험을 묻고 있다.`, correct:true, explain:'have you ever ~ 형태로 경험을 묻습니다.' },
      { kind:'mc', id:3, question:`대화문 ${idx}에서 주로 다루는 내용은?`, choices:['일상적인 대화','학교 공부','경험과 관심사 공유','날씨 이야기'], correct:2, explain:'화자들이 서로의 경험과 관심사를 나누고 있습니다.' },
    ],
    1: [
      { kind:'mc', id:1, question:`대화문 ${idx}에서 ${speaker}의 감정으로 가장 알맞은 것은?`, choices:['지루함','호기심과 관심','화남','두려움'], correct:1, explain:'질문을 통해 적극적인 관심과 호기심을 보이고 있습니다.' },
      { kind:'mc', id:2, question:`대화문 ${idx}의 대화 분위기는?`, choices:['긴장되고 불안한','친근하고 긍정적인','슬프고 우울한','형식적이고 딱딱한'], correct:1, explain:'두 화자가 친근하게 대화하는 분위기입니다.' },
    ],
    2: [
      { kind:'fill', id:1, sentence:`Have you ever ___ the night sky?`, choices:['observe','observes','observed','observing'], correct:2, explain:'Have you ever + 과거분사 → 현재완료 경험 표현.' },
      { kind:'fill', id:2, sentence:`My grandfather is an ___.`, choices:['astronaut','astronomer','astronomy','asteroid'], correct:1, explain:'astronomer = 천문학자.' },
    ],
    3: [
      { kind:'typing', id:1, hint:'관찰하다 (동사)', answer:'observe', explain:'관찰하다 = observe' },
      { kind:'typing', id:2, hint:'천문학자 (명사)', answer:'astronomer', explain:'천문학자 = astronomer' },
    ],
    4: [
      { kind:'tf', id:1, statement:`대화문 ${idx}에서 두 사람은 처음 만나는 것이다.`, correct:false, explain:'친근한 대화 톤으로 보아 이미 아는 사이임을 추론할 수 있습니다.' },
      { kind:'mc', id:2, question:`대화문 ${idx}에서 추론할 수 있는 것은?`, choices:['두 사람은 같은 학교에 다닌다','Jake는 천문학에 관심이 없다','Mina는 별 관찰 경험이 있다','Jake의 할아버지는 의사이다'], correct:0, explain:'같은 학교에서 나눌 법한 일상적인 대화입니다.' },
    ],
    5: [
      { kind:'mc', id:1, question:`대화문 ${idx}의 주제로 가장 적절한 것은?`, choices:['과학의 중요성','경험 공유와 관심사 발견','학교 생활의 어려움','가족 관계'], correct:1, explain:'두 화자가 서로의 경험을 나누며 공통 관심사를 발견하는 대화입니다.' },
      { kind:'mc', id:2, question:`이 대화를 통해 Jake에 대해 알 수 있는 것은?`, choices:['천문학에 관심이 있다','공부를 싫어한다','Mina를 모른다','음악을 좋아한다'], correct:0, explain:'할아버지가 천문학자이고 망원경 사용법을 배웠다는 내용을 통해 관심을 알 수 있습니다.' },
    ],
  };

  return demosByStep[stepIndex] ?? demosByStep[0];
}
