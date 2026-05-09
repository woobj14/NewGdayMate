// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../../stores/useAppStore';
import { useAuth } from '../../../hooks/useAuth';
import { useWordbook } from '../../../hooks/useWordbook';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

const COACH_EMOJI: Record<string, string> = { betty: '‍', lukas: '‍', alex: '‍' };

// 배지는 streak/xp 실제 값으로 계산 (하드코딩 제거)
function calcBadges(streak: number, xp: number, words: number) {
  return [
    { id:'streak7',   icon:'', name:'연속 7일',    earned: streak >= 7,   isNew: streak === 7   },
    { id:'streak14',  icon:'', name:'연속 14일',   earned: streak >= 14,  isNew: streak === 14  },
    { id:'streak30',  icon:'', name:'연속 30일',   earned: streak >= 30,  isNew: streak === 30  },
    { id:'xp500',     icon:'⭐', name:'XP 500',     earned: xp >= 500,     isNew: xp < 600       },
    { id:'xp2000',    icon:'', name:'XP 2000',    earned: xp >= 2000,    isNew: xp < 2100      },
    { id:'words50',   icon:'', name:'단어 50개',   earned: words >= 50,   isNew: false          },
  ];
}

const BADGES = [
  { id:'streak7',  icon:'', name:'연속 7일',   earned:true  },
  { id:'streak14', icon:'', name:'연속 14일',   earned:true,  isNew:true },
  { id:'word',     icon:'', name:'단어 마스터', earned:true  },
  { id:'acc90',    icon:'', name:'정답률 90%',  earned:true  },
  { id:'morning',  icon:'', name:'아침 학습',   earned:false },
  { id:'gold',     icon:'', name:'골드 리그',   earned:false },
  { id:'grade1',   icon:'', name:'1등급 달성',  earned:false },
  { id:'diamond',  icon:'', name:'다이아 리그', earned:false },
];

// 히트맵 데이터 생성 (최근 10주)
const HEATMAP = Array.from({ length: 70 }, (_, i) => {
  const v = Math.random();
  if (v > 0.6) return 4;
  if (v > 0.4) return 3;
  if (v > 0.25) return 2;
  if (v > 0.1) return 1;
  return 0;
});

