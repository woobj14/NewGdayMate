// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  View, Text, Pressable, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

type Mode = 'landing' | 'signup' | 'login';

export default function SplashScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [mode,     setMode]     = useState<Mode>('landing');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // 로그인 처리
  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      // useAuth 내부에서 역할별 라우팅 처리
    } catch (e: any) {
      const msg =
        e.code === 'firestore/profile-read-timeout' ? 'Firestore Database/API를 활성화한 뒤 다시 시도해 주세요.' :
        e.code === 'auth/profile-not-found'         ? '프로필 정보가 없어요. 다시 회원가입해 주세요.' :
        '이메일 또는 비밀번호를 확인해 주세요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 회원가입은 다음 단계(role)로 이메일/비번 전달
  const handleSignupNext = () => {
    if (!email.trim() || password.length < 6) {
      setError('이메일과 6자 이상의 비밀번호를 입력해 주세요.');
      return;
    }
    setError('');
    router.push({
      pathname: '/onboarding/role',
      params: { email: email.trim(), password },
    });
  };

  // 랜딩 화면
  if (mode === 'landing') {
    return (
      <View style={s.wrap}>
        <View style={s.logoWrap}>
          <View style={s.logoIco}>
            <Text style={{fontSize:14}}>●</Text>
          </View>
        </View>
        <Text style={[Typography.h1, s.wordmark]}>
          G'day <Text style={{ color: Colors.brand }}>Mate</Text>
        </Text>
        <Text style={[Typography.body1, s.sub]}>
          AI와 함께하는{'\n'}스마트 내신 영어
        </Text>

        <View style={s.btns}>
          <Pressable style={s.btnPrimary} onPress={() => setMode('signup')}>
            <Text style={s.btnPrimaryTxt}>시작하기</Text>
          </Pressable>
          <Pressable style={s.btnGhost} onPress={() => setMode('login')}>
            <Text style={s.btnGhostTxt}>이미 계정이 있어요</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 회원가입 / 로그인 공통 폼
  const isLogin = mode === 'login';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable style={s.backBtn} onPress={() => { setMode('landing'); setError(''); }}>
          <Text style={{ fontSize: 18, color: Colors.ink3 }}>←</Text>
        </Pressable>

        {/* 스텝 인디케이터 — 회원가입만 */}
        {!isLogin && (
          <View style={s.dots}>
            {[true, false, false, false].map((a, i) => (
              <View key={i} style={[s.dot, a && s.dotActive]} />
            ))}
          </View>
        )}

        <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 6 }]}>
          {isLogin ? '로그인' : 'Step 1 / 4'}
        </Text>
        <Text style={[Typography.h1, { marginBottom: 6 }]}>
          {isLogin ? '다시 만나서\n반가워요' : '계정을\n만들어 볼게요'}
        </Text>
        <Text style={[Typography.body2, { color: Colors.ink3, marginBottom: 28, lineHeight: 24 }]}>
          {isLogin
            ? '학습 기록이 기다리고 있어요.'
            : '이메일과 비밀번호를 입력해 주세요.'}
        </Text>

        {/* 이메일 */}
        <Text style={s.inputLabel}>이메일</Text>
        <TextInput
          style={[s.input, email.length > 0 && { borderColor: Colors.brand }]}
          value={email}
          onChangeText={v => { setEmail(v); setError(''); }}
          placeholder="example@email.com"
          placeholderTextColor={Colors.ink3}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* 비밀번호 */}
        <Text style={s.inputLabel}>비밀번호</Text>
        <TextInput
          style={[s.input, password.length > 0 && { borderColor: Colors.brand }]}
          value={password}
          onChangeText={v => { setPassword(v); setError(''); }}
          placeholder={isLogin ? '비밀번호' : '6자 이상'}
          placeholderTextColor={Colors.ink3}
          secureTextEntry
        />

        {/* 에러 메시지 */}
        {error ? (
          <Text style={[Typography.label2, { color: Colors.red, marginBottom: 10 }]}>{error}</Text>
        ) : null}

        {/* 버튼 */}
        <Pressable
          style={[s.btnPrimary, (!email || !password || loading) && { opacity: 0.4 }]}
          onPress={isLogin ? handleLogin : handleSignupNext}
          disabled={!email || !password || loading}
        >
          <Text style={s.btnPrimaryTxt}>
            {loading ? '확인 중...' : isLogin ? '로그인' : '다음으로'}
          </Text>
        </Pressable>

        {/* 모드 전환 */}
        <Pressable style={{ marginTop: 20, alignItems: 'center' }}
          onPress={() => { setMode(isLogin ? 'signup' : 'login'); setError(''); }}>
          <Text style={[Typography.body3, { color: Colors.ink3 }]}>
            {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
            <Text style={{ color: Colors.brand, fontWeight: '700' }}>
              {isLogin ? '회원가입' : '로그인'}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap:         { flexGrow: 1, backgroundColor: Colors.white, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  logoWrap:     { alignItems: 'center', marginBottom: 20 },
  logoIco:      { width: 68, height: 68, borderRadius: 20, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center' },
  wordmark:     { textAlign: 'center', marginBottom: 8 },
  sub:          { color: Colors.ink3, textAlign: 'center', marginBottom: 52, lineHeight: 26 },
  btns:         { width: '100%', gap: 10 },
  btnPrimary:   { backgroundColor: Colors.brand, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryTxt:{ ...Typography.bold1, color: '#fff', letterSpacing: -.3 },
  btnGhost:     { borderRadius: 16, borderWidth: 1.5, borderColor: Colors.line, paddingVertical: 14, alignItems: 'center' },
  btnGhostTxt:  { ...Typography.bold2, color: Colors.ink2 },
  backBtn:      { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dots:         { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  dotActive:    { width: 20, borderRadius: 3, backgroundColor: Colors.brand },
  inputLabel:   { ...Typography.label2, color: Colors.ink3, marginBottom: 8, marginTop: 4 },
  input:        { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontFamily: 'Pretendard-Regular', fontSize: 15, color: Colors.ink, marginBottom: 14 },
});
