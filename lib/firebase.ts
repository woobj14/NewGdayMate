// ═══════════════════════════════════════════════════════════════
// 🏗️ PI팀 (Platform & Infrastructure) 소유 파일
// 원칙: 보안 규칙 · 오프라인 우선 · FCM 관리 · 환경변수 · 비용 최적화
// 수정 전 CLAUDE.md 확인 필수 | 보안 규칙 변경 시 즉시 배포 필수
// ═══════════════════════════════════════════════════════════════
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions }  from 'firebase/functions';

function normalizeEnv(value?: string) {
  if (!value) return '';
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

const isServer = typeof window === 'undefined';

const firebaseConfig = {
  apiKey:            normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain:        normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId:         normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket:     normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId:             normalizeEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);
const app = hasFirebaseConfig
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

function initFirestore(): Firestore {
  if (!app) {
    throw new Error('Firebase config is missing.');
  }
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true,
    });
  } catch {
    return getFirestore(app);
  }
}

export const auth = (!isServer && app ? getAuth(app) : null) as Auth;
export const db = (!isServer && app ? initFirestore() : null) as Firestore;
export const storage = (!isServer && app ? getStorage(app) : null) as FirebaseStorage;
export const functions = (!isServer && app ? getFunctions(app, 'asia-northeast3') : null) as Functions;

// Firestore 컬렉션 레퍼런스 헬퍼
import { collection, doc } from 'firebase/firestore';

export const refs = {
  users:        (uid: string)                    => doc(db, 'users', uid),
  progress:     (uid: string, unitId: string)    => doc(db, 'users', uid, 'progress', unitId),
  wordbook:     (uid: string, wordId: string)    => doc(db, 'users', uid, 'wordbook', wordId),
  wrongNotes:   (uid: string)                    => collection(db, 'users', uid, 'wrongNotes'),
  wrongNote:    (uid: string, id: string)        => doc(db, 'users', uid, 'wrongNotes', id),
  feed:         (uid: string)                    => collection(db, 'users', uid, 'feed'),
  academies:    (academyId: string)              => doc(db, 'academies', academyId),
  classes:      (academyId: string, classId: string) => doc(db, 'academies', academyId, 'classes', classId),
  content:      (contentId: string)             => doc(db, 'content', contentId),
  leaderboard:  (classId: string)               => doc(db, 'leaderboards', classId),
  messages:     ()                              => collection(db, 'messages'),
};
