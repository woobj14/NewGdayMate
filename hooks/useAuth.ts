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
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import * as SplashScreen from 'expo-splash-screen';
import { auth, db, refs } from '../lib/firebase';
import { useAppStore, User, Role, MembershipTier } from '../stores/useAppStore';

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
const TEACHER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ONBOARDING_PATHS = new Set([
  '/onboarding/splash',
  '/onboarding/role',
  '/onboarding/profile',
]);

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
    region: '서울',
    phoneNumber: '010-0000-0000',
    phoneKey: '01000000000',
    academyId: LOCAL_ADMIN_ACADEMY_ID,
    academyName: '새빛영어학원',
    classId: LOCAL_ADMIN_CLASS_ID,
    accountType: 'b2b',
    teacherUid: role === 'student' ? LOCAL_ADMIN_UID : undefined,
    teacherCode: role === 'teacher' ? 'ADMIN1' : role === 'student' ? 'ADMIN1' : undefined,
    membershipTier: role === 'teacher' ? 'professional' : role === 'admin' ? 'superb' : undefined,
    ...(role === 'student' || role === 'teacher' ? { grade: '중3' } : {}),
  };
}

function normalizePhone(input: string) {
  return input.replace(/\D/g, '');
}

function formatPhone(input: string) {
  const digits = normalizePhone(input).slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function getMembershipTier(role: Role): MembershipTier | undefined {
  if (role === 'teacher') return 'basic';
  if (role === 'admin') return 'superb';
  return undefined;
}

function getTierLabel(tier?: MembershipTier) {
  if (tier === 'professional') return '프로페셔널';
  if (tier === 'superb') return '슈퍼비';
  if (tier === 'basic') return '베이직';
  return '';
}

async function generateTeacherCode() {
  if (!db) {
    const error = new Error('Database is not configured.');
    (error as any).code = 'firestore/configuration-not-found';
    throw error;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const code = Array.from({ length: 6 }, () =>
      TEACHER_CODE_ALPHABET[Math.floor(Math.random() * TEACHER_CODE_ALPHABET.length)]
    ).join('');
    const snap = await getDoc(doc(db, 'teacherCodes', code));
    if (!snap.exists()) return code;
  }

  const error = new Error('Teacher code generation failed.');
  (error as any).code = 'teacher/code-generation-failed';
  throw error;
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

function isOnboardingPath(pathname?: string | null) {
  return pathname ? ONBOARDING_PATHS.has(pathname) : false;
}

function isPasswordProviderUser(firebaseUser: FirebaseAuthUser | null) {
  return firebaseUser?.providerData.some((provider) => provider.providerId === 'password') ?? false;
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
      if (!firebaseUser.emailVerified && isPasswordProviderUser(firebaseUser)) {
        await firebaseSignOut(auth).catch(() => {});
        setUser(null);
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
          if (!isOnboardingPath(pathname)) {
            router.replace({
              pathname: '/onboarding/role',
              params: {
                email: firebaseUser.email ?? '',
                authMethod: 'google',
              },
            });
          }
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
      if (!isOnboardingPath(pathname)) {
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
    if (!cred.user.emailVerified) {
      await firebaseSignOut(auth).catch(() => {});
      const error = new Error('Email verification is required.');
      (error as any).code = 'auth/email-not-verified';
      throw error;
    }
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

  async function signInWithGoogle() {
    if (!auth) {
      const error = new Error('Firebase Auth is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }
    if (typeof window === 'undefined') {
      const error = new Error('Google sign-in is not supported in this environment.');
      (error as any).code = 'auth/operation-not-supported-in-this-environment';
      throw error;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const cred = await signInWithPopup(auth, provider);
    try {
      const snap = await withTimeout(
        getDoc(refs.users(cred.user.uid)),
        PROFILE_TIMEOUT_MS,
        'firestore/profile-read-timeout'
      );
      if (!snap.exists()) {
        setUser(null);
        router.replace({
          pathname: '/onboarding/role',
          params: {
            email: cred.user.email ?? '',
            authMethod: 'google',
          },
        });
        return;
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
    email: string; password?: string;
    displayName: string; avatar: string;
    role: Role; grade?: string;
    region: string;
    phoneNumber: string;
    academyName?: string;
    teacherCode?: string;
    accountType: 'b2c' | 'b2b';
    authMethod?: 'password' | 'google';
  }): Promise<{ requiresEmailVerification: boolean }> {
    if (!auth) {
      const error = new Error('Firebase Auth is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }
    if (!db) {
      const error = new Error('Database is not configured.');
      (error as any).code = 'firestore/configuration-not-found';
      throw error;
    }

    const phoneKey = normalizePhone(params.phoneNumber);
    if (phoneKey.length < 10) {
      const error = new Error('Phone number is invalid.');
      (error as any).code = 'auth/invalid-phone-number';
      throw error;
    }

    const phoneSnap = await getDoc(doc(db, 'signupPhoneIndex', phoneKey));
    if (phoneSnap.exists()) {
      const error = new Error('Phone number is already in use.');
      (error as any).code = 'auth/phone-already-in-use';
      throw error;
    }

    let teacherLink: Record<string, any> | null = null;
    if (params.role === 'student') {
      const inputCode = (params.teacherCode ?? '').trim().toUpperCase();
      if (!inputCode) {
        const error = new Error('Teacher code is required.');
        (error as any).code = 'auth/teacher-code-required';
        throw error;
      }
      const teacherSnap = await getDoc(doc(db, 'teacherCodes', inputCode));
      if (!teacherSnap.exists()) {
        const error = new Error('Teacher code was not found.');
        (error as any).code = 'auth/teacher-code-not-found';
        throw error;
      }
      teacherLink = teacherSnap.data();
    } else if (!(params.academyName ?? '').trim()) {
      const error = new Error('Academy name is required.');
      (error as any).code = 'auth/academy-name-required';
      throw error;
    }

    const authMethod = params.authMethod ?? 'password';
    const firebaseUser = authMethod === 'google'
      ? auth.currentUser
      : (await createUserWithEmailAndPassword(auth, params.email, params.password ?? '')).user;

    if (!firebaseUser) {
      const error = new Error('Authenticated user was not found.');
      (error as any).code = 'auth/current-user-not-found';
      throw error;
    }

    const nextRole: Role = params.role === 'teacher' ? 'teacher' : 'student';
    const teacherCode = nextRole === 'teacher' ? await generateTeacherCode() : (params.teacherCode ?? '').trim().toUpperCase();
    const academyId = nextRole === 'teacher'
      ? `academy-${teacherCode.toLowerCase()}`
      : (teacherLink?.academyId as string | undefined);
    const academyName = nextRole === 'teacher'
      ? (params.academyName ?? '').trim()
      : ((teacherLink?.academyName as string | undefined) ?? '');
    const newUser: User = {
      uid:         firebaseUser.uid,
      email:       (params.email || firebaseUser.email || '').trim(),
      displayName: params.displayName,
      avatar:      params.avatar,
      role:        nextRole,
      region:      params.region.trim(),
      phoneNumber: formatPhone(params.phoneNumber),
      phoneKey,
      accountType: params.accountType,
      membershipTier: getMembershipTier(nextRole),
      teacherCode,
      ...(academyId ? { academyId } : {}),
      ...(academyName ? { academyName } : {}),
      ...(nextRole === 'student' && teacherLink?.teacherUid ? { teacherUid: teacherLink.teacherUid } : {}),
      ...(params.grade ? { grade: params.grade } : {}),
    };
    try {
      const batch = writeBatch(db);
      batch.set(refs.users(firebaseUser.uid), {
        ...newUser,
        xp: 0, streak: 0, level: 1,
        selectedCoach: 'betty',
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'signupPhoneIndex', phoneKey), {
        uid: firebaseUser.uid,
        phoneNumber: formatPhone(params.phoneNumber),
        phoneKey,
        role: nextRole,
        createdAt: serverTimestamp(),
      });
      if (nextRole === 'teacher') {
        batch.set(doc(db, 'teacherCodes', teacherCode), {
          teacherUid: firebaseUser.uid,
          teacherName: params.displayName,
          teacherCode,
          academyId,
          academyName,
          region: params.region.trim(),
          studentCount: 0,
          membershipTier: getTierLabel('basic'),
          active: true,
          createdAt: serverTimestamp(),
        });
      } else if (teacherLink) {
        batch.update(doc(db, 'teacherCodes', teacherCode), {
          studentCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      await withTimeout(batch.commit(), PROFILE_TIMEOUT_MS, 'firestore/profile-write-timeout');
    } catch (error) {
      if (authMethod === 'password') {
        await deleteUser(firebaseUser).catch(() => {});
      } else {
        await firebaseSignOut(auth).catch(() => {});
      }
      throw error;
    }
    if (authMethod === 'password') {
      await sendEmailVerification(firebaseUser);
      await firebaseSignOut(auth).catch(() => {});
      setUser(null);
      return { requiresEmailVerification: true };
    }

    setUser(newUser);
    return { requiresEmailVerification: false };
  }

  async function updateAccount(params: {
    displayName?: string;
    avatar?: string;
    region?: string;
    grade?: string;
    academyName?: string;
  }) {
    const current = useAppStore.getState().user;
    if (!current) return;
    if (isLocalAdminUser(current)) {
      setUser({ ...current, ...params });
      return;
    }
    if (!db) {
      const error = new Error('Database is not configured.');
      (error as any).code = 'firestore/configuration-not-found';
      throw error;
    }

    const nextUser = { ...current, ...params };
    await updateDoc(refs.users(current.uid), {
      ...(params.displayName ? { displayName: params.displayName.trim() } : {}),
      ...(params.avatar ? { avatar: params.avatar } : {}),
      ...(params.region ? { region: params.region.trim() } : {}),
      ...(params.grade ? { grade: params.grade } : {}),
      ...(params.academyName ? { academyName: params.academyName.trim() } : {}),
      updatedAt: serverTimestamp(),
    });

    if (current.role === 'teacher' && current.teacherCode) {
      await updateDoc(doc(db, 'teacherCodes', current.teacherCode), {
        ...(params.displayName ? { teacherName: params.displayName.trim() } : {}),
        ...(params.region ? { region: params.region.trim() } : {}),
        ...(params.academyName ? { academyName: params.academyName.trim() } : {}),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }

    setUser(nextUser);
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

  async function resendVerificationEmail() {
    if (!auth?.currentUser) {
      const error = new Error('Authenticated user was not found.');
      (error as any).code = 'auth/current-user-not-found';
      throw error;
    }
    await sendEmailVerification(auth.currentUser);
  }

  async function deleteAccount() {
    const current = useAppStore.getState().user;
    if (!current) return;

    if (isLocalAdminUser(current)) {
      setUser(null);
      router.replace('/onboarding/splash');
      return;
    }

    if (!auth?.currentUser || !db) {
      const error = new Error('Account is not configured.');
      (error as any).code = 'auth/configuration-not-found';
      throw error;
    }

    const authUser = auth.currentUser;
    await deleteUser(authUser);
    await deleteDoc(refs.users(current.uid)).catch(() => {});
    if (current.phoneKey) {
      await deleteDoc(doc(db, 'signupPhoneIndex', current.phoneKey)).catch(() => {});
    }
    if (current.role === 'teacher' && current.teacherCode) {
      await deleteDoc(doc(db, 'teacherCodes', current.teacherCode)).catch(() => {});
    }
    setUser(null);
    router.replace('/onboarding/splash');
  }

  return {
    user,
    isLoading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    resendVerificationEmail,
    updateAccount,
    deleteAccount,
    switchLocalAdminMode,
    isLocalAdminSession,
  };
}
