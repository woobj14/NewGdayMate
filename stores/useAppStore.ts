// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachKey } from '../lib/gemini';

export type Role = 'student' | 'teacher' | 'admin';

export interface User {
  uid:         string;
  email:       string;
  displayName: string;
  avatar:      string;
  role:        Role;
  academyId?:  string;
  classId?:    string;
  grade?:      string;
  accountType: 'b2c' | 'b2b';
}

export interface WrongAnswer {
  id:             string;
  question:       string;
  myAnswer:       string;
  correctAnswer:  string;
  passageSnippet: string;
  contentId:      string;
  unitId:         string;
  type:           'grammar' | 'vocab' | 'reading';
  status:         'unresolved' | 'resolved';
  createdAt:      number;
}

export interface ChatMessage {
  role:    'user' | 'model';
  content: string;
  ts:      number;
}

interface AppState {
  // ── Auth ──
  user:         User | null;
  isLoading:    boolean;
  setUser:      (u: User | null) => void;
  setLoading:   (v: boolean) => void;

  // ── 학습 진도 ──
  xp:           number;
  streak:       number;
  level:        number;
  lastStudied:  string | null;  // ISO date string
  addXp:        (amount: number) => void;
  setStreak:    (n: number) => void;

  // ── AI 코치 ──
  selectedCoach:  CoachKey;
  chatHistory:    ChatMessage[];
  setCoach:       (c: CoachKey) => void;
  addChatMessage: (m: ChatMessage) => void;
  clearChat:      () => void;

  // ── 구독 ──
  isSubscribed:   boolean;
  setSubscribed:  (v: boolean) => void;

  // ── 오답 ──
  currentWrong:   WrongAnswer | null;
  setCurrentWrong: (w: WrongAnswer | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      user:      null,
      isLoading: true,
      setUser:    (u)  => set({ user: u }),
      setLoading: (v)  => set({ isLoading: v }),

      // 학습 진도
      xp:          0,
      streak:      0,
      level:       1,
      lastStudied: null,
      addXp: (amount) => {
        const newXp    = get().xp + amount;
        const newLevel = Math.floor(newXp / 400) + 1;
        set({ xp: newXp, level: newLevel, lastStudied: new Date().toISOString() });
      },
      setStreak: (n) => set({ streak: n }),

      // AI 코치
      selectedCoach:  'betty',
      chatHistory:    [],
      setCoach:       (c) => set({ selectedCoach: c, chatHistory: [] }),
      addChatMessage: (m) => set((s) => ({
        chatHistory: [...s.chatHistory.slice(-16), m], // 최근 8턴 유지
      })),
      clearChat: () => set({ chatHistory: [] }),

      // 구독
      isSubscribed:  false,
      setSubscribed: (v) => set({ isSubscribed: v }),

      // 오답
      currentWrong:    null,
      setCurrentWrong: (w) => set({ currentWrong: w }),
    }),
    {
      name:    'gdaymate-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        user:          s.user,
        xp:            s.xp,
        streak:        s.streak,
        level:         s.level,
        lastStudied:   s.lastStudied,
        selectedCoach: s.selectedCoach,
        isSubscribed:  s.isSubscribed,
      }),
    }
  )
);
