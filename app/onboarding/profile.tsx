// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

const AVATARS = ['🦊','🐯','🐻','🐰','🦁','🐧','🦉','🐸'];
const GRADES  = ['중1','중2','중3','고1','고2','고3'];

export default function ProfileScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const { email, password, role, academyId, academyName } = useLocalSearchParams<{
    email:       string;
    password:    string;
    role:        string;
    academyId:   string;
    academyName: string;
  }>();

  const [avatar,  setAvatar]  = useState('🦊');
  const [name,    setName]    = useState('');
  const [grade,   setGrade]   = useState(2);   // 중3 기본
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const canNext = name.trim().length > 0;

  const handleFinish = async () => {
    if (!canNext) return;
    setLoading(true);
    setError('');
    try {
      await signUp({
        email:       email ?? '',
        password:    password ?? '',
        displayName: name.trim(),
        avatar,
        role:        (role as 'student' | 'teacher' | 'admin') ?? 'student',
        grade:       GRADES[grade],
        academyId:   academyId || undefined,
        accountType: academyId ? 'b2b' : 'b2c',
      });
      router.replace('/student-home' as any);
    } catch (e: any) {
      console.error('[ProfileScreen] signUp failed:', e.code, e.message);
      const msg =
        e.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일이에요.' :
        e.code === 'auth/weak-password'         ? '비밀번호가 너무 약해요.' :
        e.code === 'auth/invalid-email'         ? '올바른 이메일 형식이 아니에요.' :
        e.code === 'auth/operation-not-allowed' ? 'Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해 주세요.' :
        e.code === 'auth/configuration-not-found' ? 'Firebase Auth 설정을 확인해 주세요. 이메일/비밀번호 로그인이 꺼져 있거나 키가 다른 프로젝트일 수 있어요.' :
        e.code === 'firestore/profile-write-timeout' ? 'Firestore Database/API를 활성화한 뒤 다시 시도해 주세요.' :
        e.code === 'permission-denied'          ? 'Firestore users 쓰기 권한을 확인해 주세요.' :
        '가입 중 오류가 발생했어요. 다시 시도해 주세요.';
      setError(msg);
      Alert.alert('가입 실패', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.white }}
      contentContainerStyle={s.wrap}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: Colors.ink3 }}>←</Text>
      </Pressable>

      <View style={s.dots}>
        {[false, false, false, true].map((a, i) => (
          <View key={i} style={[s.dot, a && s.dotActive]} />
        ))}
      </View>

      <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 6 }]}>Step 4 / 4</Text>
      <Text style={[Typography.h1, { marginBottom: 6 }]}>프로필을{'\n'}만들어 봐요</Text>
      <Text style={[Typography.body2, { color: Colors.ink3, marginBottom: 24, lineHeight: 24 }]}>
        AI 코치가 딱 맞게 도와줄 수{'\n'}있도록 알려주세요.
      </Text>

      {/* 학원 정보 표시 */}
      {academyName ? (
        <View style={s.academyBadge}>
          <Text style={{fontSize:14}}>●</Text>
          <Text style={[Typography.bold3, { color: Colors.greenDk }]}>{academyName}</Text>
        </View>
      ) : null}

      {/* 아바타 */}
      <Text style={s.sectionLabel}>아바타</Text>
      <View style={s.avatarGrid}>
        {AVATARS.map(a => (
          <Pressable
            key={a}
            onPress={() => setAvatar(a)}
            style={[s.avaBtn, avatar === a && { borderColor: Colors.brand, backgroundColor: Colors.brandBg }]}
          >
            <Text style={{ fontSize: 28 }}>{a}</Text>
          </Pressable>
        ))}
      </View>

      {/* 닉네임 */}
      <Text style={s.sectionLabel}>이름 (닉네임)</Text>
      <TextInput
        style={[s.input, name.length > 0 && { borderColor: Colors.brand }]}
        value={name}
        onChangeText={v => { setName(v); setError(''); }}
        placeholder="예: 지민, 민준, 서윤"
        placeholderTextColor={Colors.ink3}
        maxLength={12}
      />

      {/* 학년 — 학생만 표시 */}
      {role === 'student' && (
        <>
          <Text style={s.sectionLabel}>학년</Text>
          <View style={s.gradeGrid}>
            {GRADES.map((g, i) => (
              <Pressable
                key={g}
                onPress={() => setGrade(i)}
                style={[s.gradeBtn, grade === i && { backgroundColor: Colors.brand, borderColor: Colors.brand }]}
              >
                <Text style={[Typography.bold2, { color: grade === i ? '#fff' : Colors.ink3 }]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* AI 코치 안내 */}
      <View style={s.coachPreview}>
        <Text style={{ fontSize: 20 }}>‍</Text>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.bold3, { color: Colors.brand }]}>Betty · 기본 AI 코치</Text>
          <Text style={[Typography.label2, { color: Colors.ink3 }]}>시작 후 언제든지 변경 가능해요</Text>
        </View>
      </View>

      {error ? (
        <Text style={[Typography.label2, { color: Colors.red, marginBottom: 10 }]}>{error}</Text>
      ) : null}

      {/* 완료 버튼 */}
      <Pressable
        style={[s.doneBtn, (!canNext || loading) && { opacity: 0.4 }]}
        onPress={handleFinish}
        disabled={!canNext || loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={[Typography.bold1, { color: '#fff', letterSpacing: -.3 }]}>시작하기 </Text>
        }
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:         { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dots:         { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  dotActive:    { width: 20, borderRadius: 3, backgroundColor: Colors.brand },
  academyBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.greenBg, borderWidth: 1, borderColor: '#86efac', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 16, alignSelf: 'flex-start' },
  sectionLabel: { ...Typography.label2, color: Colors.ink3, marginBottom: 10, marginTop: 4 },
  avatarGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  avaBtn:       { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.bg, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  input:        { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: Colors.ink, marginBottom: 20 },
  gradeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  gradeBtn:     { flex: 1, minWidth: '28%', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center' },
  coachPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.brandBg, borderRadius: 16, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#DDD9FF' },
  doneBtn:      { borderRadius: 16, backgroundColor: Colors.brand, paddingVertical: 17, alignItems: 'center' },
});
