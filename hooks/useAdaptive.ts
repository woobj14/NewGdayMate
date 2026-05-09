// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 + 🏗️ PI팀 — 적응형 학습 훅
// 퀴즈 정답/오답 로그 → 약점 유형 분석 → Gemini 프롬프트 강화
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, getDocs, query,
  where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';

// ── 타입 ──────────────────────────────────────────────────────
export interface AnswerLog {
  uid:         string;
  lessonId:    string;
  stepIndex:   number;
  questionId:  number;
  kind:        'mc' | 'tf' | 'fill' | 'typing';
  correct:     boolean;
  timeMs:      number;   // 풀이 소요 시간 (ms)
  questionType: string;  // 'grammar_active_passive' | 'reading_inference' 등
  createdAt:   any;
}

export interface WeakProfile {
  // 유형별 오답률 (0~1)
  rates: Record<string, number>;
  // 가장 약한 유형 TOP 3
  top3weak: string[];
  // 적응형 난이도 (1=쉬움, 2=중간, 3=어려움)
  diffLevel: 1 | 2 | 3;
  // Gemini 프롬프트에 주입할 문자열
  promptCtx: string;
}

// 문제 유형 분류 태그
export const Q_TYPE_MAP: Record<string, string> = {
  tf:              '사실 확인 (T/F)',
  mc_inference:    '추론 (빈칸/순서/주제)',
  mc_grammar:      '어법 (MC)',
  fill_grammar:    '어법 빈칸 완성',
  fill_expression: '표현 빈칸 완성',
  typing:          '표현 직접 쓰기',
  mc_detail:       '세부 내용 파악',
  mc_emotion:      '감정/의도 분석',
};

export function useAdaptive(lessonId?: string) {
  const { user } = useAppStore();
  const [weakProfile, setWeakProfile] = useState<WeakProfile>({
    rates: {}, top3weak: [], diffLevel: 2,
    promptCtx: '',
  });
  const [logBuffer, setLogBuffer] = useState<Omit<AnswerLog,'uid'|'createdAt'>[]>([]);

  // ── 최근 로그 로드 → 약점 프로파일 계산 ──────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'users', user.uid, 'answerLogs'),
          orderBy('createdAt', 'desc'),
          limit(200),
        ));

        // 유형별 집계
        const byType: Record<string, { right:number; total:number }> = {};
        snap.docs.forEach(d => {
          const log = d.data() as AnswerLog;
          const t = log.questionType ?? 'mc_detail';
          if (!byType[t]) byType[t] = { right:0, total:0 };
          byType[t].total++;
          if (log.correct) byType[t].right++;
        });

        // 오답률 계산
        const rates: Record<string, number> = {};
        Object.entries(byType).forEach(([t, {right, total}]) => {
          if (total >= 3) rates[t] = 1 - right/total;
        });

        // 약점 TOP 3
        const top3weak = Object.entries(rates)
          .filter(([,r]) => r > 0.3)
          .sort((a,b) => b[1]-a[1])
          .slice(0,3)
          .map(([t]) => t);

        // 전체 정답률로 난이도 결정
        const totalRight  = snap.docs.filter(d=>d.data().correct).length;
        const totalAll    = snap.docs.length;
        const overallAcc  = totalAll > 0 ? totalRight/totalAll : 0.7;
        const diffLevel   = overallAcc > 0.8 ? 3 : overallAcc > 0.55 ? 2 : 1;

        // Gemini 프롬프트 컨텍스트
        const promptCtx = top3weak.length > 0
          ? `[학생 약점 분석]\n이 학생이 특히 취약한 유형:\n${top3weak.map(t=>`- ${Q_TYPE_MAP[t]??t}: 오답률 ${Math.round((rates[t]??0)*100)}%`).join('\n')}\n→ 위 유형의 문제를 전체의 40% 이상 출제하고, 해설을 특히 자세하게 작성하세요.`
          : '';

        setWeakProfile({ rates, top3weak, diffLevel, promptCtx });
      } catch { /* 오프라인 — 기본 프로파일 유지 */ }
    })();
  }, [user?.uid]);

  // ── 정답/오답 로그 기록 ────────────────────────────────────────
  const logAnswer = useCallback((
    questionId:   number,
    kind:         AnswerLog['kind'],
    correct:      boolean,
    timeMs:       number,
    questionType: string,
    stepIndex:    number,
  ) => {
    if (!lessonId) return;
    const entry = { lessonId, stepIndex, questionId, kind, correct, timeMs, questionType };
    setLogBuffer(prev => [...prev, entry]);
  }, [lessonId]);

  // ── 버퍼 → Firestore flush (단계 완료 시 호출) ───────────────
  const flushLogs = useCallback(async () => {
    if (!user?.uid || logBuffer.length === 0) return;
    try {
      const col = collection(db, 'users', user.uid, 'answerLogs');
      await Promise.all(logBuffer.map(entry =>
        addDoc(col, { ...entry, uid:user.uid, createdAt:serverTimestamp() })
      ));
      setLogBuffer([]);
    } catch { /* 오프라인 — 로그 손실 허용 (비필수 데이터) */ }
  }, [user?.uid, logBuffer]);

  // ── 적응형 난이도 레이블 ──────────────────────────────────────
  const diffLabel = weakProfile.diffLevel === 1 ? '기초' : weakProfile.diffLevel === 3 ? '심화' : '표준';

  return { weakProfile, logAnswer, flushLogs, diffLabel };
}
