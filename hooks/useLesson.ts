// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, query,
  where, setDoc,
  serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';
import { LessonContent, LessonProgress } from '../types/lesson';
import {
  isOnline, saveCache, loadCache, enqueueSync,
  getSyncQueue, removeSyncItem, onNetworkRestore, KEYS,
} from '../lib/offlineCache';

export function useLesson() {
  const { user } = useAppStore();

  // 배정된 학습 자료 목록 (선생님이 배포한 것)
  const [lessons,  setLessons]  = useState<LessonContent[]>([]);
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({});
  const [loading,  setLoading]  = useState(true);

  // 자료 목록 구독
  useEffect(() => {
    if (!user || !user.academyId) return;

    // 학원에 배포된 자료 조회
    const q = query(
      collection(db, 'content'),
      where('academyId', '==', user.academyId)
    );

    const unsub = onSnapshot(q, snap => {
      const nextLessons = snap.docs
        .map(d => ({
          id:         d.id,
          title:      d.data().title ?? '',
          publisher:  d.data().publisher ?? '',
          author:     d.data().author ?? '',
          grade:      d.data().grade ?? '',
          unit:       d.data().unit ?? '',
          type:       d.data().type ?? 'dialog',
          wordCount:  d.data().wordCount ?? 0,
          stepCount:  d.data().stepCount ?? 6,
          quizCount:  d.data().quizCount ?? 20,
          assignedBy: d.data().assignedBy ?? '',
          academyId:  d.data().academyId ?? '',
          createdAt:  d.data().createdAt?.toDate() ?? new Date(),
        } as LessonContent))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setLessons(nextLessons);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // 진도 구독
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'users', user.uid, 'progress');
    const unsub = onSnapshot(q, snap => {
      const map: Record<string, LessonProgress> = {};
      snap.docs.forEach(d => {
        map[d.id] = {
          lessonId:       d.id,
          completedSteps: d.data().completedSteps ?? [],
          xpEarned:       d.data().xpEarned ?? 0,
          lastStudied:    d.data().lastStudied?.toDate() ?? new Date(),
          status:         d.data().status ?? 'not_started',
        };
      });
      setProgress(map);
    });
    return unsub;
  }, [user]);

  // 단계 완료 처리
  const completeStep = useCallback(async (
    lessonId: string,
    stepIndex: number,
    xpReward: number,
    totalSteps: number,
  ) => {
    if (!user) return;

    // 로컬 진도 즉시 업데이트 (낙관적 업데이트)
    setProgress(prev => {
      const existing = prev[lessonId];
      const prevSteps: number[] = existing?.completedSteps ?? [];
      const completedSteps = Array.from(new Set([...prevSteps, stepIndex]));
      const isAllDone = completedSteps.length >= totalSteps;
      const updated = {
        ...existing,
        lessonId,
        completedSteps,
        xpEarned: (existing?.xpEarned ?? 0) + xpReward,
        status: (isAllDone ? 'completed' : 'in_progress') as LessonProgress['status'],
      };
      const newMap = { ...prev, [lessonId]: updated };
      // 캐시 저장 (비동기)
      saveCache(KEYS.progress(user.uid), newMap);
      return newMap;
    });

    // 온라인이면 Firestore 즉시 저장, 오프라인이면 큐에 적재
    const online = await isOnline();
    if (online) {
      try {
        const ref = doc(db, 'users', user.uid, 'progress', lessonId);
        const snap = await getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;
        const prevSteps: number[] = existing?.completedSteps ?? [];
        const completedSteps = Array.from(new Set([...prevSteps, stepIndex]));
        const isAllDone = completedSteps.length >= totalSteps;
        const prevXp: number = existing?.xpEarned ?? 0;
        await setDoc(ref, {
          lessonId,
          completedSteps,
          xpEarned:    prevXp + xpReward,
          lastStudied: serverTimestamp(),
          status:      isAllDone ? 'completed' : 'in_progress',
        }, { merge: true });
      } catch {
        // Firestore 실패 → 큐에 적재
        await enqueueSync(user.uid, {
          type: 'completeStep',
          payload: { lessonId, stepIndex, xpReward, totalSteps },
        });
      }
    } else {
      // 오프라인 → 동기화 큐에 적재
      await enqueueSync(user.uid, {
        type: 'completeStep',
        payload: { lessonId, stepIndex, xpReward, totalSteps },
      });
    }
  }, [user]);

  // 진도율 계산 헬퍼
  const getPct = useCallback((lessonId: string, totalSteps: number): number => {
    const p = progress[lessonId];
    if (!p || p.completedSteps.length === 0) return 0;
    return Math.round((p.completedSteps.length / totalSteps) * 100);
  }, [progress]);

  /**
   * 해당 레슨의 선수 조건 충족 여부 반환
   * - word/reading 타입: 선수 조건 없음 (항상 true)
   * - dialog/grammar: 같은 academyId + 같은 unit의 word 자료가 completed여야 true
   */
  const isPrereqMet = useCallback((lesson: LessonContent): boolean => {
    if (lesson.type === 'word' || lesson.type === 'reading') return true;

    // 같은 단원의 단어 자료 찾기
    const wordLesson = lessons.find(
      l => l.type === 'word'
        && l.unit === lesson.unit
        && l.academyId === lesson.academyId
    );

    // 단어 자료가 없으면 잠금 없이 허용
    if (!wordLesson) return true;

    const wordProgress = progress[wordLesson.id];
    // Step 1(뜻맞추기 index 0) + Step 2(철자맞추기 index 1) 완료 시 해제
    const completed = wordProgress?.completedSteps ?? [];
    return completed.includes(0) && completed.includes(1);
  }, [lessons, progress]);

  // 온라인 복귀 시 동기화 큐 flush
  useEffect(() => {
    if (!user) return;
    const unsubNet = onNetworkRestore(async () => {
      const queue = await getSyncQueue(user.uid);
      for (const item of queue) {
        try {
          if (item.type === 'completeStep') {
            const { lessonId, stepIndex, xpReward, totalSteps } = item.payload as any;
            await completeStep(lessonId, stepIndex, xpReward, totalSteps);
          }
          await removeSyncItem(user.uid, item.id);
        } catch {
          // 개별 항목 실패 시 다음으로 진행
        }
      }
    });
    return () => unsubNet();
  }, [user, completeStep]);

  return { lessons, progress, loading, completeStep, getPct, isPrereqMet };
}
