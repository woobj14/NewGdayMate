// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  View, Text, Pressable, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

// 데모 코드 — Firestore 없을 때 fallback
const DEMO_CODES: Record<string, { academyId: string; academyName: string; teacherName: string; grade: string }> = {
  'SMART1': { academyId: 'academy-smart1', academyName: '새빛영어학원',  teacherName: '이재영 선생님', grade: '중3 A반' },
  'TOPENG': { academyId: 'academy-topeng', academyName: '탑클래스학원', teacherName: '박선영 선생님', grade: '중2 B반' },
  'BUDDY7': { academyId: 'academy-buddy7', academyName: "G'day Mate 체험", teacherName: '', grade: '자유 학습' },
};

type CodeStatus = 'idle' | 'loading' | 'ok' | 'error';

export default function AcademyCodeScreen() {
  const router = useRouter();
  const { email, password, role } = useLocalSearchParams<{
    email: string; password: string; role: string;
  }>();

  const [code,   setCode]   = useState('');
  const [status, setStatus] = useState<CodeStatus>('idle');
  const [found,  setFound]  = useState<typeof DEMO_CODES[string] | null>(null);

  const checkCode = async (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(upper);
    if (upper.length < 6) { setStatus('idle'); setFound(null); return; }
    setStatus('loading');

    try {
      // 회원가입 전에는 공개 joinCodes/{CODE} 문서만 조회
      const snap = await getDoc(doc(db, 'joinCodes', upper));

      if (snap.exists()) {
        const data = snap.data();
        setFound({
          academyId:   data.academyId ?? '',
          academyName: data.academyName ?? data.name ?? '',
          teacherName: data.teacherName ?? '',
          grade:       data.grade ?? '',
        });
        setStatus('ok');
      } else {
        // Firestore 없으면 데모 코드 확인
        const demo = DEMO_CODES[upper];
        if (demo) { setFound(demo); setStatus('ok'); }
        else       { setFound(null); setStatus('error'); }
      }
    } catch {
      // 오프라인 / 권한 없을 때 데모로 fallback
      const demo = DEMO_CODES[upper];
      if (demo) { setFound(demo); setStatus('ok'); }
      else       { setFound(null); setStatus('error'); }
    }
  };

  const handleNext = () => {
    if (status !== 'ok' || !found) return;
    router.push({
      pathname: '/onboarding/profile',
      params: {
        email,
        password,
        role,
        academyId:   found.academyId,
        academyName: found.academyName,
      },
    });
  };

  // 학원 코드 건너뛰기 (B2C — 개인 구매)
  const handleSkip = () => {
    router.push({
      pathname: '/onboarding/profile',
      params: { email, password, role, academyId: '', academyName: '' },
    });
  };

  const borderColor =
    status === 'ok'    ? Colors.green :
    status === 'error' ? Colors.red   :
    code.length > 0    ? Colors.brand : Colors.line;

  return (
    <View style={s.wrap}>
      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={{ fontSize: 18, color: Colors.ink3 }}>←</Text>
      </Pressable>

      <View style={s.dots}>
        {[false, false, true, false].map((a, i) => (
          <View key={i} style={[s.dot, a && s.dotActive]} />
        ))}
      </View>

      <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 6 }]}>Step 3 / 4</Text>
      <Text style={[Typography.h1, { marginBottom: 6 }]}>학원 코드를{'\n'}입력해 주세요</Text>
      <Text style={[Typography.body2, { color: Colors.ink3, marginBottom: 28, lineHeight: 24 }]}>
        선생님께 받은 6자리 코드를{'\n'}입력하면 자동으로 연결돼요.
      </Text>

      {/* 코드 입력 */}
      <Text style={s.inputLabel}>학원 코드</Text>
      <View style={[s.codeWrap, { borderColor }]}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={checkCode}
          placeholder="• • • • • •"
          placeholderTextColor={Colors.ink3}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {status === 'loading' && <ActivityIndicator color={Colors.brand} size="small" />}
        {status === 'ok'      && (
          <Text style={{fontSize:14}}>V</Text>
        )}
        {status === 'error'   && (
          <Text style={{fontSize:14}}>X</Text>
        )}
      </View>
      <Text style={[Typography.label3, { color: Colors.ink3, textAlign: 'center', marginBottom: 16 }]}>
        예시: SMART1 · TOPENG · BUDDY7
      </Text>

      {/* 결과 카드 */}
      {status === 'ok' && found && (
        <View style={s.resultCard}>
          <View style={s.resultIco}>
            <Text style={{fontSize:14}}>●</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bold2, { color: Colors.greenDk }]}>코드 확인됨</Text>
            <Text style={[Typography.body3, { color: Colors.ink }]}>{found.academyName}</Text>
            {found.teacherName ? (
              <Text style={[Typography.label2, { color: Colors.ink3 }]}>
                {found.teacherName}{found.grade ? ` · ${found.grade}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      )}
      {status === 'error' && (
        <View style={[s.resultCard, { backgroundColor: Colors.redBg, borderColor: '#fca5a5' }]}>
          <View style={[s.resultIco, { backgroundColor: '#fca5a5' }]}>
            <Text style={{fontSize:14}}>●</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bold2, { color: Colors.red }]}>코드를 찾을 수 없어요</Text>
            <Text style={[Typography.body3, { color: Colors.ink3 }]}>선생님께 다시 확인해 주세요.</Text>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />

      {/* 버튼 */}
      <Pressable
        style={[s.nextBtn, status !== 'ok' && { opacity: 0.4 }]}
        onPress={handleNext}
        disabled={status !== 'ok'}
      >
        <Text style={[Typography.bold1, { color: '#fff', letterSpacing: -.3 }]}>다음으로</Text>
      </Pressable>

      {/* 건너뛰기 — 개인 학습 */}
      <Pressable style={{ marginTop: 12, alignItems: 'center' }} onPress={handleSkip}>
        <Text style={[Typography.body3, { color: Colors.ink3 }]}>
          학원 코드 없이 개인으로 시작하기
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: Colors.white, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  backBtn:    { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dots:       { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  dotActive:  { width: 20, borderRadius: 3, backgroundColor: Colors.brand },
  inputLabel: { ...Typography.label2, color: Colors.ink3, marginBottom: 8 },
  codeWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg, borderWidth: 2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8 },
  codeInput:  { flex: 1, fontFamily: 'Pretendard-Bold', fontSize: 22, color: Colors.ink, letterSpacing: 6, textAlign: 'center' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.greenBg, borderWidth: 1, borderColor: '#86efac', borderRadius: 14, padding: 14, marginBottom: 14 },
  resultIco:  { width: 36, height: 36, borderRadius: 11, backgroundColor: '#86efac', alignItems: 'center', justifyContent: 'center' },
  nextBtn:    { borderRadius: 16, backgroundColor: Colors.brand, paddingVertical: 17, alignItems: 'center' },
});
