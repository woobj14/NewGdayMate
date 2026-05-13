// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(
  process.env.EXPO_PUBLIC_GEMINI_API_KEY!
);

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const WORD_UPLOAD_MAX_ITEMS = 150;

// 선생님별 temperature — 말투 개성
export const COACH_TEMPS = {
  betty: 0.95,  // 자유분방, 직설적
  lukas: 0.55,  // 정확하고 차분
  alex:  0.82,  // 창의적, 통찰력
} as const;

export type CoachKey = keyof typeof COACH_TEMPS;

// 선생님별 시스템 프롬프트
export const COACH_PROMPTS: Record<CoachKey, string> = {
  betty: `당신은 Betty, G'day Mate의 1타 AI 영어 코치입니다.
수백 명의 내신 1등급을 만들어온 핵심 압축 전문가.
최신 수능/내신 트렌드를 완벽히 파악하고 있습니다.

말투: 직설적이고 자신감 넘침. "야", "이거봐봐", "쉽잖아?" 적극 사용.
규칙:
1. 핵심을 3줄 이내로 먼저 제시
2. 예시 문장 즉시 제공
3. 틀린 이유 명확히 지적
4. 다음 액션 제안으로 마무리
5. 이모지 적극 사용 (🎯⚡💪)

학생 정보: {{studentCtx}}
오답 컨텍스트: {{wrongCtx}}`,

  lukas: `당신은 Lukas, G'day Mate의 꼼꼼한 AI 학습 코치입니다.
단 한 명도 포기하지 않는 맞춤형 교육 전문가.
학생 심리를 읽고 최적의 속도로 개념을 쌓아줍니다.

말투: 따뜻하고 인내심 있음. "천천히 같이 해보자", "이해됐어?", "걱정하지 마" 사용.
규칙:
1. 먼저 공감하고 시작
2. 왜? → 공식 → 예시 → 확인 순서로 설명
3. 타임라인/시각적 비유 적극 활용
4. 이해도 확인 질문으로 마무리
5. 따뜻한 이모지 사용 (😊💙📚)

학생 정보: {{studentCtx}}
오답 컨텍스트: {{wrongCtx}}`,

  alex: `당신은 Alex, G'day Mate의 심리 AI 멘토입니다.
학습 심리학과 뇌과학 기반의 차세대 코칭 전문가.
공부 습관 설계부터 멘탈 관리까지 전방위 케어.

말투: 통찰력 있고 창의적. "흥미롭다", "왜 그렇게 생각했어?", "이렇게 연결해봐" 사용.
규칙:
1. 학습 패턴을 먼저 분석
2. 창의적 연상법/스토리텔링으로 설명
3. 자신감 구축에 초점
4. 소크라테스식 질문으로 스스로 깨닫게 유도
5. 개성 있는 이모지 사용 (✨🧠🎨)

학생 정보: {{studentCtx}}
오답 컨텍스트: {{wrongCtx}}`,
};

