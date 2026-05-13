// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import {
  collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';
import { streamCoachResponse } from '../lib/gemini';
import { KEYS, loadCache, saveCache } from '../lib/offlineCache';
import { WrongReason } from '../stores/useAppStore';

export const WRONG_REASON_LABEL: Record<WrongReason, string> = {
  vocab_gap: '단어 부족',
  grammar_confusion: '문법 개념 혼동',
  sentence_parsing: '문장 해석 실패',
  choice_trap: '선지 비교 실수',
  time_pressure: '시간 부족',
  evidence_miss: '근거 찾기 실패',
};

export interface WrongNote {
  id:             string;
  // 문제 정보
  question:       string;       // 문제 원문
  questionType:   string;       // 객관식 지문 or 서술형 등
  myAnswer:       string;       // 내 답
  correctAnswer:  string;       // 정답
  passageSnippet: string;       // 관련 지문 스니펫
  explanation:    string;       // 정답 해설 (교재 제공)
  // 분류
  type:           'grammar' | 'reading';  // 단어 제외
  wrongReason:    WrongReason;
  contentId:      string;
  unitId:         string;
  // AI 선생님 해설
  teacherExplain: string;       // AI 선생님 해설 (스트리밍)
  explainStatus:  'none' | 'loading' | 'done';
  // 상태
  status:         'unresolved' | 'resolved';
  savedAt:        Date;
  resolvedAt:     Date | null;
}

function inferWrongReason(params: {
  type: 'grammar' | 'reading';
  questionType: string;
  myAnswer: string;
  passageSnippet: string;
}) {
  const questionType = params.questionType.toLowerCase();
  const myAnswer = params.myAnswer.trim();

  if (!myAnswer || myAnswer === '미응답') return 'time_pressure' as WrongReason;
  if (params.type === 'grammar' || questionType.includes('문법') || questionType.includes('어법')) {
    return 'grammar_confusion' as WrongReason;
  }
  if (questionType.includes('순서') || questionType.includes('주제') || questionType.includes('요지') || questionType.includes('제목')) {
    return 'evidence_miss' as WrongReason;
  }
  if (questionType.includes('지칭') || questionType.includes('추론') || questionType.includes('참조')) {
    return 'choice_trap' as WrongReason;
  }
  if (questionType.includes('빈칸') || params.passageSnippet.length > 70) {
    return 'sentence_parsing' as WrongReason;
  }
  return 'vocab_gap' as WrongReason;
}

