// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 — 등록 자료 상세 확인
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI, CONTENT_TYPE_LABEL, ContentType } from '../../../types/lesson';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type EditableMetaField = {
  key: string;
  value: string;
  setter: (text: string) => void;
};

function normalizeContentKey(value: string) {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function buildContentKey(params: {
  publisher: string;
  publicationYear: string;
  grade: string;
  unit: string;
  type: ContentType;
}) {
  return [
    params.publisher,
    params.publicationYear,
    params.grade,
    params.unit,
    params.type,
  ].map(normalizeContentKey).join('|');
}

function linesFromList(items: string[]) {
  return items.join('\n');
}

function listFromLines(value: string) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function wordsToEditorText(words: any[]) {
  return words.map(word => [
    word.word ?? '',
    word.ko ?? '',
    word.pos ?? '',
    word.def ?? '',
    word.syn ?? '',
  ].join(' | ')).join('\n');
}

function parseWordsEditorText(value: string, grade: string) {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [word = '', ko = '', pos = '', def = '', syn = ''] = line.split('|').map(part => part.trim());
      return {
        word,
        ko,
        pos,
        def,
        syn,
        grade,
      };
    })
    .filter(word => word.word.length > 0);
}

async function clearQuizCache(contentId: string) {
  await Promise.all(
    Array.from({ length: 6 }, (_, stepIndex) =>
      Promise.all([
        deleteDoc(doc(db, 'quizCache', `${contentId}_step${stepIndex}`)).catch(() => undefined),
        deleteDoc(doc(db, 'quizCache', `v2_${contentId}_step${stepIndex}`)).catch(() => undefined),
      ])
    )
  );
}

function confirmDeleteWeb(message: string) {
  return globalThis.confirm?.(message) ?? false;
}

