// ═══════════════════════════════════════════════════════════════
// 🏗️ PI팀 (Platform & Infrastructure) 소유 파일
// 원칙: 보안 규칙 · 오프라인 우선 · FCM 관리 · 환경변수 · 비용 최적화
// 수정 전 CLAUDE.md 확인 필수 | 보안 규칙 변경 시 즉시 배포 필수
// ═══════════════════════════════════════════════════════════════
/**
 * 오프라인 캐시 유틸
 *
 * 역할:
 *   1. 단어장 / 오답노트 / 진도 데이터를 AsyncStorage에 캐시
 *   2. 오프라인 중 발생한 진도 완료를 syncQueue에 적재
 *   3. 온라인 복귀 시 syncQueue를 Firestore에 flush
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// ── 캐시 키 네임스페이스 ───────────────────────────────
const KEYS = {
  wordbook:   (uid: string) => `@gdaymate:wordbook:${uid}`,
  wrongNotes: (uid: string) => `@gdaymate:wrongNotes:${uid}`,
  progress:   (uid: string) => `@gdaymate:progress:${uid}`,
  syncQueue:  (uid: string) => `@gdaymate:syncQueue:${uid}`,
};

// ── 동기화 큐 아이템 타입 ─────────────────────────────
export interface SyncItem {
  id:        string;   // uuid
  type:      'completeStep' | 'rateWord' | 'resolveNote';
  payload:   Record<string, unknown>;
  createdAt: string;   // ISO string
}

// ── 네트워크 상태 확인 ────────────────────────────────
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// ── 캐시 저장 ─────────────────────────────────────────
export async function saveCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // 저장 실패 무시 (오프라인 캐시는 best-effort)
  }
}

// ── 캐시 로드 ─────────────────────────────────────────
export async function loadCache<T>(
  key: string,
  maxAgeMs: number = 24 * 60 * 60 * 1000, // 기본 24시간
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null; // 만료
    return data as T;
  } catch {
    return null;
  }
}

// ── 동기화 큐 추가 ────────────────────────────────────
export async function enqueueSync(uid: string, item: Omit<SyncItem, 'id' | 'createdAt'>): Promise<void> {
  try {
    const key = KEYS.syncQueue(uid);
    const raw = await AsyncStorage.getItem(key);
    const queue: SyncItem[] = raw ? JSON.parse(raw) : [];
    queue.push({
      ...item,
      id:        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(key, JSON.stringify(queue));
  } catch {
    // 큐 실패 무시
  }
}

// ── 동기화 큐 조회 ────────────────────────────────────
export async function getSyncQueue(uid: string): Promise<SyncItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.syncQueue(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── 동기화 큐 항목 제거 ───────────────────────────────
export async function removeSyncItem(uid: string, itemId: string): Promise<void> {
  try {
    const key = KEYS.syncQueue(uid);
    const raw = await AsyncStorage.getItem(key);
    const queue: SyncItem[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter(i => i.id !== itemId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch {}
}

// ── 캐시 키 export ────────────────────────────────────
export { KEYS };

// ── 온라인 복귀 리스너 등록 ──────────────────────────
/**
 * 네트워크 복귀 시 콜백 실행
 * Returns unsubscribe function
 */
export function onNetworkRestore(callback: () => void): () => void {
  let wasOffline = false;

  const unsubscribe = NetInfo.addEventListener(state => {
    const online = state.isConnected === true;
    if (!online) {
      wasOffline = true;
    } else if (wasOffline && online) {
      wasOffline = false;
      callback();
    }
  });

  return unsubscribe;
}
