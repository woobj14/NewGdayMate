import { View, Text, Pressable, StyleSheet, ViewStyle, Animated } from 'react-native';
import { Colors } from '../../constants/colors';
import { Shadow } from '../../constants/shadow';
import { Typography } from '../../constants/typography';

// ── Button ──────────────────────────────────────────────
interface ButtonProps {
  label: string; onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  color?: string; disabled?: boolean;
  fullWidth?: boolean; size?: 'sm' | 'md' | 'lg';
}
export function Button({ label, onPress, variant = 'primary', color, disabled, fullWidth, size = 'md' }: ButtonProps) {
  const bg = variant === 'primary' ? (color ?? Colors.brand)
           : variant === 'danger'  ? Colors.red : 'transparent';
  const border = variant === 'ghost' ? Colors.line : 'transparent';
  const txtColor = variant === 'primary' || variant === 'danger' ? '#fff' : Colors.ink2;
  const pad = size === 'sm' ? 10 : size === 'lg' ? 17 : 14;

  return (
    <Pressable
      style={[bs.btn, { backgroundColor: bg, borderColor: border, borderWidth: 1.5, paddingVertical: pad, opacity: disabled ? 0.4 : 1, ...(fullWidth && { width: '100%' }) }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[Typography.bold2, { color: txtColor }]}>{label}</Text>
    </Pressable>
  );
}
const bs = StyleSheet.create({
  btn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

// ── Card ──────────────────────────────────────────────
interface CardProps { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; }
export function Card({ children, style, onPress }: CardProps) {
  if (onPress) {
    return (
      <Pressable style={[cs.card, style]} onPress={onPress}>
        {children}
      </Pressable>
    );
  }
  return <View style={[cs.card, style]}>{children}</View>;
}
const cs = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 15 },
});

// ── Badge ──────────────────────────────────────────────
interface BadgeProps { label: string; color?: string; bg?: string; }
export function Badge({ label, color = Colors.brandDk, bg = Colors.brandBg }: BadgeProps) {
  return (
    <View style={[bds.badge, { backgroundColor: bg }]}>
      <Text style={[Typography.label3, { color }]}>{label}</Text>
    </View>
  );
}
const bds = StyleSheet.create({
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
});



// ── XP Chip ──────────────────────────────────────────────
export function XpChip({ amount }: { amount: number }) {
  return (
    <View style={xps.chip}>
      <Text style={[Typography.label2, { color: Colors.greenDk }]}>+{amount} XP</Text>
    </View>
  );
}
const xps = StyleSheet.create({
  chip: { backgroundColor: Colors.greenBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
});

// ── Avatar ──────────────────────────────────────────────
interface AvatarProps { name: string; color?: string; size?: number; emoji?: string; }
export function Avatar({ name, color = Colors.brand, size = 38, emoji }: AvatarProps) {
  return (
    <View style={[avs.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.38, color: '#fff', fontWeight: '800' }}>
        {emoji ?? name[0]}
      </Text>
    </View>
  );
}
const avs = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});

