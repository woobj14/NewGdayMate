// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
export const Colors = {
  brand:    '#5B50F0',
  brandBg:  '#F0EFFE',
  brandDk:  '#3C3489',
  green:    '#1AB87A',
  greenBg:  '#E8FAF3',
  greenDk:  '#0A6B46',
  orange:   '#F06B3F',
  orangeBg: '#FEF0EB',
  red:      '#E53E3E',
  redBg:    '#FFF0F0',
  amber:    '#F0A500',
  amberBg:  '#FFFBEB',
  ink:      '#0E0E10',
  ink2:     '#3A3A3F',
  ink3:     '#8E8E99',
  line:     '#EBEBF0',
  bg:       '#F5F5F7',
  white:    '#FFFFFF',
  // AI 코치 컬러
  betty:    '#E8437A',
  bettyBg:  '#FFF0F5',
  lukas:    '#3B8BD4',
  lukasBg:  '#EEF5FF',
  alex:     '#5B50F0',
  alexBg:   '#F0EFFE',
  amberDk:       '#7A5200',
  blue:       '#3B8BD4',
  purpleDk:       '#534AB7',
  redDk:       '#991b1b',
  purpleAlt:       '#6C63FF',
  blueLight:      '#EEF5FF',
  blueDk:      '#185FA5',
  amberText:      '#92400E',
  greenAlt:      '#16a34a',
  pureWhite:      '#FAFAFE',
  bgAlt:      '#FFFAFA',
  // ── 그라데이션 (CSS string) ──────────────────────────────────
  gradBrand:   'linear-gradient(135deg, #5B50F0 0%, #7C71FF 100%)',
  gradGreen:   'linear-gradient(135deg, #1AB87A 0%, #0EE09A 100%)',
  gradDark:    'linear-gradient(135deg, #0E0E10 0%, #1E1E24 100%)',
  // ── 그림자 ─────────────────────────────────────────────────
  shadowCard:  '0 4px 16px rgba(0,0,0,0.08)',
  shadowBrand: '0 4px 16px rgba(91,80,240,0.25)',
  shadowGreen: '0 4px 12px rgba(26,184,122,0.20)',
  // ── 디자인 토큰 ────────────────────────────────────────────
  radius:     { sm:8, md:12, lg:16, xl:20, pill:99 },
  spacing:    { xs:4, sm:8, md:12, lg:16, xl:24 },
} as const;

export type ColorKey = keyof typeof Colors;

