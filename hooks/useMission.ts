// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 — 일일 미션 훅
// 매일 자정 리셋 · Firestore 저장 · XP 보상
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';

export interface Mission {
  id:          string;
  emoji:       string;
  title:       string;
  desc:        string;
  target:      number;
  current:     number;
  xpReward:    number;
  completed:   boolean;
  type:        'quiz' | 'word' | 'study_time' | 'streak' | 'wrong_resolve';
}

// 오늘 날짜 키 (YYYY-MM-DD)
const todayKey = () => new Date().toISOString().slice(0, 10);

// 일일 미션 풀 — 매일 3개 랜덤 선택
const MISSION_POOL: Omit<Mission, 'current' | 'completed'>[] = [
  { id:'q10',  emoji:'🎯', title:'퀴즈 10문항 풀기',       desc:'어떤 학습이든 10문항 풀기',    target:10,  xpReward:50,  type:'quiz'          },
  { id:'q25',  emoji:'🔥', title:'퀴즈 25문항 풀기',       desc:'집중해서 25문항 도전!',        target:25,  xpReward:100, type:'quiz'          },
  { id:'w5',   emoji:'📗', title:'단어 5개 저장',           desc:'단어장에 5개 저장하기',         target:5,   xpReward:30,  type:'word'          },
  { id:'w10',  emoji:'📖', title:'단어 복습 10개',          desc:'SM-2 복습 단어 10개 완료',      target:10,  xpReward:60,  type:'word'          },
  { id:'s1',   emoji:'⭐', title:'1단계 완료',              desc:'어떤 자료든 1단계 완료',        target:1,   xpReward:40,  type:'study_time'    },
  { id:'s3',   emoji:'🏆', title:'3단계 연속 완료',         desc:'같은 자료에서 3단계 연속!',     target:3,   xpReward:120, type:'study_time'    },
  { id:'wr1',  emoji:'✅', title:'오답 1개 해결',           desc:'오답노트 문제 1개 검증 통과',   target:1,   xpReward:50,  type:'wrong_resolve' },
  { id:'wr3',  emoji:'💪', title:'오답 3개 해결',           desc:'오답노트 3개 검증 통과!',       target:3,   xpReward:130, type:'wrong_resolve' },
  { id:'str7', emoji:'🔥', title:'7일 연속 유지',           desc:'streak 7일 이상 유지하기',     target:7,   xpReward:80,  type:'streak'        },
];

function pickDailyMissions(seed: string): Omit<Mission, 'current' | 'completed'>[] {
  // 날짜 기반 시드로 매일 같은 3개 선택 (같은 날 접속하면 동일 미션)
  const hash = seed.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const idx1 = hash % MISSION_POOL.length;
  const idx2 = (hash * 3) % MISSION_POOL.length;
  const idx3 = (hash * 7) % MISSION_POOL.length;
  const picked = new Set([idx1]);
  let i2 = idx2; while (picked.has(i2)) i2 = (i2+1)%MISSION_POOL.length;
  picked.add(i2);
  let i3 = idx3; while (picked.has(i3)) i3 = (i3+1)%MISSION_POOL.length;
  return [MISSION_POOL[idx1], MISSION_POOL[i2], MISSION_POOL[i3]];
}

export function useMission() {
  const { user, addXp } = useAppStore();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading,  setLoading]  = useState(true);

  // 오늘의 미션 로드
  useEffect(() => {
    if (!user?.uid) return;
    const key = todayKey();
    const docRef = doc(db, 'users', user.uid, 'missions', key);

    (async () => {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setMissions(snap.data().missions as Mission[]);
        } else {
          // 오늘 첫 접속 → 미션 생성
          const base = pickDailyMissions(user.uid + key);
          const newMissions: Mission[] = base.map(m => ({
            ...m, current:0, completed:false,
          }));
          await setDoc(docRef, { missions:newMissions, date:key });
          setMissions(newMissions);
        }
      } catch {
        // 오프라인 fallback
        const base = pickDailyMissions((user.uid??'x') + key);
        setMissions(base.map(m => ({ ...m, current:0, completed:false })));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  // 미션 진행도 업데이트
  const updateMission = useCallback(async (type: Mission['type'], increment=1) => {
    if (!user?.uid) return;
    const key = todayKey();
    const docRef = doc(db, 'users', user.uid, 'missions', key);

    setMissions(prev => {
      const updated = prev.map(m => {
        if (m.type !== type || m.completed) return m;
        const next = Math.min(m.current + increment, m.target);
        const justCompleted = next >= m.target && !m.completed;
        if (justCompleted) addXp(m.xpReward);
        return { ...m, current:next, completed: next >= m.target };
      });
      // Firestore 비동기 저장
      updateDoc(docRef, { missions:updated }).catch(()=>{});
      return updated;
    });
  }, [user?.uid]);

  const completedCount = missions.filter(m => m.completed).length;
  const totalXp        = missions.filter(m => m.completed).reduce((a,m) => a+m.xpReward, 0);

  return { missions, loading, updateMission, completedCount, totalXp };
}