interface StreamOptions {
  coach: CoachKey;
  question: string;
  history: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>;
  studentCtx?: string;
  wrongCtx?: string;
  onChunk: (text: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
}

export async function streamCoachResponse({
  coach, question, history,
  studentCtx = '', wrongCtx = '',
  onChunk, onDone, onError,
}: StreamOptions) {
  try {
    const systemPrompt = COACH_PROMPTS[coach]
      .replace('{{studentCtx}}', studentCtx)
      .replace('{{wrongCtx}}',   wrongCtx);
    const transcript = history
      .map((turn) => {
        const speaker = turn.role === 'user' ? '학생' : '코치';
        const text = turn.parts.map(part => part.text).join('\n').trim();
        return text ? `${speaker}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const prompt = [
      systemPrompt,
      transcript ? `이전 대화:\n${transcript}` : '이전 대화: 없음',
      `학생의 새 질문:\n${question}`,
      '위 설정을 유지해서 자연스럽고 구체적으로 답변하세요.',
    ].join('\n\n');

    const full = await generateTextWithRest(prompt, {
      temperature: COACH_TEMPS[coach],
      maxOutputTokens: 700,
    });

    if (!full.trim()) {
      throw new Error('AI 코치 응답이 비어 있습니다.');
    }

    onChunk(full);
    onDone(full);
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── 콘텐츠 파싱용 타입 ──────────────────────────────
export interface ParsedWord {
  word:   string;
  pos:    string;   // n. / v. / adj. / adv.
  ko:     string;   // 한글 뜻
  def:    string;   // 영영풀이
  defKo?: string;   // 영영풀이 한글뜻
  syn:    string;   // 유의어
  grade:  string;   // 중1~고3
}

export interface GrammarSection {
  title: string;
  explanation: string;
  examples: string[];
}

export interface ParsedContent {
  words:         ParsedWord[];
  grammarPoints: string[];   // 문법 포인트 목록
  grammarSections: GrammarSection[];
  summary:       string;     // 본문 요약 (reading/dialog)
}

function getDialogGroups(text: string): string[] {
  return text.split(/\n\s*\n/).map(group => group.trim()).filter(Boolean);
}

function getReadingParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(para => para.trim()).filter(Boolean);
}

function extractGeminiText(response: any): string {
  try {
    const text = response?.text?.();
    if (typeof text === 'string' && text.trim()) return text.trim();
  } catch {
    // Gemini SDK can throw when the response has no text part.
  }

  const candidates = response?.candidates ?? [];
  return candidates
    .flatMap((candidate: any) => candidate?.content?.parts ?? [])
    .map((part: any) => part?.text ?? '')
    .join('\n')
    .trim();
}

async function generateImageTextWithRest(prompt: string, params: {
  base64: string;
  mimeType: string;
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key.');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: params.mimeType,
                data: params.base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Gemini image OCR failed.');
  }

  const text = (json?.candidates ?? [])
    .flatMap((candidate: any) => candidate?.content?.parts ?? [])
    .map((part: any) => part?.text ?? '')
    .join('\n')
    .trim();

  if (!text) {
    const finishReason = json?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned empty OCR text.${finishReason ? ` finishReason=${finishReason}` : ''}`);
  }

  return text;
}

async function generateTextWithRest(prompt: string, config: {
  temperature: number;
  maxOutputTokens: number;
}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API key.');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Gemini text parsing failed.');
  }

  return (json?.candidates ?? [])
    .flatMap((candidate: any) => candidate?.content?.parts ?? [])
    .map((part: any) => part?.text ?? '')
    .join('\n')
    .trim();
}

function parseJsonObject(raw: string): any {
  const withoutFence = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object in Gemini response.');
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}

