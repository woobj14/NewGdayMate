// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 — 등록한 자료 목록 + 수정/삭제
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import { CONTENT_TYPE_LABEL, CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI, ContentType } from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

export default function ContentListScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const [contents, setContents] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    const q = query(
      collection(db, 'content'),
      where('academyId', '==', user.academyId)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => {
          const aDate = a.createdAt?.toDate?.();
          const bDate = b.createdAt?.toDate?.();
          return (bDate instanceof Date ? bDate.getTime() : 0)
            - (aDate instanceof Date ? aDate.getTime() : 0);
        });
      setContents(list);
      setLoading(false);
    }, () => {
      setContents([]);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const clearQuizCache = async (contentId: string) => {
    await Promise.all(
      Array.from({ length: 6 }, (_, stepIndex) =>
        Promise.all([
          deleteDoc(doc(db, 'quizCache', `${contentId}_step${stepIndex}`)).catch(() => undefined),
          deleteDoc(doc(db, 'quizCache', `v2_${contentId}_step${stepIndex}`)).catch(() => undefined),
        ])
      )
    );
  };

  const runDelete = async (id: string) => {
    setDeleting(id);
    try {
      await clearQuizCache(id);
      await deleteDoc(doc(db, 'content', id));
    } catch (error: any) {
      Alert.alert('오류', error?.message || '삭제 실패. 다시 시도해주세요.');
    } finally {
      setDeleting(null);
    }
  };

  const handleDelete = (id: string, title: string) => {
    const message = `"${title}"을 삭제할까요?\n학생 진도 데이터는 유지됩니다.`;
    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm?.(message) ?? false;
      if (confirmed) {
        void runDelete(id);
      }
      return;
    }

    Alert.alert('자료 삭제', `"${title}"을 삭제할까요?\n학생 진도 데이터는 유지됩니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: () => { void runDelete(id); },
      },
    ]);
  };

  // 단원별 그룹핑
  const normalizedSearch = search.trim().toLowerCase();
  const filteredContents = normalizedSearch
    ? contents.filter(c => {
      const label = CONTENT_TYPE_LABEL[c.type as ContentType] ?? c.type ?? '';
      return [
        c.title,
        c.publisher,
        c.publicationYear,
        c.grade,
        c.unit,
        label,
      ].join(' ').toLowerCase().includes(normalizedSearch);
    })
    : contents;

  const grouped: Record<string, any[]> = {};
  filteredContents.forEach(c => {
    const key = `${c.grade ?? ''}_${c.unit ?? '기타'}_${c.publicationYear ?? '기타'}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:18 }}>←</Text>
        </Pressable>
        <Text style={[Typography.h3, { flex:1 }]}>등록한 자료 목록</Text>
        <Pressable
          style={{ backgroundColor:Colors.brand, borderRadius:10, paddingHorizontal:13, paddingVertical:8 }}
          onPress={() => router.push('/(teacher)/content' as any)}
        >
          <Text style={[Typography.bold3, { color:'#fff' }]}>+ 새 자료</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : contents.length === 0 ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:12, padding:24 }}>
          <Text style={{ fontSize:48 }}></Text>
          <Text style={[Typography.bold2, { color:Colors.ink }]}>등록한 자료가 없어요</Text>
          <Pressable
            style={{ backgroundColor:Colors.brand, borderRadius:13, paddingHorizontal:24, paddingVertical:13 }}
            onPress={() => router.push('/(teacher)/content' as any)}
          >
            <Text style={[Typography.bold2, { color:'#fff' }]}>첫 자료 등록하기 →</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:14, paddingBottom:40 }}>
          <View style={s.searchBox}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="출판사, 년도, 학년, 단원, 자료유형 검색..."
              placeholderTextColor={Colors.ink3}
            />
          </View>
          <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:12 }]}>
            총 {filteredContents.length}개 자료
          </Text>
          {filteredContents.length === 0 ? (
            <View style={s.emptySearch}>
              <Text style={[Typography.bold3, { color:Colors.ink }]}>검색 결과가 없어요</Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>다른 출판사, 학년, 단원으로 찾아보세요</Text>
            </View>
          ) : Object.entries(grouped).map(([key, group]) => (
            <View key={key} style={s.unitGroup}>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:10 }]}>
                {group[0].publicationYear ?? '기타'} · {group[0].grade ?? ''} · {group[0].unit ?? '기타'}
              </Text>
              {group.map(c => {
                const color = CONTENT_TYPE_COLOR[c.type as ContentType] ?? Colors.brand;
                const emoji = CONTENT_TYPE_EMOJI[c.type as ContentType] ?? '';
                const label = CONTENT_TYPE_LABEL[c.type as ContentType] ?? c.type;
                return (
                  <Pressable
                    key={c.id}
                    style={s.contentRow}
                    onPress={() => router.push(`/(teacher)/content/${c.id}` as any)}
                  >
                    <Text style={{ fontSize:20 }}>{emoji}</Text>
                    <View style={{ flex:1 }}>
                      <Text style={[Typography.bold3, { color }]}>{label}</Text>
                      <Text style={[Typography.label2, { color:Colors.ink3 }]} numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text style={[Typography.label3, { color:Colors.ink3 }]}>
                        {c.publisher ?? ''} · {c.publicationYear ?? '년도 미지정'}
                      </Text>
                      {c.wordCount > 0 && (
                        <Text style={[Typography.label3, { color:Colors.ink3 }]}>
                          단어 {c.wordCount}개
                        </Text>
                      )}
                    </View>
                    {(user?.role === 'admin' || !c.assignedBy || c.assignedBy === user?.uid) && (
                      <Pressable
                        onPress={(event: any) => {
                          event?.preventDefault?.();
                          event?.stopPropagation?.();
                          handleDelete(c.id, c.title);
                        }}
                        disabled={deleting === c.id}
                        style={s.deleteBtn}
                      >
                        {deleting === c.id
                          ? <ActivityIndicator color={Colors.red} size="small" />
                          : <Text style={[Typography.label3, { color:Colors.red }]}>삭제</Text>
                        }
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  header:     { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line, flexDirection:'row', alignItems:'center', gap:12 },
  backBtn:    { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  searchBox:  { backgroundColor:Colors.white, borderRadius:13, borderWidth:1, borderColor:Colors.line, paddingHorizontal:12, marginBottom:12 },
  searchInput:{ minHeight:42, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink },
  emptySearch:{ backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:20, alignItems:'center' },
  unitGroup:  { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:12 },
  contentRow: { flexDirection:'row', alignItems:'center', gap:11, paddingVertical:10, borderTopWidth:0.5, borderTopColor:Colors.line },
  deleteBtn:  { paddingHorizontal:11, paddingVertical:7, borderRadius:9, borderWidth:1.5, borderColor:'#fca5a5', backgroundColor:Colors.redBg },
});