export default function ContentDetailScreen() {
  const router = useRouter();
  const { user } = useAppStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [content, setContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [publisherInput, setPublisherInput] = useState('');
  const [publicationYearInput, setPublicationYearInput] = useState('');
  const [gradeInput, setGradeInput] = useState('');
  const [unitInput, setUnitInput] = useState('');
  const [summaryInput, setSummaryInput] = useState('');
  const [grammarInput, setGrammarInput] = useState('');
  const [wordsInput, setWordsInput] = useState('');
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'content', id), snap => {
      setContent(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    }, () => {
      setContent(null);
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!content || isEditing) return;
    setTitleInput(content.title ?? '');
    setPublisherInput(content.publisher ?? '');
    setPublicationYearInput(content.publicationYear ?? '');
    setGradeInput(content.grade ?? '');
    setUnitInput(content.unit ?? '');
    setSummaryInput(content.summary ?? '');
    setGrammarInput(linesFromList(Array.isArray(content.grammarPoints) ? content.grammarPoints : []));
    setWordsInput(wordsToEditorText(Array.isArray(content.words) ? content.words : []));
    setTextInput(content.text ?? '');
  }, [content, isEditing]);

  const type = (content?.type ?? 'word') as ContentType;
  const color = CONTENT_TYPE_COLOR[type] ?? Colors.brand;
  const label = CONTENT_TYPE_LABEL[type] ?? type;
  const emoji = CONTENT_TYPE_EMOJI[type] ?? '';
  const createdAt = content?.createdAt?.toDate?.();
  const canManage = !!user && !!content && (user.role === 'admin' || !content.assignedBy || content.assignedBy === user.uid);
  const editableMetaFields: EditableMetaField[] = [
    { key: '출판사', value: publisherInput, setter: setPublisherInput },
    { key: '출판년도', value: publicationYearInput, setter: setPublicationYearInput },
    { key: '학년', value: gradeInput, setter: setGradeInput },
    { key: '단원', value: unitInput, setter: setUnitInput },
  ];

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!id || !content) return;
    if (!canManage) {
      Alert.alert('권한 없음', '이 자료를 수정할 권한이 없어요.');
      return;
    }
    const nextWords = parseWordsEditorText(wordsInput, gradeInput.trim() || content.grade || '');
    const nextGrammarPoints = listFromLines(grammarInput);
    const payload = {
      title: titleInput.trim() || content.title || '',
      publisher: publisherInput.trim() || '',
      publicationYear: publicationYearInput.trim() || '',
      grade: gradeInput.trim() || '',
      unit: unitInput.trim() || '',
      summary: summaryInput.trim(),
      text: textInput.trim(),
      words: nextWords,
      grammarPoints: nextGrammarPoints,
      wordCount: nextWords.length,
      quizCount: type === 'word' ? nextWords.length : (content.quizCount ?? 20),
      contentKey: buildContentKey({
        publisher: publisherInput.trim() || '',
        publicationYear: publicationYearInput.trim() || '',
        grade: gradeInput.trim() || '',
        unit: unitInput.trim() || '',
        type,
      }),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      await updateDoc(doc(db, 'content', id), payload);
      await clearQuizCache(id);
      setIsEditing(false);
      Alert.alert('수정 완료', '등록 자료를 업데이트했어요.');
    } catch (error: any) {
      Alert.alert('수정 실패', error?.message || '다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id || !content) return;
    if (!canManage) {
      Alert.alert('권한 없음', '이 자료를 삭제할 권한이 없어요.');
      return;
    }

    const runDelete = async () => {
      setDeleting(true);
      try {
        await clearQuizCache(id);
        await deleteDoc(doc(db, 'content', id));
        router.replace('/(teacher)/content/list' as any);
      } catch (error: any) {
        Alert.alert('삭제 실패', error?.message || '다시 시도해 주세요.');
      } finally {
        setDeleting(false);
      }
    };

    const message = `"${content.title}"을 삭제할까요?\n학생 진도 데이터는 유지됩니다.`;
    if (Platform.OS === 'web') {
      if (confirmDeleteWeb(message)) {
        void runDelete();
      }
      return;
    }

    Alert.alert('자료 삭제', `"${content.title}"을 삭제할까요?\n학생 진도 데이터는 유지됩니다.`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => { void runDelete(); },
      },
    ]);
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:18 }}>←</Text>
        </Pressable>
        <View style={{ flex:1 }}>
          <Text style={[Typography.label2, { color:Colors.ink3 }]}>등록 자료 상세</Text>
          <Text style={[Typography.h3]} numberOfLines={1}>{content?.title ?? '자료 확인'}</Text>
        </View>
        {canManage && !isEditing && (
          <Pressable style={s.actionBtn} onPress={() => setIsEditing(true)}>
            <Text style={[Typography.label2, { color:Colors.brand }]}>수정</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.brand} size="large" />
        </View>
      ) : !content ? (
        <View style={s.center}>
          <Text style={[Typography.bold2, { color:Colors.ink }]}>자료를 찾을 수 없어요</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
          {canManage && (
            <View style={s.manageRow}>
              {isEditing ? (
                <>
                  <Pressable style={[s.manageBtn, { borderColor:Colors.line }]} onPress={handleCancelEdit} disabled={saving}>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>취소</Text>
                  </Pressable>
                  <Pressable style={[s.manageBtn, s.managePrimary]} onPress={handleSave} disabled={saving}>
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={[Typography.label2, { color:'#fff' }]}>저장</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={[s.manageBtn, { borderColor:Colors.line }]} onPress={() => setIsEditing(true)}>
                    <Text style={[Typography.label2, { color:Colors.ink }]}>자료 수정</Text>
                  </Pressable>
                  <Pressable style={[s.manageBtn, s.manageDanger]} onPress={handleDelete} disabled={deleting}>
                    {deleting
                      ? <ActivityIndicator color={Colors.red} size="small" />
                      : <Text style={[Typography.label2, { color:Colors.red }]}>자료 삭제</Text>}
                  </Pressable>
                </>
              )}
            </View>
          )}

          <View style={s.hero}>
            <View style={[s.typeIcon, { backgroundColor: color + '18' }]}>
              <Text style={{ fontSize:24 }}>{emoji}</Text>
            </View>
            <View style={{ flex:1 }}>
              {isEditing ? (
                <>
                  <TextInput
                    style={[s.heroInput, Typography.h4]}
                    value={titleInput}
                    onChangeText={setTitleInput}
                    placeholder="자료 제목"
                    placeholderTextColor={Colors.ink3}
                  />
                  <TextInput
                    style={[s.heroSubInput, Typography.label2]}
                    value={[publisherInput, publicationYearInput, gradeInput, unitInput].filter(Boolean).join(' · ')}
                    editable={false}
                    placeholder="출판사 · 출판년도 · 학년 · 단원"
                    placeholderTextColor={Colors.ink3}
                  />
                </>
              ) : (
                <>
                  <Text style={[Typography.h4, { color:Colors.ink }]}>{content.title}</Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginTop:4 }]}>
                    {content.publisher ?? ''} · {content.publicationYear ?? '년도 미지정'} · {content.grade ?? ''} · {content.unit ?? ''}
                  </Text>
                </>
              )}
            </View>
            <View style={[s.typePill, { borderColor: color, backgroundColor: color + '12' }]}>
              <Text style={[Typography.label2, { color }]}>{label}</Text>
            </View>
          </View>

          <View style={s.statGrid}>
            <View style={s.statCard}>
              <Text style={[Typography.statSm, { color:Colors.brand }]}>{content.wordCount ?? 0}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>단어</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[Typography.statSm, { color:Colors.ink }]}>{content.stepCount ?? 0}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>단계</Text>
            </View>
            <View style={s.statCard}>
              <Text style={[Typography.statSm, { color:Colors.green }]}>{content.quizCount ?? 0}</Text>
              <Text style={[Typography.label3, { color:Colors.ink3 }]}>퀴즈</Text>
            </View>
          </View>

          <View style={s.infoCard}>
            <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:10 }]}>등록 정보</Text>
            {isEditing ? (
              <View style={{ gap:10 }}>
                {editableMetaFields.map(({ key, value, setter }) => (
                  <View key={key} style={s.editField}>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>{key}</Text>
                    <TextInput
                      style={s.editInput}
                      value={value}
                      onChangeText={setter}
                      placeholder={key}
                      placeholderTextColor={Colors.ink3}
                    />
                  </View>
                ))}
                <View style={s.infoRow}>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>자료유형</Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{label}</Text>
                </View>
                <View style={s.infoRow}>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>등록일</Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{createdAt instanceof Date ? createdAt.toLocaleDateString('ko-KR') : '확인 중'}</Text>
                </View>
              </View>
            ) : (
              <>
                {[
                  ['출판사', content.publisher],
                  ['출판년도', content.publicationYear ?? '미지정'],
                  ['학년', content.grade],
                  ['단원', content.unit],
                  ['자료유형', label],
                  ['등록일', createdAt instanceof Date ? createdAt.toLocaleDateString('ko-KR') : '확인 중'],
                ].map(([key, value]) => (
                  <View key={key} style={s.infoRow}>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>{key}</Text>
                    <Text style={[Typography.bold3, { color:Colors.ink }]}>{value || '-'}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          {(content.summary || isEditing) ? (
            <View style={s.infoCard}>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:8 }]}>AI 요약</Text>
              {isEditing ? (
                <TextInput
                  style={s.textArea}
                  value={summaryInput}
                  onChangeText={setSummaryInput}
                  multiline
                  placeholder="AI 요약"
                  placeholderTextColor={Colors.ink3}
                />
              ) : (
                <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:21 }]}>{content.summary}</Text>
              )}
            </View>
          ) : null}

          {(Array.isArray(content.words) && content.words.length > 0) || (isEditing && type === 'word') ? (
            <View style={s.infoCard}>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:10 }]}>단어 목록 {(content.words ?? []).length}개</Text>
              {isEditing ? (
                <>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:8 }]}>한 줄 형식: 영어 | 뜻 | 품사 | 영영풀이 | 유의어</Text>
                  <TextInput
                    style={[s.textArea, { minHeight:220 }]}
                    value={wordsInput}
                    onChangeText={setWordsInput}
                    multiline
                    placeholder="allowance | 용돈 | n. | Money given regularly... | pocket money"
                    placeholderTextColor={Colors.ink3}
                  />
                </>
              ) : (
                <>
                  {(content.words ?? []).slice(0, 80).map((word: any, i: number) => (
                    <View key={`${word.word}-${i}`} style={[s.wordRow, i < Math.min((content.words ?? []).length, 80)-1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}>
                      <View style={{ flex:1 }}>
                        <Text style={[Typography.bold3, { color:Colors.ink }]}>{word.word} <Text style={[Typography.label2, { color:Colors.ink3 }]}>{word.pos}</Text></Text>
                        <Text style={[Typography.label2, { color:Colors.ink3, marginTop:2 }]} numberOfLines={2}>{word.ko} · {word.def}</Text>
                      </View>
                    </View>
                  ))}
                  {(content.words ?? []).length > 80 && (
                    <Text style={[Typography.label2, { color:Colors.ink3, marginTop:10 }]}>외 {(content.words ?? []).length - 80}개 단어 더 있음</Text>
                  )}
                </>
              )}
            </View>
          ) : null}

          {(Array.isArray(content.grammarPoints) && content.grammarPoints.length > 0) || isEditing ? (
            <View style={s.infoCard}>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:10 }]}>문법 포인트</Text>
              {isEditing ? (
                <TextInput
                  style={s.textArea}
                  value={grammarInput}
                  onChangeText={setGrammarInput}
                  multiline
                  placeholder="문법 포인트를 한 줄에 하나씩 입력"
                  placeholderTextColor={Colors.ink3}
                />
              ) : (
                <>
                  {(content.grammarPoints ?? []).map((point: string, i: number) => (
                    <View key={`${point}-${i}`} style={s.grammarRow}>
                      <View style={s.dot} />
                      <Text style={[Typography.body3, { color:Colors.ink, flex:1 }]}>{point}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}

          {(content.text || isEditing) ? (
            <View style={s.infoCard}>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:8 }]}>원문 텍스트</Text>
              {isEditing ? (
                <TextInput
                  style={[s.textArea, { minHeight:260 }]}
                  value={textInput}
                  onChangeText={setTextInput}
                  multiline
                  placeholder="원문 텍스트"
                  placeholderTextColor={Colors.ink3}
                />
              ) : (
                <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:21 }]}>{content.text}</Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex:1, backgroundColor:Colors.bg },
  header: { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line, flexDirection:'row', alignItems:'center', gap:12 },
  backBtn: { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  actionBtn: { borderWidth:1, borderColor:Colors.brand, borderRadius:10, paddingHorizontal:12, paddingVertical:7 },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  manageRow: { flexDirection:'row', gap:10, marginBottom:12 },
  manageBtn: { flex:1, minHeight:44, borderRadius:12, borderWidth:1.5, backgroundColor:Colors.white, alignItems:'center', justifyContent:'center' },
  managePrimary: { backgroundColor:Colors.brand, borderColor:Colors.brand },
  manageDanger: { borderColor:'#fca5a5', backgroundColor:Colors.redBg },
  hero: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:12 },
  typeIcon: { width:46, height:46, borderRadius:14, alignItems:'center', justifyContent:'center' },
  typePill: { borderWidth:1.5, borderRadius:99, paddingHorizontal:10, paddingVertical:5 },
  heroInput: { color:Colors.ink, paddingVertical:0 },
  heroSubInput: { color:Colors.ink3, paddingVertical:0, marginTop:4 },
  statGrid: { flexDirection:'row', gap:9, marginBottom:12 },
  statCard: { flex:1, backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, padding:12, alignItems:'center' },
  infoCard: { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:12 },
  infoRow: { flexDirection:'row', justifyContent:'space-between', gap:12, paddingVertical:7, borderBottomWidth:0.5, borderBottomColor:Colors.line },
  editField: { gap:6 },
  editInput: { minHeight:42, borderRadius:12, borderWidth:1, borderColor:Colors.line, backgroundColor:Colors.bg, paddingHorizontal:12, color:Colors.ink, fontFamily:'Pretendard-Regular', fontSize:14 },
  textArea: { minHeight:110, borderRadius:12, borderWidth:1, borderColor:Colors.line, backgroundColor:Colors.bg, paddingHorizontal:12, paddingVertical:12, color:Colors.ink, fontFamily:'Pretendard-Regular', fontSize:14, textAlignVertical:'top' as any },
  wordRow: { paddingVertical:9 },
  grammarRow: { flexDirection:'row', alignItems:'center', gap:9, marginBottom:8 },
  dot: { width:7, height:7, borderRadius:99, backgroundColor:Colors.brand },
});
