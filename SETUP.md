# G'day Mate — 세팅 가이드

처음부터 앱을 실행하기까지 필요한 모든 단계입니다.

---

## 1. 사전 요구사항

```bash
node --version   # v18 이상
npm --version    # v9 이상
```

Node.js 18 미만이면 https://nodejs.org 에서 LTS 버전 설치.

---

## 2. 프로젝트 준비

```bash
# ZIP 압축 해제 후
cd gdaymate
npm install

# 환경변수 파일 생성
cp .env.example .env.local
```

---

## 3. Firebase 프로젝트 생성

### 3-1. 프로젝트 만들기
1. https://console.firebase.google.com 접속
2. **프로젝트 추가** 클릭
3. 프로젝트 이름: `gdaymate` (자유롭게 설정)
4. Google Analytics: 선택 사항

### 3-2. 앱 등록 (Web)
1. 프로젝트 홈 → **웹 앱 추가** (</> 아이콘)
2. 앱 닉네임: `gdaymate-web`
3. **앱 등록** 후 표시되는 설정값 복사:

```js
const firebaseConfig = {
  apiKey: "...",              // EXPO_PUBLIC_FIREBASE_API_KEY
  authDomain: "...",          // EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "...",           // EXPO_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "...",       // EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...",   // EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "..."                // EXPO_PUBLIC_FIREBASE_APP_ID
};
```

### 3-3. Authentication 설정
1. Firebase Console → **Authentication** → **시작하기**
2. **Sign-in method** 탭
3. **이메일/비밀번호** → 사용 설정 → 저장

### 3-4. Firestore 데이터베이스 생성
1. Firebase Console → **Firestore Database** → **데이터베이스 만들기**
2. **프로덕션 모드**로 시작 (보안 규칙은 아래에서 설정)
3. 위치: `asia-northeast3` (서울) 선택

### 3-5. .env.local 파일 작성

```env
# .env.local
EXPO_PUBLIC_FIREBASE_API_KEY=복사한_값
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=복사한_값
EXPO_PUBLIC_FIREBASE_PROJECT_ID=복사한_값
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=복사한_값
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=복사한_값
EXPO_PUBLIC_FIREBASE_APP_ID=복사한_값

EXPO_PUBLIC_GEMINI_API_KEY=아래에서_발급
```

---

## 4. Gemini API 키 발급

1. https://aistudio.google.com/app/apikey 접속
2. **Create API Key** 클릭
3. 발급된 키를 `.env.local`의 `EXPO_PUBLIC_GEMINI_API_KEY`에 입력

> **주의**: Gemini API는 무료 티어에서 분당 15회 요청 가능합니다.
> 학생이 많으면 유료 티어(Pay-as-you-go) 전환을 권장합니다.

---

## 5. Firestore 보안 규칙 배포

Firebase CLI 설치:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # 프로젝트 선택 후 기본값으로 진행
```

`firestore.rules` 파일이 이미 준비되어 있습니다. 배포:
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 6. 첫 관리자 계정 생성

앱에서 회원가입 후, Firebase Console에서 관리자 권한 부여:

1. Firebase Console → **Firestore Database**
2. `users` 컬렉션 → 가입한 계정의 문서 클릭
3. `role` 필드 값을 `"admin"` 으로 변경

또는 터미널에서:
```bash
# Firebase Admin SDK 스크립트 (Node.js)
node scripts/set-admin.js your-email@example.com
```

---

## 7. 개발 서버 실행

```bash
# 개발 서버 시작
npx expo start

# 선택지:
# i → iOS 시뮬레이터 (Mac + Xcode 필요)
# a → Android 에뮬레이터 (Android Studio 필요)
# w → 웹 브라우저 (기능 제한)
# QR → Expo Go 앱으로 실기기 테스트
```

### Expo Go 앱 (가장 빠른 테스트 방법)
1. iOS: App Store에서 **Expo Go** 검색 설치
2. Android: Google Play에서 **Expo Go** 검색 설치
3. 앱 실행 후 터미널에 표시된 QR 코드 스캔

---

## 8. 테스트 계정 & 데모 코드

개발 중 바로 사용 가능한 데모 데이터:

| 역할 | 학원 코드 | 설명 |
|------|----------|------|
| 학생 | `SMART1` | 새빛영어학원 · 중3 A반 |
| 학생 | `TOPENG` | 탑클래스학원 · 중2 B반 |
| 학생 | `BUDDY7` | 개인 학습 (학원 없음) |

> Firestore 연결 전에도 데모 데이터로 UI 확인 가능합니다.

---

## 9. EAS 빌드 (앱스토어 배포)

```bash
npm install -g eas-cli
eas login
eas build:configure

# iOS 빌드 (Apple Developer 계정 필요, $99/년)
eas build --platform ios

# Android 빌드
eas build --platform android

# 앱스토어 제출
eas submit --platform ios
eas submit --platform android
```

---

## 10. 자주 발생하는 문제

### "Cannot find module 'firebase'"
```bash
npm install   # 의존성 재설치
```

### iOS 시뮬레이터에서 Metro 연결 안 됨
```bash
npx expo start --clear   # 캐시 초기화 후 재시작
```

### Firestore "permission-denied" 오류
- `firestore.rules` 배포 확인
- Firebase Console에서 규칙 탭 확인

### Gemini API "RESOURCE_EXHAUSTED"
- 무료 티어 한도 초과 (분당 15회)
- 잠시 후 재시도하거나 유료 플랜 전환

### 환경변수 인식 안 됨
- `.env.local` 파일명 정확한지 확인 (`env.local` 아님)
- `npx expo start` 재시작 필요

---

## 프로젝트 구조 요약

```
gdaymate/
├── app/                    # 화면 (Expo Router v4)
│   ├── onboarding/         # 스플래시→역할→학원코드→프로필
│   ├── (student)/          # 학생 탭 (홈·학습·단어장·오답·코치)
│   │   └── learn/          # 자료선택·단계선택·퀴즈·완료
│   ├── (teacher)/          # 선생님 (대시보드·자료업로드·쪽지함)
│   └── (admin)/            # 관리자 (홈·콘텐츠·요청함·통계)
├── hooks/                  # useAuth·useLesson·useWordbook 등
├── lib/                    # firebase.ts·gemini.ts·generateQuiz.ts
├── stores/                 # Zustand 전역 상태
├── types/                  # lesson.ts 타입 정의
└── constants/              # colors.ts·typography.ts
```
