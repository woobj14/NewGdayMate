// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════

// ── 4개 독립 학습 트랙 ──────────────────────────────────────────
// word    : 단어 학습    — 60~75개 어휘 4단계 집중
// dialog  : 대화문 학습  — 대화 내용·표현·어법 6단계 (단어 제외)
// reading : 본문 학습    — 독해·어법·추론 6단계 (단어 제외)
// grammar : 문법 학습    — 선생님 지정 포인트 4단계
export type ContentType = 'word' | 'grammar' | 'dialog' | 'reading';

// Firestore content 문서 (선생님이 등록한 자료)
export interface LessonContent {
  id:          string;
  title:       string;
  publisher:   string;
  author:      string;
  grade:       string;
  unit:        string;
  type:        ContentType;
  wordCount:   number;
  stepCount:   number;    // word=4, grammar=4, dialog=6, reading=6
  quizCount:   number;
  assignedBy:  string;    // 선생님 uid
  academyId:   string;
  createdAt:   Date;
}

// 학생의 자료별 진도 (users/{uid}/progress/{lessonId})
export interface LessonProgress {
  lessonId:       string;
  completedSteps: number[];
  xpEarned:       number;
  lastStudied:    Date;
  status:         'not_started' | 'in_progress' | 'completed';
}

// 단계 정의
export interface StepDef {
  index:      number;
  title:      string;
  desc:       string;
  quizType:   'meaning' | 'spelling' | 'matching' | 'typing' | 'grammar_mc' | 'content_mc';
  xp:         number;
  difficulty: '쉬움' | '중간' | '어려움';
  emoji:      string;   // 각 단계 아이콘
  countLabel: string;   // 문항 수 안내 (예: "13~15문항")
}

