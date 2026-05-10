import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../../stores/useAppStore';
import { useAuth } from '../../../hooks/useAuth';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

const AVATARS = ['🦊','🐯','🐻','🐰','🦁','🐧','🦉','🐸'];
const TIER_LABEL: Record<string, string> = {
  basic: '베이직',
  professional: '프로페셔널',
  superb: '슈퍼비',
};

export default function TeacherProfileScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const { signOut, updateAccount, resetPassword, deleteAccount } = useAuth();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [region, setRegion] = useState(user?.region ?? '');
  const [academyName, setAcademyName] = useState(user?.academyName ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '🦊');
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => [
    { label: '등급', value: TIER_LABEL[user?.membershipTier ?? 'basic'] ?? '베이직' },
    { label: '선생님 코드', value: user?.teacherCode ?? '자동 생성 대기' },
    { label: '학원 이름', value: user?.academyName ?? '-' },
    { label: '이메일', value: user?.email ?? '-' },
    { label: '휴대폰', value: user?.phoneNumber ?? '-' },
    { label: '지역', value: user?.region ?? '-' },
  ], [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAccount({ displayName: displayName.trim(), region: region.trim(), academyName: academyName.trim(), avatar });
      setEditing(false);
    } catch (error: any) {
      Alert.alert('저장 실패', error?.message ?? '회원정보를 저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      Alert.alert('비밀번호 변경', '비밀번호 재설정 메일을 보냈어요.');
    } catch (error: any) {
      Alert.alert('전송 실패', error?.message ?? '비밀번호 재설정 메일을 보내지 못했어요.');
    }
  };

  const handleDelete = () => {
    Alert.alert('회원탈퇴', '정말 탈퇴할까요? 선생님 코드와 연결 정보도 함께 정리돼요.', [
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
          <Pressable style={s.editBtn} onPress={() => (editing ? handleSave() : setEditing(true))} disabled={saving}>
            <Text style={[Typography.label1, { color: '#fff' }]}>{editing ? (saving ? '저장 중' : '저장') : '편집'}</Text>
          </Pressable>
        </View>
        <View style={s.avatar}>
          <Text style={{ fontSize: 32 }}>{avatar}</Text>
        </View>
        <Text style={[Typography.h3, { color: '#fff', marginTop: 14 }]}>{user?.displayName ?? '선생님'}</Text>
        <Text style={[Typography.body3, { color: 'rgba(255,255,255,0.72)', marginTop: 4 }]}>
          {TIER_LABEL[user?.membershipTier ?? 'basic'] ?? '베이직'} 플랜
        </Text>
        <View style={s.codeChip}>
          <Text style={[Typography.bold3, { color: '#fff' }]}>선생님 코드 {user?.teacherCode ?? '-'}</Text>
        </View>
      </View>

      <View style={s.content}>
        {editing && (
          <View style={s.card}>
            <Text style={[Typography.bold2, { marginBottom: 10 }]}>회원정보 수정</Text>
            <Text style={s.label}>별명</Text>
            <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="별명" placeholderTextColor={Colors.ink3} />

            <Text style={s.label}>지역</Text>
            <TextInput style={s.input} value={region} onChangeText={setRegion} placeholder="예: 서울 강남구" placeholderTextColor={Colors.ink3} />

            <Text style={s.label}>학원 이름</Text>
            <TextInput style={s.input} value={academyName} onChangeText={setAcademyName} placeholder="예: 새빛영어학원" placeholderTextColor={Colors.ink3} />

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
          {summary.map(item => (
            <View key={item.label} style={s.infoRow}>
              <Text style={[Typography.label2, { color: Colors.ink3 }]}>{item.label}</Text>
              <Text style={[Typography.bold3, { color: Colors.ink }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.planCard}>
          <Text style={[Typography.bold2, { color: Colors.ink, marginBottom: 6 }]}>선생님 요금제</Text>
          <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 20 }]}>
            현재는 {TIER_LABEL[user?.membershipTier ?? 'basic']} 플랜으로 등록되어 있어요. 추후 학생 수 기준 결제 정책과 연동할 수 있게 구조를 열어두었습니다.
          </Text>
        </View>

        <Pressable style={s.actionBtn} onPress={handleResetPassword}>
          <Text style={[Typography.bold3, { color: Colors.brand }]}>비밀번호 변경 메일 보내기</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={signOut}>
          <Text style={[Typography.bold3, { color: Colors.ink }]}>로그아웃</Text>
        </Pressable>
        <Pressable style={[s.actionBtn, s.deleteBtn]} onPress={handleDelete}>
          <Text style={[Typography.bold3, { color: Colors.red }]}>회원탈퇴</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  hero: { backgroundColor: Colors.orange, paddingTop: 52, paddingHorizontal: 22, paddingBottom: 22 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  editBtn: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', paddingHorizontal: 14, paddingVertical: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  codeChip: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 14 },
  card: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.line, padding: 15 },
  planCard: { backgroundColor: Colors.orangeBg, borderRadius: 18, borderWidth: 1, borderColor: '#FDBA74', padding: 15 },
  label: { ...Typography.label2, color: Colors.ink3, marginBottom: 8, marginTop: 2 },
  input: { backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: Colors.ink, marginBottom: 14 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarBtn: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarBtnActive: { borderColor: Colors.orange, backgroundColor: Colors.orangeBg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  actionBtn: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.line, paddingVertical: 15, alignItems: 'center' },
  deleteBtn: { borderColor: '#fca5a5', backgroundColor: Colors.redBg, marginBottom: 6 },
});
