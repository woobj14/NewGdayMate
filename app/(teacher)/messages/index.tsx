// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Filter = 'all' | 'unread' | 'resolved';
type Tag = '문법' | '본문' | '학습' | '버그' | '긴급';

const TAG_COLOR: Record<Tag, { bg: string; text: string }> = {
  '문법': { bg: Colors.brandBg, text: Colors.brandDk },
  '본문': { bg: Colors.blueLight,      text: Colors.blueDk },
  '학습': { bg: Colors.greenBg, text: Colors.greenDk },
  '버그': { bg: Colors.redBg,   text: Colors.redDk },
  '긴급': { bg: Colors.redBg,   text: Colors.red },
};

interface Message {
  id: string; fromName: string; fromColor: string;
  tag: Tag; isUrgent: boolean; title: string; preview: string;
  time: string; unread: boolean;
}

// Firestore 로드 실패 시 fallback
const FALLBACK_MSGS: Message[] = [
  { id:'1', fromName:'김지민', fromColor:Colors.orange, tag:'문법', isUrgent:false, title:'현재완료 시제가 헷갈려요', preview:'have/has + p.p. 쓸 때마다 과거형이랑 헷갈리는데...', time:'5분', unread:true },
  { id:'2', fromName:'이도현', fromColor:Colors.ink3,   tag:'학습', isUrgent:false, title:'4과 단어 너무 어려워요', preview:'4과 단어가 너무 어려워요... 도와주세요 ㅠㅠ', time:'2시간', unread:true },
];

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const [msgs,   setMsgs]   = useState<Message[]>(FALLBACK_MSGS);
  const [filter, setFilter] = useState<Filter>('all');
  const [reply,  setReply]  = useState('');
  const [active, setActive] = useState<Message | null>(null);

  const filtered = msgs.filter(m => {
    if (filter === 'unread')   return m.unread;
    if (filter === 'resolved') return !m.unread;
    return true;
  });

  const unreadCount = msgs.filter(m => m.unread).length;

  // Firestore 메시지 로드
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'messages'),
      where('toUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({
        id:         d.id,
        fromName:   d.data().fromName  ?? '학생',
        fromColor:  d.data().fromColor ?? Colors.brand,
        tag:        (d.data().tag ?? '학습') as Tag,
        isUrgent:   d.data().isUrgent  ?? false,
        title:      d.data().title     ?? '',
        preview:    d.data().preview   ?? '',
        time:       d.data().createdAt?.toDate
          ? `${Math.floor((Date.now() - d.data().createdAt.toDate().getTime()) / 60000)}분 전`
          : '',
        unread:     d.data().read === false,
      } as Message));
      if (list.length > 0) setMsgs(list);
    });
    return () => unsub();
  }, [user?.uid]);

  const sendReply = async () => {
    if (!reply.trim() || !active || !user?.uid) return;
    const text = reply.trim();
    setReply('');
    try {
      await addDoc(collection(db, 'messages'), {
        fromUid:   user.uid,
        fromName:  user.displayName ?? '선생님',
        fromColor: Colors.brand,
        toUid:     active.id,
        title:     `RE: ${active.title}`,
        preview:   text,
        tag:       active.tag,
        isUrgent:  false,
        read:      false,
        isReply:   true,
        createdAt: new Date(),
      });
      // 원본 메시지 읽음 처리
      import('firebase/firestore').then(({ doc, updateDoc }) =>
        updateDoc(doc(db, 'messages', active.id), { read: true })
      );
      setMsgs(prev => prev.map(m => m.id === active.id ? { ...m, unread:false } : m));
    } catch (e) {
      console.error('쪽지 전송 실패:', e);
    }
  };

  if (active) {
    return (
      <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={s.detailHeader}>
          <Pressable style={s.backBtn} onPress={() => setActive(null)}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <View style={[s.ava, { backgroundColor: active.fromColor }]}>
            <Text style={[Typography.bold3, { color: '#fff' }]}>{active.fromName[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bold2]}>{active.fromName}</Text>
            <View style={[s.tagBadge, { backgroundColor: TAG_COLOR[active.tag].bg }]}>
              <Text style={[Typography.label3, { color: TAG_COLOR[active.tag].text }]}>#{active.tag}</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, padding: 16, backgroundColor: Colors.bg }}>
          <View style={s.msgBubbleStudent}>
            <Text style={[Typography.body3, { color: Colors.ink, lineHeight: 20 }]}>{active.title}</Text>
            <Text style={[Typography.body3, { color: Colors.ink3, marginTop: 6, lineHeight: 19 }]}>{active.preview}</Text>
          </View>
        </View>
        <View style={s.replyRow}>
          <TextInput
            style={s.replyInput}
            placeholder="답변 입력..."
            placeholderTextColor={Colors.ink3}
            value={reply}
            onChangeText={setReply}
            multiline
          />
          <Pressable style={[s.sendBtn, { backgroundColor: Colors.orange }]} onPress={sendReply}>
            <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={[Typography.label2, { color: Colors.ink3, marginBottom: 3 }]}>
          {user?.displayName ?? '이재영'} 선생님
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={[Typography.h2]}>쪽지함</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={[Typography.bold3, { color: '#fff' }]}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {/* 버디 요약 */}
        <View style={s.buddySummary}>
          <Text style={{ fontSize: 16 }}></Text>
          <Text style={[Typography.body3, { flex: 1, color: Colors.ink, lineHeight: 19 }]}>
            오늘 {unreadCount}개 질문 중 <Text style={{ fontWeight: '700', color: Colors.amberDk }}>현재완료가 3건</Text>이에요. 5분짜리 미니 강의를 보내드릴까요?
          </Text>
        </View>
        {/* 필터 */}
        <View style={s.filterRow}>
          {(['all','unread','resolved'] as Filter[]).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)}
              style={[s.pill, filter === f && { backgroundColor: Colors.ink, borderColor: Colors.ink }]}>
              <Text style={[Typography.label2, { color: filter === f ? '#fff' : Colors.ink3 }]}>
                {f === 'all' ? '전체' : f === 'unread' ? `답변 대기 ${unreadCount}` : '해결됨'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={m => m.id}
        contentContainerStyle={{ gap: 1 }}
        renderItem={({ item: m }) => (
          <Pressable
            style={[s.msgRow, m.unread && { backgroundColor: Colors.pureWhite }]}
            onPress={() => setActive(m)}
          >
            <View style={{ position: 'relative' }}>
              <View style={[s.ava, { backgroundColor: m.fromColor }]}>
                <Text style={[Typography.bold3, { color: '#fff' }]}>{m.fromName[0]}</Text>
              </View>
              {m.unread && <View style={s.unreadDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Text style={[Typography.bold3, { color: Colors.ink }]}>{m.fromName}</Text>
                {m.isUrgent && (
                  <View style={[s.tagBadge, { backgroundColor: Colors.red }]}>
                    <Text style={[Typography.label3, { color: '#fff' }]}>긴급</Text>
                  </View>
                )}
                <View style={[s.tagBadge, { backgroundColor: TAG_COLOR[m.tag].bg }]}>
                  <Text style={[Typography.label3, { color: TAG_COLOR[m.tag].text }]}>#{m.tag}</Text>
                </View>
                <Text style={[Typography.label2, { color: Colors.ink3, marginLeft: 'auto' as any }]}>{m.time}</Text>
              </View>
              <Text style={[m.unread ? Typography.bold3 : Typography.body3, { color: Colors.ink, marginBottom: 2 }]}>
                {m.title}
              </Text>
              <Text style={[Typography.label2, { color: Colors.ink3 }]} numberOfLines={1}>{m.preview}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:           { flex: 1, backgroundColor: Colors.white },
  header:         { paddingTop: 52, paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  buddySummary:   { flexDirection: 'row', gap: 10, backgroundColor: Colors.amberBg, borderWidth: 1, borderColor: '#FDE68A', borderRadius: 13, padding: 12, marginBottom: 12, alignItems: 'flex-start' },
  filterRow:      { flexDirection: 'row', gap: 7 },
  pill:           { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.white },
  unreadBadge:    { backgroundColor: Colors.red, borderRadius: 99, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  msgRow:         { flexDirection: 'row', gap: 11, padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.bg },
  ava:            { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  unreadDot:      { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.red, borderWidth: 2, borderColor: Colors.white },
  tagBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  detailHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 52, padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.line },
  backBtn:        { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  msgBubbleStudent:{ backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.line, padding: 14, alignSelf: 'flex-start', maxWidth: '85%' },
  replyRow:       { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 0.5, borderTopColor: Colors.line },
  replyInput:     { flex: 1, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 12, padding: 10, fontFamily: 'Pretendard-Regular', fontSize: 13, color: Colors.ink, maxHeight: 100 },
  sendBtn:        { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backBtnSm:      { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
});
