// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 — Shadow 프리셋 (colors.ts와 분리)
// ═══════════════════════════════════════════════════════════════
import { Platform } from 'react-native';

export const Shadow = {
  card: Platform.select({
    ios:     { shadowColor:'#000', shadowOffset:{width:0,height:3}, shadowOpacity:0.08, shadowRadius:10 },
    android: { elevation: 4 },
    default: {},
  }),
  brand: Platform.select({
    ios:     { shadowColor:'#5B50F0', shadowOffset:{width:0,height:4}, shadowOpacity:0.25, shadowRadius:12 },
    android: { elevation: 6 },
    default: {},
  }),
  green: Platform.select({
    ios:     { shadowColor:'#1AB87A', shadowOffset:{width:0,height:3}, shadowOpacity:0.20, shadowRadius:10 },
    android: { elevation: 5 },
    default: {},
  }),
} as const;
