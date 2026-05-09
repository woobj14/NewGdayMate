# G'day Mate — 프로젝트 컨텍스트

## 프로젝트 개요
- **앱명**: G'day Mate
- **목적**: 중·고등학생 대상 AI 내신 영어 학습 앱
- **스택**: Expo SDK 52 + Expo Router v4 + TypeScript + Firebase + Gemini 2.0 Flash
- **GitHub**: https://github.com/woobj14/NewGdayMate

## 역할 구조
- 학생 / 선생님 / 관리자 (3-way RBAC)
- Firebase Auth + Firestore

## 4개 독립 학습 트랙
| 트랙 | 단계 | 특징 |
|------|------|------|
| 📗 단어 (word) | 4단계 | 60~75개 어휘 집중 |
| 💬 대화문 (dialog) | 6단계 | 단어 문제 없음, 내용/표현/어법 |
| 📖 본문 (reading) | 6단계 | 단어 문제 없음, 독해/어법/추론 |
| 📐 문법 (grammar) | 4단계 | 선생님 지정 포인트 집중 |

## 팀 구조
- 🎓 LX팀: learn/*, done, session, step, content-step
- 📚 CT팀: teacher/*, gemini.ts, useLesson.ts, types/
- 🏗️ PI팀: firebase.ts, offlineCache.ts, useFCM, rules
- 🎨 PD팀: onboarding, student/index, wordbook, constants
- 📊 GA팀: admin/*, ranking, report, useMission

## 디자인 원칙
- 이모지 사용 금지 (아바타 🦊🐯🐻🐰🦁🐧만 예외)
- 아이콘은 lucide-react-native만 사용
- 한글 폰트: AppleSDGothicNeo (굴림체 계열)
- Colors/Typography 상수 외 하드코딩 금지
- Shadow는 constants/shadow.ts에서 import

## 주요 파일 구조
```
gdaymate/
├── app/
│   ├── (student)/        # 학생 화면
│   ├── (teacher)/        # 선생님 화면
│   ├── (admin)/          # 관리자 화면
│   └── onboarding/       # 온보딩
├── components/
│   ├── Icon.tsx          # Lucide 아이콘 래퍼
│   └── ui/index.tsx      # 공통 컴포넌트
├── constants/
│   ├── colors.ts         # 색상 토큰
│   ├── typography.ts     # 굴림체 폰트
│   └── shadow.ts         # 그림자 프리셋
├── hooks/
│   ├── useAdaptive.ts    # 적응형 학습
│   ├── useMission.ts     # 일일 미션
│   ├── useLesson.ts      # 학습 진도
│   ├── useWordbook.ts    # 단어장 SM-2
│   └── useWrongNote.ts   # 오답노트
├── lib/
│   ├── generateQuiz.ts   # Gemini 퀴즈 생성
│   └── gemini.ts         # Gemini API
└── types/lesson.ts       # STEP_DEFS 4트랙

## 구현 완료 기능
### 학생
- 홈: 그라데이션 헤더, 다음학습 추천, AI코치 배너, SM-2 복습
- 학습: 단원별 그룹핑, 4트랙 진행률
- 퀴즈: 4단해설, 2회시도, 힌트, streak, 적응형학습
- 단어장: SM-2 알고리즘, FCM 알림
- 오답노트: Gemini 해설, 검증문제
- 랭킹: 주간 XP 순위, 포디엄, 리그시스템
- 미션: 일일 3개 미션, XP 보상
- 모의고사: 약점 가중 출제

### 선생님
- 자료 업로드: 3단계 (입력→AI검수→배포)
- 커리큘럼 빌더: 4트랙 단원 묶기
- 학생 관리: 전체목록, 상세, 독려메시지
- 쪽지함: Firestore 실시간
- 학부모 리포트: 주간 공유
- 약점 보충 자료: Gemini 자동 생성

### 관리자
- 통계: Firestore 실시간 집계
- 학생/학원 관리

## 데모 계정 (Firestore seed)
- SMART1: 새빛영어학원 · 중3 A반
- TOPENG: 탑클래스학원 · 중2 B반

## 남은 작업
- 스피킹 퀴즈 (AI 발음 채점) — 다음 스프린트
- Expo Go 실행 오류 해결 중
- GitHub: https://github.com/woobj14/NewGdayMate

## 불변 규칙
1. Surgical Changes Only (최소 수정)
2. import 경로 검증 필수 (python3로)
3. Colors/Typography 상수 외 하드코딩 금지
4. academyId 필터 누락 절대 금지
5. 이모지 사용 금지 (아바타 제외)
6. Lucide 아이콘만 사용
