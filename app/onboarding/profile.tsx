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

  const { region: initialRegion, email, password, phoneNumber: initialPhoneNumber, role, authMethod } = useLocalSearchParams<{
    region?: string;
    email?: string;
    password?: string;
    phoneNumber?: string;
    role?: string;
    authMethod?: 'password' | 'google';
  }>();

  const [avatar,  setAvatar]  = useState('🦊');
  const [name,    setName]    = useState('');
  const [grade,   setGrade]   = useState(2);   // 중3 기본
  const [region, setRegion] = useState(initialRegion ?? '');
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [academyName, setAcademyName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';
  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  const canNext = (
    name.trim().length > 0 &&
    region.trim().length > 0 &&
    normalizedPhone.length >= 10 &&
    (!isTeacher || academyName.trim().length > 0) &&
    (!isStudent || teacherCode.trim().length >= 6)
  );

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
        role:        (role as 'student' | 'teacher') ?? 'student',
        grade:       isStudent ? GRADES[grade] : undefined,
        region:      region.trim(),
        phoneNumber: normalizedPhone,
        academyName: isTeacher ? academyName.trim() : undefined,
        teacherCode: isStudent ? teacherCode.trim().toUpperCase() : undefined,
        accountType: 'b2b',
        authMethod: authMethod ?? 'password',
      });
      if (authMethod === 'google') {
        router.replace(isTeacher ? '/teacher-home' : '/student-home');
      } else {
        Alert.alert('이메일 인증 필요', '인증 메일을 보냈어요. 메일함에서 인증을 완료한 뒤 로그인해 주세요.', [
          { text: '확인', onPress: () => router.replace('/onboarding/splash') },
        ]);
      }
    } catch (e: any) {
      console.error('[ProfileScreen] signUp failed:', e.code, e.message);
      const msg =
        e.code === 'auth/email-already-in-use' ? '이미 사용 중인 이메일이에요.' :
        e.code === 'auth/phone-already-in-use' ? '이미 가입된 휴대폰 번호예요.' :
        e.code === 'auth/weak-password'         ? '비밀번호는 영문 대소문자, 숫자, 특수문자를 포함한 8자 이상이어야 해요.' :
        e.code === 'auth/invalid-email'         ? '올바른 이메일 형식이 아니에요.' :
        e.code === 'auth/invalid-phone-number'  ? '휴대폰 번호를 정확히 입력해 주세요.' :
        e.code === 'auth/academy-name-required' ? '학원 이름을 입력해 주세요.' :
        e.code === 'auth/email-not-verified'    ? '이메일 인증을 완료한 뒤 다시 로그인해 주세요.' :
        e.code === 'auth/teacher-code-required' ? '학생 가입에는 선생님 코드가 필요해요.' :
        e.code === 'auth/teacher-code-not-found' ? '선생님 코드를 찾을 수 없어요. 다시 확인해 주세요.' :
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
        {[false, false, true].map((a, i) => (
            <View key={i} style={[s.dot, a && s.dotActive]} />
          ))}
        </View>

      <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 6 }]}>Step 3 / 3</Text>
      <Text style={[Typography.h1, { marginBottom: 6 }]}>프로필을{'\n'}만들어 봐요</Text>
      <Text style={[Typography.body2, { color: Colors.ink3, marginBottom: 24, lineHeight: 24 }]}>
        {isTeacher
          ? '가입이 완료되면 선생님 코드가 자동으로 생성돼요.'
          : '선생님 코드를 입력하면 담당 선생님과 자동 연결돼요.'}
      </Text>

      {!!(email || authMethod === 'google') && (
        <View style={s.infoBadge}>
          <Text style={{fontSize:14}}>●</Text>
          <Text style={[Typography.bold3, { color: Colors.greenDk }]}>
            {authMethod === 'google' ? 'Google 계정으로 인증됨' : email}
          </Text>
        </View>
      )}

      <Text style={s.sectionLabel}>지역</Text>
      <TextInput
        style={[s.input, region.length > 0 && { borderColor: Colors.brand }]}
        value={region}
        onChangeText={v => { setRegion(v); setError(''); }}
        placeholder="예: 서울 강남구"
        placeholderTextColor={Colors.ink3}
        maxLength={20}
      />

      <Text style={s.sectionLabel}>휴대폰 번호</Text>
      <TextInput
        style={[s.input, phoneNumber.length > 0 && { borderColor: Colors.brand }]}
        value={phoneNumber}
        onChangeText={v => { setPhoneNumber(v); setError(''); }}
        placeholder="01012345678"
        placeholderTextColor={Colors.ink3}
        keyboardType="phone-pad"
        maxLength={13}
      />

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
      {isStudent && (
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

      {isStudent ? (
        <>
          <Text style={s.sectionLabel}>선생님 코드</Text>
          <TextInput
            style={[s.input, teacherCode.length > 0 && { borderColor: Colors.brand }]}
            value={teacherCode}
            onChangeText={v => { setTeacherCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(''); }}
            placeholder="예: AB12CD"
            placeholderTextColor={Colors.ink3}
            autoCapitalize="characters"
            maxLength={6}
          />
        </>
      ) : (
        <>
          <Text style={s.sectionLabel}>학원 이름</Text>
          <TextInput
            style={[s.input, academyName.length > 0 && { borderColor: Colors.brand }]}
            value={academyName}
            onChangeText={v => { setAcademyName(v); setError(''); }}
            placeholder="예: 새빛영어학원"
            placeholderTextColor={Colors.ink3}
            maxLength={24}
          />

          <View style={s.codePreview}>
            <Text style={[Typography.bold3, { color: Colors.brand, marginBottom: 4 }]}>선생님 코드 자동 생성</Text>
            <Text style={[Typography.label2, { color: Colors.ink3, lineHeight: 18 }]}>
              회원가입이 완료되면 학생들이 입력할 6자리 선생님 코드가 자동으로 발급됩니다.
            </Text>
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
  infoBadge:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.greenBg, borderWidth: 1, borderColor: '#86efac', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 16, alignSelf: 'flex-start' },
  sectionLabel: { ...Typography.label2, color: Colors.ink3, marginBottom: 10, marginTop: 4 },
  avatarGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  avaBtn:       { width: 60, height: 60, borderRadius: 18, backgroundColor: Colors.bg, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  input:        { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Pretendard-SemiBold', fontSize: 16, color: Colors.ink, marginBottom: 20 },
  gradeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  gradeBtn:     { flex: 1, minWidth: '28%', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center' },
  codePreview:  { backgroundColor: Colors.brandBg, borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#DDD9FF' },
  coachPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.brandBg, borderRadius: 16, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#DDD9FF' },
  doneBtn:      { borderRadius: 16, backgroundColor: Colors.brand, paddingVertical: 17, alignItems: 'center' },
});