export function useWrongNote() {
  const { user, selectedCoach } = useAppStore();
  const [notes,   setNotes]   = useState<WrongNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState<string | null>(null); // 현재 스트리밍 중인 noteId
  const isLocalOnlySession = user?.uid === 'local-admin';

  useEffect(() => {
    let unsub: (() => void) | undefined;

    async function bootstrap() {
      if (!user) {
        setNotes([]);
        setLoading(false);
        return;
      }

      const cachedNotes = await loadCache<WrongNote[]>(
        KEYS.wrongNotes(user.uid),
        30 * 24 * 60 * 60 * 1000
      );
      if (cachedNotes) {
        setNotes(cachedNotes.map(note => ({
          ...note,
          wrongReason: note.wrongReason ?? inferWrongReason({
            type: note.type,
            questionType: note.questionType,
            myAnswer: note.myAnswer,
            passageSnippet: note.passageSnippet,
          }),
          savedAt: new Date(note.savedAt),
          resolvedAt: note.resolvedAt ? new Date(note.resolvedAt) : null,
        })));
      } else {
        setNotes([]);
      }

      if (isLocalOnlySession) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'users', user.uid, 'wrongNotes'),
        orderBy('savedAt', 'desc')
      );
      unsub = onSnapshot(q, snap => {
        const nextNotes = snap.docs.map(d => {
          const data = d.data();
          return {
            id:             d.id,
            question:       data.question ?? '',
            questionType:   data.questionType ?? '객관식',
            myAnswer:       data.myAnswer ?? '',
            correctAnswer:  data.correctAnswer ?? '',
            passageSnippet: data.passageSnippet ?? '',
            explanation:    data.explanation ?? '',
            type:           data.type ?? 'grammar',
            wrongReason:    data.wrongReason ?? inferWrongReason({
              type: data.type ?? 'grammar',
              questionType: data.questionType ?? '객관식',
              myAnswer: data.myAnswer ?? '',
              passageSnippet: data.passageSnippet ?? '',
            }),
            contentId:      data.contentId ?? '',
            unitId:         data.unitId ?? '',
            teacherExplain: data.teacherExplain ?? '',
            explainStatus:  data.teacherExplain ? 'done' : 'none',
            status:         data.status ?? 'unresolved',
            savedAt:        data.savedAt?.toDate() ?? new Date(),
            resolvedAt:     data.resolvedAt?.toDate() ?? null,
          } as WrongNote;
        });
        setNotes(nextNotes);
        saveCache(KEYS.wrongNotes(user.uid), nextNotes);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    }

    setLoading(true);
    bootstrap();

    return () => {
      unsub?.();
    };
  }, [user, isLocalOnlySession]);

  /** 오답 저장 (단어 퀴즈 제외 — grammar/reading만) */
  const saveWrongNote = useCallback(async (params: {
    question: string; questionType: string;
    myAnswer: string; correctAnswer: string;
    passageSnippet: string; explanation: string;
    type: 'grammar' | 'reading';
    contentId: string; unitId: string;
  }) => {
    if (!user) return null;
    const wrongReason = inferWrongReason(params);
    if (isLocalOnlySession) {
      const localNote: WrongNote = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        ...params,
        wrongReason,
        teacherExplain: '',
        explainStatus: 'none',
        status: 'unresolved',
        savedAt: new Date(),
        resolvedAt: null,
      };
      const nextNotes = [localNote, ...notes].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
      setNotes(nextNotes);
      await saveCache(KEYS.wrongNotes(user.uid), nextNotes);
      return localNote.id;
    }

    const ref = await addDoc(collection(db, 'users', user.uid, 'wrongNotes'), {
      ...params,
      wrongReason,
      teacherExplain: '',
      status: 'unresolved',
      savedAt: serverTimestamp(),
      resolvedAt: null,
    });
    return ref.id;
  }, [user, isLocalOnlySession, notes]);

  /** AI 선생님 해설 생성 (Gemini 스트리밍) */
  const generateExplain = useCallback(async (note: WrongNote) => {
    if (!user || streaming) return;
    setStreaming(note.id);

    // 로컬 상태 먼저 업데이트
    setNotes(prev => prev.map(n =>
      n.id === note.id ? { ...n, explainStatus: 'loading', teacherExplain: '' } : n
    ));

    const wrongCtx = [
      `[문제] ${note.question}`,
      `[지문] ${note.passageSnippet}`,
      `[학생 답] ${note.myAnswer}`,
      `[정답] ${note.correctAnswer}`,
      `[교재 해설] ${note.explanation}`,
    ].join('\n');

    const prompt =
      '위 오답 문제를 학생이 이해할 수 있게 단계별로 해설해줘. ' +
      '왜 학생의 답이 틀렸는지 먼저 설명하고, 정답 이유를 예시와 함께 알려줘. ' +
      '마지막에 비슷한 문제에서 주의할 점 한 가지를 알려줘.';

    let full = '';
    await streamCoachResponse({
      coach: selectedCoach,
      question: prompt,
      history: [],
      wrongCtx,
      onChunk: (text) => {
        full = text;
        setNotes(prev => prev.map(n =>
          n.id === note.id ? { ...n, teacherExplain: text, explainStatus: 'loading' } : n
        ));
      },
      onDone: async (finalText) => {
        let nextNotes: WrongNote[] = [];
        setNotes(prev => {
          nextNotes = prev.map(n =>
            n.id === note.id ? { ...n, teacherExplain: finalText, explainStatus: 'done' as const } : n
          );
          return nextNotes;
        });
        await saveCache(KEYS.wrongNotes(user.uid), nextNotes);

        if (!isLocalOnlySession) {
          await updateDoc(doc(db, 'users', user.uid, 'wrongNotes', note.id), {
            teacherExplain: finalText,
          });
        }
        setStreaming(null);
      },
      onError: (err) => {
        console.error('[useWrongNote] 해설 생성 오류:', err);
        setStreaming(null);
      },
    });
  }, [user, selectedCoach, streaming, notes, isLocalOnlySession]);

  /** 오답 해결 처리 */
  const resolveNote = useCallback(async (noteId: string) => {
    if (!user) return;
    const resolvedAt = new Date();
    const nextNotes: WrongNote[] = notes.map(note =>
      note.id === noteId ? { ...note, status: 'resolved' as const, resolvedAt } : note
    );
    setNotes(nextNotes);
    await saveCache(KEYS.wrongNotes(user.uid), nextNotes);

    if (isLocalOnlySession) return;

    await updateDoc(doc(db, 'users', user.uid, 'wrongNotes', noteId), {
      status: 'resolved',
      resolvedAt: serverTimestamp(),
    });
  }, [user, notes, isLocalOnlySession]);

  const unresolvedCount = notes.filter(n => n.status === 'unresolved').length;
  const wrongReasonCounts = notes.reduce<Record<WrongReason, number>>((acc, note) => {
    acc[note.wrongReason] += 1;
    return acc;
  }, {
    vocab_gap: 0,
    grammar_confusion: 0,
    sentence_parsing: 0,
    choice_trap: 0,
    time_pressure: 0,
    evidence_miss: 0,
  });
  const topWrongReason = (Object.entries(wrongReasonCounts) as Array<[WrongReason, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[1]
      ? (Object.entries(wrongReasonCounts) as Array<[WrongReason, number]>).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    notes, loading, streaming,
    unresolvedCount,
    wrongReasonCounts,
    topWrongReason,
    saveWrongNote, generateExplain, resolveNote,
  };
}
