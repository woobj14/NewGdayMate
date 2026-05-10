// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

type Role = 'student' | 'teacher';

const ROLES = [
  {
    key:   'student' as Role,
    name:  '학생',
    desc:  '단어부터 모의고사까지,\n내 레벨에 맞게 학습해요',
    color: Colors.brand,
    bg:    Colors.brandBg,
  },
  {
    key:   'teacher' as Role,
    name:  '선생님',
    desc:  '자료 업로드부터 학생 관리까지,\n수업을 더 스마트하게',
    color: Colors.orange,
    bg:    Colors.orangeBg,
  },
];

export default function RoleScreen() {
  const router = useRouter();
  const { region, email, password, phoneNumber, authMethod } = useLocalSearchParams<{
    region?: string;
    email?: string;
    password?: string;
    phoneNumber?: string;
    authMethod?: 'password' | 'google';
  }>();
  const [sel, setSel] = useState<Role | null>(null);

  const handleNext = () => {
    if (!sel) return;
    router.push({
      pathname: '/onboarding/profile',
      params:   { region, email, password, phoneNumber, authMethod, role: sel },
    });
  };

  return (
    <View style={s.wrap}>
      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: Colors.ink3 }}>←</Text>
      </Pressable>

      <View style={s.dots}>
        {[false, true, false].map((a, i) => (
          <View key={i} style={[s.dot, a && s.dotActive]} />
        ))}
      </View>

      <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 6 }]}>Step 2 / 3</Text>
      <Text style={[Typography.h1, { marginBottom: 6 }]}>어떤 역할로{'\n'}시작할까요?</Text>
      <Text style={[Typography.body2, { color: Colors.ink3, marginBottom: 28, lineHeight: 24 }]}>
        역할에 맞는 맞춤 환경을{'\n'}준비해 드릴게요.
      </Text>

      <View style={s.list}>
        {ROLES.map(r => (
          <Pressable
            key={r.key}
            onPress={() => setSel(r.key)}
            style={[s.card, sel === r.key && { borderColor: r.color, borderWidth: 2 }]}
          >
            <View style={[s.roleIco, { backgroundColor: r.bg }]}>
              {/* Lucide 아이콘: 역할별 */}
              {r.key === 'student' && (
                <Text style={{fontSize:14}}>●</Text>
              )}
              {r.key === 'teacher' && (
                <Text style={{fontSize:14}}>●</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.bold1, { marginBottom: 3 }]}>{r.name}</Text>
              <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 19 }]}>{r.desc}</Text>
            </View>
            <View style={[s.radio, sel === r.key && { backgroundColor: r.color, borderColor: r.color }]}>
              {sel === r.key && (
                <Text style={{fontSize:14}}>V</Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[s.nextBtn, !sel && { opacity: 0.4 }]}
        onPress={handleNext}
        disabled={!sel}
      >
        <Text style={[Typography.bold1, { color: '#fff', letterSpacing: -.3 }]}>다음으로</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn:   { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dots:      { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  dotActive: { width: 20, borderRadius: 3, backgroundColor: Colors.brand },
  list:      { flex: 1, gap: 10, marginBottom: 28 },
  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.line, padding: 18 },
  roleIco:   { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radio:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  nextBtn:   { borderRadius: 16, backgroundColor: Colors.brand, paddingVertical: 17, alignItems: 'center' },
});