function sanitizeParsedContent(
  value: any,
  grade: string,
  contentType: 'dialog' | 'reading' | 'grammar' | 'word',
): ParsedContent {
  const maxWords = contentType === 'word' ? WORD_UPLOAD_MAX_ITEMS : 30;
  const words = Array.isArray(value?.words)
    ? value.words
      .map((word: any) => ({
        word: String(word?.word ?? '').trim(),
        pos: String(word?.pos ?? '').trim(),
        ko: String(word?.ko ?? '').trim(),
        def: String(word?.def ?? '').trim(),
        defKo: String(word?.defKo ?? '').trim(),
        syn: String(word?.syn ?? '').trim(),
        grade: String(word?.grade ?? grade).trim() || grade,
      }))
      .filter((word: ParsedWord) => word.word.length > 0)
      .slice(0, maxWords)
    : [];

  const grammarPoints = Array.isArray(value?.grammarPoints)
    ? value.grammarPoints.map((point: any) => String(point ?? '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const grammarSections = Array.isArray(value?.grammarSections)
    ? value.grammarSections
      .map((section: any) => ({
        title: String(section?.title ?? '').trim(),
        explanation: String(section?.explanation ?? '').trim(),
        examples: Array.isArray(section?.examples)
          ? section.examples.map((example: any) => String(example ?? '').trim()).filter(Boolean).slice(0, 5)
          : [],
      }))
      .filter((section: GrammarSection) => section.title.length > 0)
      .slice(0, 8)
    : [];

  return {
    words,
    grammarPoints: contentType === 'grammar'
      ? (grammarSections.length > 0
          ? grammarSections.map((section: GrammarSection) => section.title).slice(0, 8)
          : grammarPoints)
      : grammarPoints,
    grammarSections,
    summary: String(value?.summary ?? '').trim(),
  };
}

function extractGrammarSectionsFromText(text: string): GrammarSection[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const sections: GrammarSection[] = [];
  let current: GrammarSection | null = null;

  const pushCurrent = () => {
    if (!current?.title) return;
    current.examples = current.examples.filter(Boolean);
    sections.push(current);
    current = null;
  };

  for (const line of lines) {
    const titleMatch = line.match(/^\[?\s*(?:핵심문법|문법포인트|grammar point)\s*\d*\s*\]?\s*[:\-]?\s*(.+)$/i);
    if (titleMatch) {
      pushCurrent();
      current = {
        title: titleMatch[1].trim(),
        explanation: '',
        examples: [],
      };
      continue;
    }

    const explanationMatch = line.match(/^\[?\s*설명\s*\]?\s*[:\-]?\s*(.+)$/i);
    if (explanationMatch) {
      if (!current) {
        current = { title: '문법 포인트', explanation: '', examples: [] };
      }
      current.explanation = current.explanation
        ? `${current.explanation} ${explanationMatch[1].trim()}`.trim()
        : explanationMatch[1].trim();
      continue;
    }

    const exampleMatch = line.match(/^\[?\s*예문\s*\d*\s*\]?\s*[:\-]?\s*(.+)$/i);
    if (exampleMatch) {
      if (!current) {
        current = { title: '문법 포인트', explanation: '', examples: [] };
      }
      current.examples.push(exampleMatch[1].trim());
      continue;
    }

    if (!current) {
      current = { title: line, explanation: '', examples: [] };
      continue;
    }

    if (!current.explanation && line.length <= 48 && !/[.!?]$/.test(line) && !/[a-z]{2,}\s+[a-z]{2,}/i.test(line)) {
      pushCurrent();
      current = { title: line, explanation: '', examples: [] };
      continue;
    }

    if (/[.!?]/.test(line) || /^(I|You|We|They|He|She|It|If|When|Although|Because)\b/.test(line)) {
      current.examples.push(line);
    } else {
      current.explanation = current.explanation
        ? `${current.explanation} ${line}`.trim()
        : line;
    }
  }

  pushCurrent();

  return sections
    .map(section => ({
      title: section.title.replace(/^[-•*\d.)\s]+/, '').trim(),
      explanation: section.explanation.trim(),
      examples: section.examples.map(example => example.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean),
    }))
    .filter(section => section.title.length > 0)
    .slice(0, 8);
}

export function buildParsedContentFallback(
  text: string,
  contentType: 'dialog' | 'reading' | 'grammar' | 'word',
  grade: string,
): ParsedContent {
  if (contentType === 'dialog') {
    const groups = getDialogGroups(text);
    return {
      words: [],
      grammarPoints: [],
      grammarSections: [],
      summary: groups.length > 0
        ? `대화문 그룹 ${groups.length}개를 확인했습니다. 학생 학습에서는 각 대화문별로 독립적으로 문제를 풉니다. 대화 그룹 사이의 빈 줄이 유지되는지 검토해 주세요.`
        : '대화문 그룹을 확인하지 못했습니다. 각 대화문 사이에 빈 줄이 있는지 확인해 주세요.',
    };
  }

  if (contentType === 'reading') {
    const paragraphs = getReadingParagraphs(text);
    return {
      words: [],
      grammarPoints: [],
      grammarSections: [],
      summary: paragraphs.length > 0
        ? `본문 단락 ${paragraphs.length}개를 확인했습니다. 학생 학습에서는 단락별로 나누어 문제를 풉니다. 일반적으로 3개 단락 구성이므로 문단 구분이 올바른지 검토해 주세요.`
        : '본문 단락을 확인하지 못했습니다. 단락 사이에 빈 줄이 있는지 확인해 주세요.',
    };
  }

  if (contentType === 'grammar') {
    const sections = extractGrammarSectionsFromText(text);
    return {
      words: [],
      grammarPoints: sections.map(section => section.title),
      grammarSections: sections,
      summary: sections.length > 0
        ? `핵심 문법 ${sections.length}개를 확인했습니다. 각 문법의 설명과 예문을 분리해 검수해 주세요.`
        : '문법 구조를 자동 분리하지 못했습니다. 핵심 문법, 설명, 예문 구분을 다시 확인해 주세요.',
    };
  }

  const skip = new Set([
    'vocabulary', 'words', 'phrases', 'words phrases', 'reading', 'language focus',
    'listen', 'talk', 'real-life communication', 'think', 'write', 'lesson review',
  ]);
  const common = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'have', 'from', 'they', 'there',
    'what', 'when', 'where', 'were', 'will', 'your', 'about', 'because', 'into',
  ]);
  const seen = new Set<string>();
  const words: ParsedWord[] = [];

  const pushWord = (candidate: string, ko = '', pos = '') => {
    const cleaned = candidate
      .replace(/^[\d.)\-\s•*]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!/^[A-Za-z][A-Za-z' -]*(?:\([^)]+\))?$/.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (skip.has(key) || common.has(key) || key.length < 2 || seen.has(key)) return;
    seen.add(key);
    words.push({
      word: cleaned,
      pos: pos || '',
      ko: ko || '확인 필요',
      def: 'AI 분석 재시도 필요',
      defKo: '',
      syn: '',
      grade,
    });
  };

  if (contentType === 'word') {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|').map(part => part.trim());
      const candidate = parts[0] ?? '';
      const ko = parts.find(part => /[가-힣]/.test(part)) ?? '';
      const pos = parts.find(part => /^(n|v|adj|adv|prep|conj)\.?$/i.test(part)) ?? '';
      pushWord(candidate, ko, pos);
      if (words.length >= WORD_UPLOAD_MAX_ITEMS) break;
    }
  } else {
    const matches = text.match(/\b[A-Za-z][A-Za-z'-]{3,}\b/g) ?? [];
    for (const match of matches) {
      pushWord(match);
      if (words.length >= 30) break;
    }
  }

  return {
    words,
    grammarPoints: [],
    grammarSections: [],
    summary: words.length > 0
      ? `AI 파싱이 실패해 입력 텍스트에서 단어 후보 ${words.length}개를 우선 추출했습니다.`
      : 'AI 파싱이 실패했습니다. 입력 텍스트를 확인해 주세요.',
  };
}

function completeWordParsedContent(
  parsed: ParsedContent,
  text: string,
  contentType: 'dialog' | 'reading' | 'grammar' | 'word',
  grade: string,
): ParsedContent {
  if (contentType !== 'word') return parsed;

  const fallback = buildParsedContentFallback(text, 'word', grade);
  if (fallback.words.length === 0) return parsed;

  const seen = new Set(parsed.words.map(word => word.word.trim().toLowerCase()));
  const merged = [...parsed.words];
  for (const word of fallback.words) {
    const key = word.word.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(word);
    if (merged.length >= WORD_UPLOAD_MAX_ITEMS) break;
  }

  return {
    ...parsed,
    words: merged,
    summary: parsed.summary || `입력된 단어 ${merged.length}개를 분석했습니다.`,
  };
}

export async function organizeContentImageWithAI(params: {
  base64: string;
  mimeType: string;
  contentType: 'dialog' | 'reading' | 'grammar' | 'word';
  grade: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.1, maxOutputTokens: 2500, thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  const typeLabel: Record<typeof params.contentType, string> = {
    dialog: '대화문',
    reading: '본문',
    grammar: '문법',
    word: '단어',
  };

  const prompt = `
당신은 한국 중고등학교 영어 교재 입력을 돕는 편집자입니다.
첨부된 이미지의 영어 학습 자료를 OCR로 읽고, 선생님이 검토 후 바로 업로드할 수 있도록 텍스트로 정리하세요.

[자료 유형]: ${typeLabel[params.contentType]}
[대상 학년]: ${params.grade}

출력 규칙:
- 설명 없이 정리된 텍스트만 출력
- 이미지에 없는 내용을 새로 만들지 말 것
- 줄바꿈과 순서를 최대한 원문처럼 유지
- 대화문: "이름: 대사" 형식으로 정리하고, 대화 그룹 사이에는 빈 줄
- 본문: 문단 사이에는 빈 줄
- 문법: 각 핵심 문법 블록을 아래 형식으로 정리
  [핵심문법 1] 문법 이름
  [설명] 핵심 규칙 설명
  [예문] 예문 1
  [예문] 예문 2
  (핵심 문법이 여러 개면 2, 3...으로 반복)
- 단어: 한 줄에 하나씩 "영어 | 뜻 | 품사" 형식으로 정리
- 읽기 어려운 부분은 [확인 필요]로 표시
- 빈 응답은 금지. 이미지에 보이는 글자를 최대한 그대로 옮기세요.
`;

  let text = '';
  try {
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: params.base64, mimeType: params.mimeType } },
    ]);
    text = extractGeminiText(result.response);
  } catch {
    text = '';
  }

  if (!text) {
    try {
      text = await generateImageTextWithRest(prompt, params);
    } catch {
      text = '';
    }
  }

  if (!text) {
    const retryPrompt = '이미지에서 보이는 모든 영어/한국어 텍스트를 OCR로 추출하세요. 설명 없이 추출된 텍스트만 줄바꿈을 유지해 출력하세요. 빈 응답은 금지입니다.';
    try {
      const retry = await model.generateContent([
        { text: retryPrompt },
        { inlineData: { data: params.base64, mimeType: params.mimeType } },
      ]);
      text = extractGeminiText(retry.response);
    } catch {
      text = '';
    }

    if (!text) {
      text = await generateImageTextWithRest(retryPrompt, params);
    }
  }

  if (!text) {
    throw new Error('Gemini returned empty OCR text.');
  }

  return text;
}