// ── 4개 트랙 Step 정의 ──────────────────────────────────────────
export const STEP_DEFS: Record<ContentType, StepDef[]> = {

  // ── 📗 단어 학습 · 4단계 ──────────────────────────────────────
  // 본문/대화문의 핵심 어휘 60~75개를 단계별로 완전 습득
  word: [
    {
      index:0, emoji:'🔤',
      title:'Step 1 · 뜻 맞추기',
      desc:'단어를 보고 한글 뜻 4지선다 선택',
      countLabel:'전체 단어 × 1회',
      quizType:'meaning',  xp:60,  difficulty:'쉬움',
    },
    {
      index:1, emoji:'✏️',
      title:'Step 2 · 철자 쓰기',
      desc:'한글 뜻을 보고 영어 단어 직접 입력',
      countLabel:'전체 단어 × 1회',
      quizType:'spelling', xp:80,  difficulty:'중간',
    },
    {
      index:2, emoji:'🔗',
      title:'Step 3 · 영영풀이 짝 맞추기',
      desc:'영영풀이와 단어를 연결하세요',
      countLabel:'6~8쌍 매칭',
      quizType:'matching', xp:80,  difficulty:'중간',
    },
    {
      index:3, emoji:'🏆',
      title:'Step 4 · 완전 마스터',
      desc:'영영풀이 보고 영어 단어 타이핑 + 4지선다 혼합',
      countLabel:'전체 단어 완성형',
      quizType:'typing',   xp:100, difficulty:'어려움',
    },
  ],

  // ── 📐 문법 학습 · 4단계 ──────────────────────────────────────
  // 선생님이 지정한 문법 포인트 집중 훈련
  grammar: [
    {
      index:0, emoji:'📖',
      title:'Step 1 · 개념 이해',
      desc:'문법 포인트 카드를 탭해서 하나씩 확인',
      countLabel:'포인트 전체 확인',
      quizType:'meaning',    xp:80,  difficulty:'쉬움',
    },
    {
      index:1, emoji:'🔍',
      title:'Step 2 · 예문 판단',
      desc:'올바른/틀린 예문을 O/X로 판단 + 점수',
      countLabel:'예문 6~8개',
      quizType:'spelling',   xp:100, difficulty:'중간',
    },
    {
      index:2, emoji:'✍️',
      title:'Step 3 · 빈칸 완성',
      desc:'문법에 맞는 형태로 빈칸 채우기',
      countLabel:'8문항',
      quizType:'matching',   xp:120, difficulty:'중간',
    },
    {
      index:3, emoji:'⚔️',
      title:'Step 4 · 실전 퀴즈',
      desc:'내신 기출 어법 문제 15문항',
      countLabel:'15문항',
      quizType:'grammar_mc', xp:200, difficulty:'어려움',
    },
  ],

  // ── 💬 대화문 학습 · 6단계 ────────────────────────────────────
  // 단어는 별도 단어학습에서 다루므로, 대화 내용·표현·어법에 집중
  dialog: [
    {
      index:0, emoji:'🌍',
      title:'Step 1 · 상황 & 내용 이해',
      desc:'대화 배경·인물·상황 T/F + 세부내용 MC',
      countLabel:'T/F 8개 + MC 6개 = 14문항',
      quizType:'meaning',    xp:100, difficulty:'쉬움',
    },
    {
      index:1, emoji:'😊',
      title:'Step 2 · 감정 & 의도 분석',
      desc:'화자의 감정·태도·의도·목적 파악',
      countLabel:'MC 10개',
      quizType:'spelling',   xp:150, difficulty:'중간',
    },
    {
      index:2, emoji:'✏️',
      title:'Step 3 · 핵심 표현 완성',
      desc:'대화 핵심 표현 빈칸 채우기 + 어법 판단',
      countLabel:'fill 10개 + 어법 MC 5개 = 15문항',
      quizType:'matching',   xp:150, difficulty:'중간',
    },
    {
      index:3, emoji:'🖊️',
      title:'Step 4 · 표현 직접 쓰기',
      desc:'핵심 표현·관용어·회화표현 타이핑',
      countLabel:'typing 10개',
      quizType:'typing',     xp:150, difficulty:'중간',
    },
    {
      index:4, emoji:'🧩',
      title:'Step 5 · 대화 추론',
      desc:'대화 흐름·이어질 내용·숨은 의미 추론',
      countLabel:'MC 12개',
      quizType:'grammar_mc', xp:200, difficulty:'어려움',
    },
    {
      index:5, emoji:'🎯',
      title:'Step 6 · 종합 완성',
      desc:'주제·요약·순서·서술형 완성',
      countLabel:'MC 8개 + fill 5개 + typing 5개 = 18문항',
      quizType:'content_mc', xp:300, difficulty:'어려움',
    },
  ],

  // ── 📖 본문 학습 · 6단계 ──────────────────────────────────────
  // 단어는 별도 단어학습에서 다루므로, 독해·어법·추론·서술에 집중
  reading: [
    {
      index:0, emoji:'🔎',
      title:'Step 1 · 문장 구조 파악',
      desc:'핵심 문장 어법 구조 분석 + 어법 O/X',
      countLabel:'어법MC 10개 + fill 8개 = 18문항',
      quizType:'meaning',    xp:100, difficulty:'쉬움',
    },
    {
      index:1, emoji:'📋',
      title:'Step 2 · 내용 완전 이해',
      desc:'본문 전체 T/F + 세부내용·인과·지시어 MC',
      countLabel:'T/F 10개 + MC 10개 = 20문항',
      quizType:'spelling',   xp:150, difficulty:'중간',
    },
    {
      index:2, emoji:'⚙️',
      title:'Step 3 · 어법 실전',
      desc:'본문 추출 내신 기출 어법 5유형 집중',
      countLabel:'MC 15개 + fill 8개 = 23문항',
      quizType:'matching',   xp:150, difficulty:'중간',
    },
    {
      index:3, emoji:'💡',
      title:'Step 4 · 추론 & 요약',
      desc:'주제·요지·제목·빈칸추론·순서·요약문',
      countLabel:'MC 12개 + fill 5개 = 17문항',
      quizType:'typing',     xp:150, difficulty:'어려움',
    },
    {
      index:4, emoji:'🖊️',
      title:'Step 5 · 핵심 표현 쓰기',
      desc:'본문 핵심 구문·표현 직접 타이핑',
      countLabel:'typing 12개',
      quizType:'grammar_mc', xp:200, difficulty:'어려움',
    },
    {
      index:5, emoji:'🏆',
      title:'Step 6 · 종합 서술형',
      desc:'문장 완성 + 순서 배열 + 서술형 완성',
      countLabel:'fill 10개 + MC 5개 + typing 5개 = 20문항',
      quizType:'content_mc', xp:300, difficulty:'어려움',
    },
  ],
};

// 타입별 한글 레이블
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  word:    '단어',
  grammar: '문법',
  dialog:  '대화문',
  reading: '본문',
};

// 타입별 색상 (디자인 시스템)
export const CONTENT_TYPE_COLOR: Record<ContentType, string> = {
  word:    '#1AB87A',  // green
  dialog:  '#3B8BD4',  // blue
  reading: '#5B50F0',  // brand
  grammar: '#F0A500',  // amber
};

// 타입별 이모지
export const CONTENT_TYPE_EMOJI: Record<ContentType, string> = {
  word:    '📗',
  dialog:  '💬',
  reading: '📖',
  grammar: '📐',
};
