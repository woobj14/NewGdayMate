# G'day Mate 📚

> AI 코치와 함께하는 스마트 내신 영어 학습 앱

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 앱 프레임워크 | Expo SDK 52 + Expo Router v4 |
| 언어 | TypeScript |
| 상태 관리 | Zustand + AsyncStorage |
| 서버 상태 | TanStack Query v5 |
| 데이터베이스 | Firebase Firestore |
| 인증 | Firebase Auth (RBAC) |
| AI 코치 | Gemini 2.0 Flash |
| 푸시 알림 | FCM + expo-notifications |
| 애니메이션 | React Native Reanimated 3 |

## 시작하기

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.example .env.local
# .env.local 파일에 Firebase & Gemini API 키 입력
```

### 3. 개발 서버 실행
```bash
npx expo start
```

### 4. 실기기 실행
```bash
# iOS 시뮬레이터
npx expo start --ios

# Android 에뮬레이터
npx expo start --android
```

## 프로젝트 구조

```
gdaymate/
├── app/
│   ├── _layout.tsx          # Root Layout + Auth Guard
│   ├── onboarding/          # 스플래시, 역할선택, 학원코드, 프로필
│   ├── (student)/           # 학생 탭 네비게이션
│   │   ├── index.tsx        # 홈 대시보드
│   │   ├── learn/           # 학습 코스 (단어/문법/본문)
│   │   ├── coach/           # AI 코치 선택 + 채팅
│   │   ├── wrong-notes/     # 오답노트
│   │   └── profile/         # 프로필/XP/배지
│   ├── (teacher)/           # 선생님 화면
│   └── (admin)/             # 관리자 화면
├── components/
│   ├── ui/                  # 공통 UI (Button, Card, Input)
│   ├── learning/            # 학습 컴포넌트 (WordCard, Quiz)
│   └── coach/               # AI 코치 (CoachBubble, StreamingText)
├── hooks/
│   ├── useAuth.ts           # Firebase Auth + RBAC
│   ├── useStudy.ts          # 학습 진도 + SM-2 알고리즘
│   └── useCoach.ts          # Gemini 스트리밍 채팅
├── stores/
│   └── useAppStore.ts       # Zustand 전역 상태
├── lib/
│   ├── firebase.ts          # Firebase 초기화
│   └── gemini.ts            # Gemini 2.0 Flash 설정
└── constants/
    ├── colors.ts            # 디자인 토큰
    └── typography.ts        # Pretendard 폰트 시스템
```

## AI 코치 시스템

### 세 명의 코치
- **Betty** 👩‍🏫 — 1타 강사. 직설적, 핵심 압축. temperature: 0.95
- **Lukas** 👨‍🏫 — 꼼꼼한 코치. 단계별, 인내심. temperature: 0.55
- **Alex** 🧑‍💻 — 심리 멘토. 창의적, 통찰력. temperature: 0.82

### 비용 (1,000명 기준)
- Gemini 2.0 Flash: 월 ~₩18,000
- Firebase: 월 ~₩45,000
- 기타: 월 ~₩38,000
- **합계: 월 ~₩101,000 (학생 1인당 ₩101)**

## 빌드 & 배포

```bash
# EAS 설정
npm install -g eas-cli
eas login
eas build:configure

# iOS 빌드
eas build --platform ios

# Android 빌드
eas build --platform android

# 앱스토어 제출
eas submit --platform ios
eas submit --platform android
```

## 환경 요구사항

- Node.js 18+
- Expo Go 앱 (개발용)
- Xcode 15+ (iOS 빌드)
- Android Studio (Android 빌드)