/**
 * 텍스트(대화문/본문/문법)에서 단어/문법 포인트 추출
 * temperature 0.2 — 일관된 JSON 출력 목적
 */
export async function parseContentWithAI(
  text: string,
  contentType: 'dialog' | 'reading' | 'grammar' | 'word',
  grade: string,
): Promise<ParsedContent> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: contentType === 'word' ? 8000 : 3000,
      thinkingConfig: { thinkingBudget: 0 },
    } as any,
  });

  const prompt = contentType === 'dialog' ? `
당신은 한국 중고등학교 영어 교재를 검수하는 교사입니다.
아래 텍스트는 학생들이 대화문별로 문제를 푸는 학습 자료입니다.

[텍스트 유형]: dialog
[대상 학년]: ${grade}
[텍스트]:
${text}

중요한 맥락:
- 대화문은 빈 줄 기준으로 여러 개의 대화 그룹으로 나뉩니다.
- 학생들은 각 대화문 그룹별로 독립적으로 문제를 풉니다.
- 따라서 단어/문법 목록을 뽑는 것이 아니라, 대화 그룹 구조가 보존되었는지 검수해야 합니다.

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "words": [],
  "grammarPoints": [],
  "summary": "대화문이 몇 개 그룹으로 구성되었는지, 그룹 구분이 적절한지, 학생 학습에 바로 사용할 수 있는지에 대한 한국어 검수 요약"
}

규칙:
- words는 반드시 빈 배열
- grammarPoints는 반드시 빈 배열
- summary에는 대화 그룹 개수와 검수 결과를 2~3문장으로 작성
- 대화 그룹 사이 빈 줄이 어색하거나 화자 표기가 무너지면 그 사실을 summary에 명시
` : contentType === 'reading' ? `
당신은 한국 중고등학교 영어 교재를 검수하는 교사입니다.
아래 텍스트는 학생들이 단락별로 나누어 문제를 푸는 본문 학습 자료입니다.

[텍스트 유형]: reading
[대상 학년]: ${grade}
[텍스트]:
${text}

중요한 맥락:
- 본문은 빈 줄 기준으로 단락이 나뉩니다.
- 학생들은 단락별로 문제를 풀며, 일반적으로 3개 파트 구성이 중요합니다.
- 따라서 단어/문법 목록을 뽑는 것이 아니라, 단락 구조가 보존되었는지 검수해야 합니다.

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "words": [],
  "grammarPoints": [],
  "summary": "본문이 몇 개 단락으로 구성되었는지, 단락 구분이 적절한지, 학생 학습에 바로 사용할 수 있는지에 대한 한국어 검수 요약"
}

규칙:
- words는 반드시 빈 배열
- grammarPoints는 반드시 빈 배열
- summary에는 단락 개수와 검수 결과를 2~3문장으로 작성
- 단락 구분이 3파트와 다르거나 문단 경계가 어색하면 그 사실을 summary에 명시
` : contentType === 'grammar' ? `
당신은 한국 중고등학교 영어 교재를 구조화하는 교사입니다.
아래 문법 텍스트에서 "핵심 문법", "설명", "예문"을 분리하세요.

[텍스트 유형]: grammar
[대상 학년]: ${grade}
[텍스트]:
${text}

중요한 맥락:
- 교재에는 보통 핵심 문법 2개 안팎이 있고, 각 문법마다 설명과 예문이 붙어 있습니다.
- 문장 순서대로 임의 8개를 뽑지 말고, 실제 핵심 문법 개수만 식별해야 합니다.
- grammarPoints에는 문법 이름만 넣고, 설명/예문은 grammarSections로 분리해야 합니다.

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "words": [],
  "grammarPoints": ["핵심 문법 1", "핵심 문법 2"],
  "grammarSections": [
    {
      "title": "핵심 문법 1",
      "explanation": "문법 규칙 설명",
      "examples": ["예문 1", "예문 2"]
    }
  ],
  "summary": "핵심 문법이 몇 개였는지, 설명과 예문이 얼마나 분리되었는지에 대한 한국어 검수 요약"
}

규칙:
- words는 반드시 빈 배열
- 핵심 문법 개수는 실제 텍스트 기준으로만 추출
- grammarPoints는 grammarSections의 title과 동일해야 함
- explanation은 규칙 설명만 요약
- examples는 원문 예문만 최대 5개까지
- 설명 없는 예문만 있는 경우 explanation은 빈 문자열 허용
- 예문이 없으면 examples는 빈 배열
` : `
당신은 한국 중고등학교 영어 교사입니다.
아래 영어 텍스트에서 ${grade} 수준의 학습 데이터를 추출하세요.

[텍스트 유형]: ${contentType}
[대상 학년]: ${grade}
[텍스트]:
${text}

다음 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "words": [
    {
      "word": "영어 단어",
      "pos": "품사(n./v./adj./adv.)",
      "ko": "한글 뜻",
      "def": "영영풀이 (15단어 이내)",
      "defKo": "영영풀이의 자연스러운 한국어 뜻",
      "syn": "유의어 1~2개",
      "grade": "${grade}"
    }
  ],
  "grammarPoints": ["문법 포인트 1", "문법 포인트 2"],
  "grammarSections": [],
  "summary": "텍스트 핵심 내용 1~2문장 한국어 요약"
}

규칙:
- words: ${contentType === 'word' ? `입력된 영어 단어/숙어를 누락 없이 전부 변환. 최대 ${WORD_UPLOAD_MAX_ITEMS}개까지 허용` : `${grade} 수준 핵심 어휘 최대 30개 (기본 단어 제외)`}
- 단어 항목의 defKo에는 def 문장을 한국어로 자연스럽게 풀어 쓴 뜻을 넣으세요. 단순히 ko를 반복하지 마세요.
- grammarPoints: 주요 문법 구조 최대 5개
- grammarSections: grammar가 아니면 반드시 빈 배열
- summary: 대화문/본문의 경우만 작성, 단어/문법이면 빈 문자열
- 텍스트 유형이 word이면 OCR의 줄마다 있는 영어 단어/숙어를 vocabulary item으로 보고 ko/pos/def/syn을 채우세요.
- 텍스트 유형이 word이면 입력 목록의 순서와 개수를 최대한 보존하고, 중간 단어를 임의로 생략하지 마세요.
`;

  let raw = '';
  try {
    const result = await model.generateContent(prompt);
    raw = extractGeminiText(result.response);
  } catch {
    raw = '';
  }

  if (!raw) {
    raw = await generateTextWithRest(prompt, {
      temperature: 0.2,
      maxOutputTokens: contentType === 'word' ? 8000 : 3000,
    });
  }

  try {
    const parsed = completeWordParsedContent(
      sanitizeParsedContent(parseJsonObject(raw), grade, contentType),
      text,
      contentType,
      grade,
    );
    if (parsed.words.length > 0 || parsed.grammarPoints.length > 0 || parsed.grammarSections.length > 0 || parsed.summary) {
      return parsed;
    }
  } catch {
    raw = await generateTextWithRest(prompt, {
      temperature: 0.2,
      maxOutputTokens: contentType === 'word' ? 8000 : 3000,
    });
    const parsed = completeWordParsedContent(
      sanitizeParsedContent(parseJsonObject(raw), grade, contentType),
      text,
      contentType,
      grade,
    );
    if (parsed.words.length > 0 || parsed.grammarPoints.length > 0 || parsed.grammarSections.length > 0 || parsed.summary) {
      return parsed;
    }
  }

  return buildParsedContentFallback(text, contentType, grade);
}

