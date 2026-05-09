// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 폰트: 한글 = 굴림(GulimChe) / 영어 = System 폰트
// ═══════════════════════════════════════════════════════════════
import { TextStyle, Platform } from 'react-native';

// 굴림체: iOS는 'AppleSDGothicNeo' 계열, Android는 시스템 산세리프
// 순수 굴림체를 원할 경우 assets/fonts에 GulimChe.ttf 추가 후 'GulimChe' 사용
export const FontFamily = {
  regular:   Platform.select({ ios:'AppleSDGothicNeo-Regular',  android:'sans-serif',       default:'System' }),
  medium:    Platform.select({ ios:'AppleSDGothicNeo-Medium',   android:'sans-serif-medium', default:'System' }),
  semiBold:  Platform.select({ ios:'AppleSDGothicNeo-SemiBold', android:'sans-serif-medium', default:'System' }),
  bold:      Platform.select({ ios:'AppleSDGothicNeo-Bold',     android:'sans-serif-medium', default:'System' }),
  extraBold: Platform.select({ ios:'AppleSDGothicNeo-Heavy',    android:'sans-serif-black',  default:'System' }),
} as const;

export const Typography: Record<string, TextStyle> = {
  // 헤딩
  h1:     { fontFamily:FontFamily.extraBold, fontSize:28, fontWeight:'900', letterSpacing:-1.2, lineHeight:36 },
  h2:     { fontFamily:FontFamily.extraBold, fontSize:22, fontWeight:'900', letterSpacing:-0.8, lineHeight:30 },
  h3:     { fontFamily:FontFamily.bold,      fontSize:18, fontWeight:'800', letterSpacing:-0.6, lineHeight:26 },
  h4:     { fontFamily:FontFamily.bold,      fontSize:16, fontWeight:'800', letterSpacing:-0.4, lineHeight:24 },
  // 본문
  body1:  { fontFamily:FontFamily.regular, fontWeight:'400', fontSize:16, lineHeight:26 },
  body2:  { fontFamily:FontFamily.regular, fontWeight:'400', fontSize:14, lineHeight:22 },
  body3:  { fontFamily:FontFamily.regular, fontWeight:'400', fontSize:13, lineHeight:20 },
  // 강조
  bold1:  { fontFamily:FontFamily.bold, fontWeight:'700', fontSize:16, lineHeight:26 },
  bold2:  { fontFamily:FontFamily.bold, fontWeight:'700', fontSize:14, lineHeight:22 },
  bold3:  { fontFamily:FontFamily.bold, fontWeight:'700', fontSize:13, lineHeight:20 },
  // 레이블
  label1: { fontFamily:FontFamily.semiBold, fontWeight:'600', fontSize:12, letterSpacing:0.3 },
  label2: { fontFamily:FontFamily.semiBold, fontWeight:'600', fontSize:11, letterSpacing:0.5 },
  label3: { fontFamily:FontFamily.semiBold, fontWeight:'600', fontSize:10, letterSpacing:0.8 },
  // 숫자
  stat:   { fontFamily:FontFamily.extraBold, fontWeight:'900', fontSize:24, letterSpacing:-1 },
  statSm: { fontFamily:FontFamily.extraBold, fontWeight:'900', fontSize:18, letterSpacing:-0.6 },
};
