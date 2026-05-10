// ═══════════════════════════════════════════════════════════════
// 🏗️ PI팀 (Platform & Infrastructure) 소유 파일
// 원칙: 보안 규칙 · 오프라인 우선 · FCM 관리 · 환경변수 · 비용 최적화
// 수정 전 CLAUDE.md 확인 필수 | 보안 규칙 변경 시 즉시 배포 필수
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as SplashScreen from 'expo-splash-screen';
import { auth, refs } from '../lib/firebase';
import { useAppStore, User, Role } from '../stores/useAppStore';

SplashScreen.preventAutoHideAsync();

const ROLE_ROUTES: Record<Role, string> = {
  student: '/student-home',
  teacher: '/teacher-home',
  admin:   '/admin-home',
};

const LOCAL_ADMIN_ID = 'admin';
const LOCAL_ADMIN_PASSWORD = '120112';
const LOCAL_ADMIN_UID = 'local-admin';
const LOCAL_ADMIN_ACADEMY_ID = 'academy-smart1';
const LOCAL_ADMIN_CLASS_ID = 'class-demo';
const PROFILE_TIMEOUT_MS = 15000;

function isLocalAdminEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function isLocalAdminUser(user: User | null) {
  return user?.uid === LOCAL_ADMIN_UID;
}

function createLocalAdminUser(role: Role): User {
  const label: Record<Role, string> = {
    admin: '관리자',
    teacher: '관리자 테스트 선생님',
    student: '관리자 테스트 학생',
  };

  return {
    uid: LOCAL_ADMIN_UID,
    email: 'admin@gdaymate.local',
    displayName: label[role],
    avatar: role === 'admin' ? 'A' : role === 'teacher' ? 'T' : '🦊',
    role,
    academyId: LOCAL_ADMIN_ACADEMY_ID,
    classId: LOCAL_ADMIN_CLASS_ID,
    accountType: 'b2b',
    ...(role === 'student' || role === 'teacher' ? { grade: '중3' } : {}),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Timed out while saving the user profile.');
      (error as any).code = code;
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function useAuth(options: { route?: boolean } = {}) {
  const { route = false } = options;
  const router  = useRouter();
  const pathname = usePathname();
  const { user, isLoading, setUser, setLoading } = useAppStore();
  const isLocalAdminSession = isLocalAdminEnabled() && isLocalAdminUser(user);
  // auth 상태 변경마다 1회만 라우팅
  const routed = useRef(false);

  // Firebase Auth 구독 (최초 마운트 1회)
  useEffect(() => {
    if (!route) return;
    if (!auth) {
      routed.current = false;
      if (!isLocalAdminUser(useAppStore.getState().user)) {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      routed.current = false; // 상태 바뀔 때마다 재라우팅 허용
      if (!firebaseUser) {
        if (!isLocalAdminUser(useAppStore.getState().user)) {
          setUser(null);
        }
        setLoading(false);
        return;
      }
      try {
        const snap = await withTimeout(
          getDoc(refs.users(firebaseUser.uid)),
          PROFILE_TIMEOUT_MS,
          'firestore/profile-read-timeout'
        );
        if (snap.exists()) {
          setUser(snap.data() as User);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 라우팅: isLoading 완료 후 1회 실행
  useEffect(() => {
    if (!route) return;
    if (isLoading) return;
    if (routed.current) return;
    routed.current = true;

    // SplashScreen 해제
    SplashScreen.hideAsync().catch(() => {});

    if (!user) {
      if (pathname !== '/onboarding/splash') {
        router.replace('/onboarding/splash');
      }
      return;
    }
    router.replace(ROLE_ROUTES[user.role] as any);
  }, [user, isLoading, pathname, route]);

  async function signIn(email: string, password: string) {
    if (isLocalAdminEnabled() && email.trim() === LOCAL_ADMIN_ID && password === LOCAL_ADMIN_PASSWORD) {
      const localAdmin = createLocalAdminUser('admin');
      setUser(localAdmin);
      router.replace(ROLE_ROUTES.admin as any);
      return;
    }

    if (!auth) {
      const error = new Error('Firebase Auth is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const snap = await withTimeout(
        getDoc(refs.users(cred.user.uid)),
        PROFILE_TIMEOUT_MS,
        'firestore/profile-read-timeout'
      );
      if (!snap.exists()) {
        const error = new Error('User profile document was not found.');
        (error as any).code = 'auth/profile-not-found';
        throw error;
      }
      const profile = snap.data() as User;
      setUser(profile);
      router.replace(ROLE_ROUTES[profile.role] as any);
    } catch (error) {
      await firebaseSignOut(auth).catch(() => {});
      setUser(null);
      throw error;
    }
  }

  async function signUp(params: {
    email: string; password: string;
    displayName: string; avatar: string;
    role: Role; grade?: string;
    academyId?: string; classId?: string;
    accountType: 'b2c' | 'b2b';
  }) {
    if (!auth) {
      const error = new Error('Firebase Auth is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }

    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password);
    const safeRole: Role = 'student';
    const newUser: User = {
      uid:         cred.user.uid,
      email:       params.email,
      displayName: params.displayName,
      avatar:      params.avatar,
      role:        safeRole,
      accountType: params.accountType,
      ...(params.grade ? { grade: params.grade } : {}),
      ...(params.academyId ? { academyId: params.academyId } : {}),
      ...(params.classId ? { classId: params.classId } : {}),
    };
    try {
      await withTimeout(setDoc(refs.users(cred.user.uid), {
        ...newUser,
        xp: 0, streak: 0, level: 1,
        selectedCoach: 'betty',
        createdAt: serverTimestamp(),
      }), PROFILE_TIMEOUT_MS, 'firestore/profile-write-timeout');
    } catch (error) {
      await deleteUser(cred.user).catch(() => {});
      throw error;
    }
    setUser(newUser);
  }

  function switchLocalAdminMode(role: Role) {
    if (!isLocalAdminEnabled()) return false;
    if (!isLocalAdminUser(useAppStore.getState().user)) return false;

    const localUser = createLocalAdminUser(role);
    setUser(localUser);
    router.replace(ROLE_ROUTES[role] as any);
    return true;
  }

  async function signOut() {
    if (!auth) {
      setUser(null);
      router.replace('/onboarding/splash');
      return;
    }
    await firebaseSignOut(auth);
    setUser(null);
    router.replace('/onboarding/splash');
  }

  async function resetPassword(email: string) {
    if (!auth) {
      const error = new Error('Firebase Auth is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }
    await sendPasswordResetEmail(auth, email);
  }

  return { user, isLoading, signIn, signUp, signOut, resetPassword, switchLocalAdminMode, isLocalAdminSession };
}