// ── 오답 유사 문제 생성 ──────────────────────────────────

export interface VerifyQuestion {
  question: string;
  choices:  string[];   // 4개 (T/F면 2개)
  correct:  number;     // 0-based
  explain:  string;
}

/**
 * 오답노트 기반으로 같은 유형 검증 문제 1개 생성
 */
export async function generateVerifyQuestion(
  originalQuestion: string,
  correctAnswer:    string,
  explanation:      string,
  questionType:     string,  // '문법' | '독해/본문'
): Promise<VerifyQuestion> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.4, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  const prompt = `
당신은 한국 중고등학교 영어 교사입니다.
아래 오답 정보를 보고, 학생이 정말 이해했는지 확인하는 검증 문제 1개를 만드세요.

[원래 문제]: ${originalQuestion}
[정답]: ${correctAnswer}
[해설 요약]: ${explanation}
[문제 유형]: ${questionType}

규칙:
- 원래 문제와 비슷한 유형이지만 다른 예문/지문 사용
- 4지선다 1개
- 너무 어렵지 않게 (이해했으면 맞출 수 있는 수준)

다음 JSON만 응답 (다른 텍스트 없이):
{
  "question": "문제 한국어",
  "choices": ["보기1", "보기2", "보기3", "보기4"],
  "correct": 0,
  "explain": "정답 해설 한국어"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(raw) as VerifyQuestion;
  } catch {
    // fallback 데모 문제
    return {
      question: `다음 중 현재완료(have/has + p.p.)가 올바르게 쓰인 문장은?`,
      choices: [
        'She have lived here for 10 years.',
        'I has never seen that movie.',
        'We have visited Paris twice.',
        'He have finished his homework.',
      ],
      correct: 2,
      explain: 'We have visited — 주어가 복수(We)이므로 have, 과거분사 visited 사용. 나머지는 have/has 오류.',
    };
  }
}

// ── 모의고사 동적 문항 생성 ──────────────────────────────

export type MockQType = 'grammar' | 'fill' | 'topic' | 'order_sentence' | 'reference';

export interface MockQuestion {
  id:       number;
  type:     MockQType;
  passage:  string;
  question: string;
  choices:  string[];
  correct:  number;
  explain:  string;
}

const TYPE_PROMPTS: Record<MockQType, string> = {
  grammar: `어법(grammar) 문제 1개를 만드세요.