const HEAT_COLORS = [Colors.line,'#DDD9FF','#9B8FFF',Colors.purpleAlt,Colors.purpleDk];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user, xp, streak, level, selectedCoach } = useAppStore();
  const { words } = useWordbook();
  const dynamicBadges = calcBadges(streak, xp, words.length);

  const xpInLevel  = xp % 400;
  const xpPct      = Math.round(xpInLevel / 400 * 100);
  const xpToNext   = 400 - xpInLevel;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* 히어로 헤더 */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 30 }}>{user?.avatar ?? '🦊'}</Text>
          </View>
          <Pressable style={s.editBtn}>
            <Text style={[Typography.label1, { color: '#fff' }]}>편집</Text>
          </Pressable>
        </View>
        <Text style={[Typography.h3, { color: '#fff', letterSpacing: -0.5 }]}>
          {user?.displayName ?? '지민'}
        </Text>
        <Text style={[Typography.body3, { color: 'rgba(255,255,255,0.6)', marginTop: 2, marginBottom: 10 }]}>
          {user?.grade ?? '중3'} · 천재교육
        </Text>
        <View style={s.heroBadge}>
          <Text style={{ fontSize: 10 }}>⭐</Text>
          <Text style={[Typography.label2, { color: '#fff' }]}>골드 리그 · 3위</Text>
        </View>

        {/* AI 코치 표시 */}
        <View style={s.coachRow}>
          <Text style={{ fontSize: 18 }}>{COACH_EMOJI[selectedCoach]}</Text>
          <Text style={[Typography.label2, { color: 'rgba(255,255,255,0.7)' }]}>
            {selectedCoach.charAt(0).toUpperCase() + selectedCoach.slice(1)} 코치와 학습 중
          </Text>
        </View>
      </View>

      {/* 통계 스트립 */}
      <View style={s.statsStrip}>
        {[
          { val: `${streak}`, lbl: '연속' },
          { val: '320',         lbl: '젬'  },
          { val: `Lv.${level}`, lbl: '레벨' },
          { val: '12',        lbl: '배지' },
        ].map((st, i) => (
          <View key={i} style={[s.statCell, i < 3 && { borderRightWidth: 0.5, borderRightColor: Colors.line }]}>
            <Text style={[Typography.statSm, { color: Colors.ink }]}>{st.val}</Text>
            <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 2 }]}>{st.lbl}</Text>
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: 18 }}>
        {/* XP 레벨 카드 */}
        <View style={[s.card, { marginBottom: 14, marginTop: 16 }]}>
          <View style={s.xpTopRow}>
            <Text style={[Typography.bold2]}>레벨 {level} → {level + 1}</Text>
            <Text style={[Typography.label1, { color: Colors.ink3 }]}>{xpInLevel} / 400 XP</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${xpPct}%` as any }]} />
          </View>
          <Text style={[Typography.label2, { color: Colors.brand, textAlign: 'right', marginTop: 5 }]}>
            {xpToNext} XP만 더 모으면 레벨업! 
          </Text>
        </View>

        {/* 학습 활동 히트맵 */}
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>학습 활동</Text>
          <Text style={[Typography.bold3, { color: Colors.orange }]}> {streak}일 연속</Text>
        </View>
        <View style={[s.card, { marginBottom: 14 }]}>
          <View style={s.heatRow}>
            {HEATMAP.map((v, i) => (
              <View key={i} style={[s.heatCell, { backgroundColor: HEAT_COLORS[v] }]} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={[Typography.label3, { color: Colors.ink3 }]}>10주 전</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[Typography.label3, { color: Colors.ink3 }]}>적음</Text>
              {HEAT_COLORS.map((c, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
              ))}
              <Text style={[Typography.label3, { color: Colors.ink3 }]}>많음</Text>
            </View>
          </View>
        </View>

        {/* 배지 컬렉션 */}
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>배지 컬렉션</Text>
          <Pressable><Text style={[Typography.label1, { color: Colors.brand }]}>12 / 36 →</Text></Pressable>
        </View>
        <View style={s.badgeGrid}>
          {dynamicBadges.map(b => (
            <View key={b.id} style={[s.badgeCard, !b.earned && { opacity: 0.4 }, b.isNew && { borderColor: Colors.brand, borderWidth: 2 }]}>
              {b.isNew && (
                <View style={s.newBadge}><Text style={[Typography.label3, { color: '#fff' }]}>NEW</Text></View>
              )}
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{b.icon}</Text>
              <Text style={[Typography.label2, { color: Colors.ink, textAlign: 'center' }]}>{b.name}</Text>
            </View>
          ))}
        </View>

        {/* 로그아웃 */}
        <Pressable style={s.signOutBtn} onPress={signOut}>
          <Text style={[Typography.bold3, { color: Colors.red }]}>로그아웃</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: Colors.bg },
  hero:       { backgroundColor: Colors.brand, paddingTop: 52, paddingHorizontal: 22, paddingBottom: 20 },
  heroTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  avatar:     { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  editBtn:    { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  heroBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  coachRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statsStrip: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  statCell:   { flex: 1, paddingVertical: 13, alignItems: 'center' },
  card:       { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.line, padding: 15 },
  xpTopRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  barTrack:   { height: 7, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  barFill:    { height: '100%', backgroundColor: Colors.brand, borderRadius: 99 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heatRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell:   { width: 12, height: 12, borderRadius: 2.5 },
  badgeGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  badgeCard:  { width: '22%', backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.line, padding: 12, alignItems: 'center', position: 'relative' },
  newBadge:   { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.red, borderRadius: 99, paddingHorizontal: 5, paddingVertical: 2 },
  signOutBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: Colors.redBg },
});