// ── PrimaryButton — 그라데이션 + 눌림 피드백 ─────────────────────
interface PrimaryBtnProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'brand' | 'green' | 'dark' | 'outline';
  icon?: string;
}
export function PrimaryButton({ label, onPress, disabled, size='md', variant='brand', icon }: PrimaryBtnProps) {
  const scale = new Animated.Value(1);
  const onPressIn  = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true, speed:50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:30 }).start();

  const bg: Record<string,string> = {
    brand:   Colors.brand,
    green:   Colors.green,
    dark:    Colors.ink,
    outline: 'transparent',
  };
  const txtColor = variant === 'outline' ? Colors.brand : '#fff';
  const border   = variant === 'outline' ? { borderWidth:2, borderColor:Colors.brand } : {};
  const shadow   = variant === 'brand' ? Shadow.brand : variant === 'green' ? Shadow.green : Shadow.card;
  const py = size === 'lg' ? 16 : size === 'sm' ? 10 : 13;

  return (
    <Animated.View style={[{ transform:[{scale}] }, shadow]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        style={[{
          backgroundColor: bg[variant],
          borderRadius: 14,
          paddingVertical: py,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          opacity: disabled ? 0.4 : 1,
        }, border]}
      >
        {icon && <Text style={{ fontSize:16 }}>{icon}</Text>}
        <Text style={{ fontFamily:'Pretendard-Bold', fontSize: size==='lg' ? 16 : size==='sm' ? 13 : 14, color:txtColor, letterSpacing:-.3 }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── GradientCard — 그림자 있는 카드 ──────────────────────────────
interface GCardProps { children: React.ReactNode; style?: any; accentColor?: string; }
export function GradientCard({ children, style, accentColor }: GCardProps) {
  return (
    <View style={[{
      backgroundColor: Colors.white,
      borderRadius: 18,
      borderWidth: accentColor ? 2 : 1,
      borderColor: accentColor ?? Colors.line,
      padding: 14,
      ...Shadow.card as any,
    }, style]}>
      {children}
    </View>
  );
}

// ── ProgressBar — 그라데이션 진행바 ──────────────────────────────
interface ProgBarProps { pct: number; color?: string; height?: number; showLabel?: boolean; }
export function ProgressBar({ pct, color=Colors.brand, height=6, showLabel=false }: ProgBarProps) {
  const clamp = Math.max(0, Math.min(100, pct));
  const isComplete = clamp >= 100;
  return (
    <View>
      {showLabel && (
        <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
          <Text style={{ fontFamily:'Pretendard-SemiBold', fontSize:11, color:Colors.ink3 }}>진행률</Text>
          <Text style={{ fontFamily:'Pretendard-Bold', fontSize:11, color: isComplete ? Colors.green : color }}>{clamp}%</Text>
        </View>
      )}
      <View style={{ height, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' }}>
        <View style={{
          height:'100%', width:`${clamp}%`,
          backgroundColor: isComplete ? Colors.green : color,
          borderRadius:99,
        }} />
      </View>
    </View>
  );
}

// ── XPBadge — XP 보상 배지 ──────────────────────────────────────
export function XPBadge({ xp, size='sm' }: { xp:number; size?:'sm'|'md' }) {
  return (
    <View style={{
      backgroundColor: Colors.greenBg,
      borderRadius: 99,
      paddingHorizontal: size==='md' ? 12 : 8,
      paddingVertical: size==='md' ? 5 : 3,
      borderWidth: 1,
      borderColor: '#86efac',
    }}>
      <Text style={{ fontFamily:'Pretendard-Bold', fontSize: size==='md' ? 13 : 11, color:Colors.greenDk }}>
        +{xp} XP
      </Text>
    </View>
  );
}

// ── StreakBadge — 연속 학습 배지 ────────────────────────────────
export function StreakBadge({ streak }: { streak:number }) {
  if (streak === 0) return null;
  const bg = streak >= 30 ? Colors.amber : streak >= 7 ? Colors.orange : Colors.redBg;
  const tc = streak >= 30 ? Colors.amberDk : streak >= 7 ? '#fff' : Colors.red;
  const bg2 = streak >= 7 ? bg : Colors.redBg;
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:bg2, borderRadius:99, paddingHorizontal:10, paddingVertical:4 }}>
      <Text style={{ fontSize:13 }}>🔥</Text>
      <Text style={{ fontFamily:'Pretendard-Bold', fontSize:12, color:tc }}>{streak}일</Text>
    </View>
  );
}

// ── TrackHeader — 트랙별 컬러 헤더 스트라이프 ───────────────────
export function TrackHeader({ type, label, color }: { type:string; label:string; color:string }) {
  return (
    <View style={{ borderTopWidth:3, borderTopColor:color, paddingTop:10, marginBottom:6 }}>
      <Text style={{ fontFamily:'Pretendard-Bold', fontSize:12, color, letterSpacing:.3 }}>
        {label}
      </Text>
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────
// 사용: <EmptyState emoji="📚" title="자료가 없어요" desc="선생님이 등록하면 나타나요" />
interface EmptyStateProps {
  emoji:    string;
  title:    string;
  desc?:    string;
  action?:  { label: string; onPress: () => void };
}
export function EmptyState({ emoji, title, desc, action }: EmptyStateProps) {
  return (
    <View style={ems.wrap}>
      <Text style={ems.emoji}>{emoji}</Text>
      <Text style={[Typography.bold2, { color: Colors.ink, marginBottom: desc ? 6 : 0, textAlign: 'center' }]}>
        {title}
      </Text>
      {desc && (
        <Text style={[Typography.body3, { color: Colors.ink3, textAlign: 'center', lineHeight: 22 }]}>
          {desc}
        </Text>
      )}
      {action && (
        <Pressable style={ems.actionBtn} onPress={action.onPress}>
          <Text style={[Typography.bold2, { color: '#fff' }]}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
const ems = StyleSheet.create({
  wrap:      { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emoji:     { fontSize: 44, marginBottom: 14 },
  actionBtn: { marginTop: 16, backgroundColor: Colors.brand, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
});

// ── LoadingState ──────────────────────────────────────────────
// 사용: <LoadingState label="불러오는 중..." />
interface LoadingStateProps { label?: string; }
export function LoadingState({ label = '불러오는 중...' }: LoadingStateProps) {
  // ActivityIndicator import 없이 텍스트 기반 스피너 표시
  return (
    <View style={ls.wrap}>
      <View style={ls.spinner} />
      <Text style={[Typography.body3, { color: Colors.ink3, marginTop: 12 }]}>{label}</Text>
    </View>
  );
}
const ls = StyleSheet.create({
  wrap:    { alignItems: 'center', paddingVertical: 48 },
  spinner: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: Colors.line, borderTopColor: Colors.brand },
});

// ── ErrorState ────────────────────────────────────────────────
// 사용: <ErrorState onRetry={reload} />
interface ErrorStateProps { message?: string; onRetry?: () => void; }
export function ErrorState({ message = '데이터를 불러오지 못했어요', onRetry }: ErrorStateProps) {
  return (
    <View style={ers.wrap}>
      <Text style={ers.emoji}>⚠️</Text>
      <Text style={[Typography.bold2, { color: Colors.ink, marginBottom: 6, textAlign: 'center' }]}>
        {message}
      </Text>
      <Text style={[Typography.body3, { color: Colors.ink3, textAlign: 'center' }]}>
        네트워크 연결을 확인해 주세요
      </Text>
      {onRetry && (
        <Pressable style={ers.retryBtn} onPress={onRetry}>
          <Text style={[Typography.bold2, { color: Colors.brand }]}>다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
}
const ers = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emoji:    { fontSize: 36, marginBottom: 12 },
  retryBtn: { marginTop: 14, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.brand },
});