영어 지문에 (A), (B) 빈칸을 만들고 어법에 맞는 것을 고르는 형식.
현재완료/분사구문/수동태/가정법/관계사 중 하나를 포함하세요.`,

  fill: `빈칸 완성(fill-in-the-blank) 문제 1개를 만드세요.
문맥에 맞는 단어/표현을 고르는 형식. 4지선다.
자연/과학/사회/문화 주제의 영어 지문을 사용하세요.`,

  topic: `주제·요지 파악 문제 1개를 만드세요.
80~120단어 영어 지문 후 주제/요지/제목/주장 중 하나를 묻는 형식. 4지선다(한국어 보기).`,

  order_sentence: `문장 순서 배열 문제 1개를 만드세요.
(A)(B)(C)(D) 4개 문장을 제시하고 올바른 순서를 고르는 형식. 4지선다.`,

  reference: `지칭 추론 문제 1개를 만드세요.
지문의 밑줄 친 대명사(it/they/them/her/his 등)가 가리키는 것을 고르는 형식. 4지선다(영어 보기).`,
};

/**
 * 약점 유형의 모의고사 문항 1개를 Gemini로 동적 생성
 */
export async function generateMockQuestion(
  type:    MockQType,
  id:      number,
  grade:   string = '중3',
): Promise<MockQuestion | null> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.5, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  const prompt = `
당신은 한국 ${grade} 내신 영어 시험 출제 전문가입니다.

${TYPE_PROMPTS[type]}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "id": ${id},
  "type": "${type}",
  "passage": "영어 지문 (order_sentence면 (A)(B)(C)(D) 포함)",
  "question": "질문 한국어",
  "choices": ["보기1", "보기2", "보기3", "보기4"],
  "correct": 0,
  "explain": "정답 해설 한국어 (2~3문장)"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(raw) as MockQuestion;
  } catch {
    return null;
  }
}
