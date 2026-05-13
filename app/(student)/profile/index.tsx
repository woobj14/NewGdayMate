import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../../stores/useAppStore';
import { useAuth } from '../../../hooks/useAuth';
import { useWordbook } from '../../../hooks/useWordbook';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { ScoreBand } from '../../../stores/useAppStore';
import { getRecommendedScoreBand, SCORE_BAND_META } from '../../../lib/scoreBand';

const AVATARS = ['🦊','🐯','🐻','🐰','🦁','🐧','🦉','🐸'];
const GRADES  = ['중1','중2','중3','고1','고2','고3'];
const SCORE_BANDS: Array<{ key: ScoreBand; label: string; desc: string }> = Object.entries(SCORE_BAND_META).map(([key, value]) => ({
  key: key as ScoreBand,
  ...value,
}));

export default function ProfileScreen() {
  const router = useRouter();
  const { user, xp, streak, level } = useAppStore();
  const { words } = useWordbook();
  const { signOut, updateAccount, resetPassword, deleteAccount } = useAuth();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [region, setRegion] = useState(user?.region ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '🦊');
  const [grade, setGrade] = useState(user?.grade ?? '중3');
  const [scoreBand, setScoreBand] = useState<ScoreBand>(user?.scoreBand ?? '80s');
  const [loading, setLoading] = useState(false);
  const recommendedBand = getRecommendedScoreBand(user?.latestMockScore);
  const showRecommendation = !!recommendedBand && recommendedBand !== scoreBand;

  const xpInLevel = xp % 400;
  const levelPct = Math.round((xpInLevel / 400) * 100);
  const accountSummary = useMemo(() => [
    { label: '학원 이름', value: user?.academyName ?? '-' },
    { label: '학습 트랙', value: SCORE_BANDS.find(item => item.key === (user?.scoreBand ?? '80s'))?.label ?? 'Pro Track' },
    { label: '이메일', value: user?.email ?? '-' },
    { label: '휴대폰', value: user?.phoneNumber ?? '-' },
    { label: '지역', value: user?.region ?? '-' },
  ], [user?.academyName, user?.email, user?.phoneNumber, user?.region, user?.scoreBand]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateAccount({ displayName: displayName.trim(), region: region.trim(), avatar, grade, scoreBand });
      setEditing(false);
    } catch (error: any) {
      Alert.alert('저장 실패', error?.message ?? '회원정보를 저장하지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      Alert.alert('비밀번호 변경', '비밀번호 재설정 메일을 보냈어요.');
    } catch (error: any) {
      Alert.alert('전송 실패', error?.message ?? '비밀번호 재설정 메일을 보내지 못했어요.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert('회원탈퇴', '정말 탈퇴할까요? 가입 정보와 진행 기록이 삭제될 수 있어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '탈퇴',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } catch (error: any) {
            Alert.alert('탈퇴 실패', error?.message ?? '회원탈퇴를 완료하지 못했어요.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.hero}>
        <View style={s.heroTop}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
          </Pressable>
          <Pressable style={s.editBtn} onPress={() => (editing ? handleSave() : setEditing(true))} disabled={loading}>
            <Text style={[Typography.label1, { color: '#fff' }]}>{editing ? (loading ? '저장 중' : '저장') : '편집'}</Text>
          </Pressable>
        </View>

        <View style={s.avatar}>
          <Text style={{ fontSize: 32 }}>{avatar}</Text>
        </View>
        <Text style={[Typography.h3, { color: '#fff', marginTop: 14 }]}>{user?.displayName ?? '학생'}</Text>
        <Text style={[Typography.body3, { color: 'rgba(255,255,255,0.72)', marginTop: 4 }]}>
          {user?.grade ?? '중3'} · {user?.region ?? '지역 미설정'}
        </Text>
        <View style={s.heroBadge}>
          <Text style={[Typography.label2, { color: '#fff' }]}>
            학생 계정 · {SCORE_BANDS.find(item => item.key === (user?.scoreBand ?? '80s'))?.label ?? 'Pro Track'}
          </Text>
        </View>
      </View>

      <View style={s.statsStrip}>
        {[
          { val: `${streak}`, lbl: '연속' },
          { val: `${words.length}`, lbl: '단어장' },
          { val: `Lv.${level}`, lbl: '레벨' },
          { val: `${xp}`, lbl: 'XP' },
        ].map((item, i) => (
          <View key={item.lbl} style={[s.statCell, i < 3 && { borderRightWidth: 0.5, borderRightColor: Colors.line }]}>
            <Text style={[Typography.statSm, { color: Colors.ink }]}>{item.val}</Text>
            <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 2 }]}>{item.lbl}</Text>
          </View>
        ))}
      </View>

      <View style={s.content}>
        <View style={s.card}>
          <Text style={[Typography.bold2, { marginBottom: 10 }]}>레벨 진행도</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${levelPct}%` as any }]} />
          </View>
          <Text style={[Typography.label2, { color: Colors.brand, marginTop: 6 }]}>
            다음 레벨까지 {400 - xpInLevel} XP
          </Text>
        </View>

        {editing && (
          <View style={s.card}>
            <Text style={[Typography.bold2, { marginBottom: 10 }]}>회원정보 수정</Text>
            <Text style={s.label}>별명</Text>
            <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="별명" placeholderTextColor={Colors.ink3} />

            <Text style={s.label}>지역</Text>
            <TextInput style={s.input} value={region} onChangeText={setRegion} placeholder="예: 서울 강남구" placeholderTextColor={Colors.ink3} />

            <Text style={s.label}>학년</Text>
            <View style={s.gradeGrid}>
              {GRADES.map(item => (
                <Pressable key={item} style={[s.gradeBtn, grade === item && s.gradeBtnActive]} onPress={() => setGrade(item)}>
                  <Text style={[Typography.label2, { color: grade === item ? '#fff' : Colors.ink3 }]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>학습 코스</Text>
            {showRecommendation && (
              <Pressable style={s.recommendBanner} onPress={() => setScoreBand(recommendedBand!)}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.label2, { color: Colors.brand, marginBottom: 3 }]}>최근 학습 흐름 기반 추천</Text>
                  <Text style={[Typography.bold3, { color: Colors.ink }]}>
                    지금은 {SCORE_BAND_META[recommendedBand!].label}이 더 잘 맞아요
                  </Text>
                </View>
                <Text style={[Typography.bold3, { color: Colors.brand }]}>적용</Text>
              </Pressable>
            )}
            <View style={s.scoreBandGrid}>
              {SCORE_BANDS.map(item => (
                <Pressable key={item.key} style={[s.scoreBandBtn, scoreBand === item.key && s.scoreBandBtnActive]} onPress={() => setScoreBand(item.key)}>
                  <Text style={[Typography.bold3, { color: scoreBand === item.key ? '#fff' : Colors.ink }]}>{item.label}</Text>
                  <Text style={[Typography.label3, { color: scoreBand === item.key ? 'rgba(255,255,255,.8)' : Colors.ink3, marginTop: 3 }]}>{item.desc}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>아바타</Text>
            <View style={s.avatarGrid}>
              {AVATARS.map(item => (
                <Pressable key={item} style={[s.avatarBtn, avatar === item && s.avatarBtnActive]} onPress={() => setAvatar(item)}>
                  <Text style={{ fontSize: 24 }}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={s.card}>
          <Text style={[Typography.bold2, { marginBottom: 10 }]}>회원 정보</Text>
          {accountSummary.map(item => (
            <View key={item.label} style={s.infoRow}>
              <Text style={[Typography.label2, { color: Colors.ink3 }]}>{item.label}</Text>
              <Text style={[Typography.bold3, { color: Colors.ink }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <Pressable style={s.actionBtn} onPress={handlePasswordReset}>
          <Text style={[Typography.bold3, { color: Colors.brand }]}>비밀번호 변경 메일 보내기</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={signOut}>
          <Text style={[Typography.bold3, { color: Colors.ink }]}>로그아웃</Text>
        </Pressable>
        <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={handleDeleteAccount}>
          <Text style={[Typography.bold3, { color: Colors.red }]}>회원탈퇴</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  hero: { backgroundColor: Colors.brand, paddingTop: 52, paddingHorizontal: 22, paddingBottom: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  editBtn: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', paddingHorizontal: 14, paddingVertical: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  heroBadge: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.18)' },
  statsStrip: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  statCell: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 14 },
  card: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.line, padding: 15 },
  barTrack: { height: 7, backgroundColor: Colors.line, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.brand, borderRadius: 99 },
  label: { ...Typography.label2, color: Colors.ink3, marginBottom: 8, marginTop: 2 },
  input: { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.ink, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  gradeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  gradeBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white },
  gradeBtnActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  scoreBandGrid: { gap: 8, marginBottom: 14 },
  recommendBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.brandBg, borderRadius: 14, borderWidth: 1, borderColor: '#DDD9FF', padding: 12, marginBottom: 10 },
  scoreBandBtn: { borderRadius: 14, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  scoreBandBtnActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarBtn: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarBtnActive: { borderColor: Colors.brand, backgroundColor: Colors.brandBg },
  actionBtn: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.line, paddingVertical: 15, alignItems: 'center' },
  deleteBtn: { borderColor: '#fca5a5', backgroundColor: Colors.redBg, marginBottom: 6 },
});
