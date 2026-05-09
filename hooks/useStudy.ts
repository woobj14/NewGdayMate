// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useCallback } from 'react';
import { setDoc, increment, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { differenceInDays, startOfDay } from 'date-fns';
import { db, refs } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';

export type ActivityType = 'word_quiz' | 'grammar' | 'reading' | 'mock_exam' | 'speaking' | 'coach_chat';

const XP_MAP: Record<ActivityType, number> = {
  word_quiz:  20,
  grammar:    30,
  reading:    40,
  mock_exam:  80,
  speaking:   30,
  coach_chat: 10,
};

export function useStudy() {
  const { user, xp, streak, lastStudied, addXp, setStreak } = useAppStore();

  const completeActivity = useCallback(async (
    type: ActivityType,
    overrideXp?: number
  ) => {
    if (!user) return;

    const reward   = overrideXp ?? XP_MAP[type];
    const today    = startOfDay(new Date()).toISOString();
    const lastDate = lastStudied ? startOfDay(new Date(lastStudied)) : null;
    const dayDiff  = lastDate ? differenceInDays(new Date(), lastDate) : 999;

    // Streak 계산
    let newStreak = streak;
    if (dayDiff === 1) newStreak = streak + 1;
    else if (dayDiff > 1) newStreak = 1;
    // dayDiff === 0: 오늘 이미 했으니 streak 유지

    // 로컬 상태 업데이트
    addXp(reward);
    setStreak(newStreak);

    try {
      // 문서가 없는 테스트/신규 계정도 학습 흐름이 끊기지 않도록 병합 저장
      await setDoc(refs.users(user.uid), {
        xp:            increment(reward),
        lastStudiedAt: serverTimestamp(),
        streak:        newStreak,
      }, { merge: true });

      // 활동 기록 로그
      await addDoc(collection(db, 'users', user.uid, 'activityLog'), {
        type, xpEarned: reward, streak: newStreak,
        ts: serverTimestamp(),
      });
    } catch (error) {
      console.warn('Failed to persist study activity:', error);
    }

    return { reward, newStreak };
  }, [user, streak, lastStudied, addXp, setStreak]);

  // 오답 기록 저장
  const recordWrongAnswer = useCallback(async (params: {
    question: string; myAnswer: string; correctAnswer: string;
    passageSnippet: string; contentId: string; unitId: string;
    type: 'grammar' | 'vocab' | 'reading';
  }) => {
    if (!user) return;
    await addDoc(refs.wrongNotes(user.uid), {
      ...params, status: 'unresolved',
      savedAt: serverTimestamp(),
      resolvedAt: null,
    });
  }, [user]);

  // SM-2 단어 복습 간격 계산
  const calcNextReview = useCallback((
    easeFactor: number, interval: number,
    repetitions: number, rating: 0 | 1 | 2 | 3
  ) => {
    let ef = easeFactor, ivl = interval, reps = repetitions;
    if (rating >= 2) {
      ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(ivl * ef);
      reps++;
    } else {
      ivl = 1; reps = 0;
    }
    ef = Math.max(1.3, ef + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
    const status = rating >= 3 ? '외움' : rating >= 2 ? '햇갈림' : '모름';
    return { easeFactor: ef, interval: ivl, repetitions: reps, status };
  }, []);

  return { completeActivity, recordWrongAnswer, calcNextReview };
}
