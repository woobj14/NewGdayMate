// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { buildParsedContentFallback, organizeContentImageWithAI, parseContentWithAI, ParsedWord, GrammarSection } from '../../../lib/gemini';
import { useAppStore } from '../../../stores/useAppStore';
import { ContentType, CONTENT_TYPE_LABEL, STEP_DEFS } from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Step = 1 | 2 | 3;
type ExistingContent = {
  id: string;
  title: string;
  publisher?: string;
  publicationYear?: string;
  grade?: string;
  unit?: string;
  type?: ContentType;
  contentKey?: string;
};

const PUBLISHERS = ['천재교육','미래엔','동아출판','YBM','비상교육','NE능률','기타'];
const PUBLICATION_YEARS = ['2026','2025','2024','2023','2022','기타'];
const GRADES     = ['중1','중2','중3','고1','고2','고3'];
const UNITS      = Array.from({ length: 8 }, (_, i) => `${i + 1}과`);

const TYPE_PLACEHOLDER: Record<ContentType, string> = {
  dialog: `Mina: Hi, Jake! Have you ever observed the night sky?
Jake: Yes, I have. My grandfather is an astronomer.

Mina: That's amazing! What did he teach you?
Jake: He taught me how to use a telescope.

(대화문 그룹 사이에 빈 줄을 넣어주세요)`,
  reading: `For most of human history, people have observed the night sky with wonder.

Yet the basic feeling of asking "what is out there?" has not changed.

(단락 사이에 빈 줄을 넣어주세요)`,
  grammar: '현재완료: have/has + p.p.\n예) I have lived here for 5 years.\n용법: 경험, 완료, 계속, 결과',
  word:    'observe\nancient\ntelescope\nastronomer\nwonder',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('이미지를 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

function getBase64Image(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error('지원하지 않는 이미지 형식이에요.');
  return { mimeType: match[1], base64: match[2] };
}

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

// 단계 표시선
function Stepper({ step }: { step: Step }) {
  const labels = ['입력', 'AI 검수', '배포'];
  return (
    <View style={st.stepper}>
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done   = step > n;
        return (
          <View key={n} style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
            <View style={{ alignItems:'center', gap:4 }}>
              <View style={[st.stepCircle,
                done   && { backgroundColor:Colors.brand },
                active && { backgroundColor:Colors.brand, shadowColor:Colors.brand, shadowOpacity:.3, shadowRadius:6, elevation:4 },
              ]}>
                <Text style={[Typography.label2, { color:done||active ? '#fff' : Colors.ink3 }]}>
                  {done ? 'V' : n}
                </Text>
              </View>
              <Text style={[Typography.label3, { color:active ? Colors.brand : Colors.ink3 }]}>{l}</Text>
            </View>
            {i < 2 && <View style={[st.stepLine, done && { backgroundColor:Colors.brand }]} />}
          </View>
        );
      })}
    </View>
  );
}

export default function ContentUploadScreen() {
  const router  = useRouter();
  const { user } = useAppStore();

  // ── Step 1: 메타 + 텍스트 입력 ──
  const [step,      setStep]      = useState<Step>(1);
  const [pubIdx,    setPubIdx]    = useState(0);
  const [otherPublisher, setOtherPublisher] = useState('');
  const [yearIdx,   setYearIdx]   = useState(0);
  const [otherPublicationYear, setOtherPublicationYear] = useState('');
  const [gradeIdx,  setGradeIdx]  = useState(2);  // 중3 기본
  const [unitIdx,   setUnitIdx]   = useState(2);  // 3과 기본
  const [type,      setType]      = useState<ContentType>('dialog');
  const [text,      setText]      = useState('');

  // ── Step 2: AI 분석 결과 ──
  const [loading,   setLoading]   = useState(false);
  const [words,     setWords]     = useState<ParsedWord[]>([]);
  const [grammar,   setGrammar]   = useState<string[]>([]);
  // 문법 타입 전용: 선생님이 직접 입력한 문법 포인트들
  const [manualGrammarPoints, setManualGrammarPoints] = useState<string[]>(['']);
  const [summary,   setSummary]   = useState('');
  const [grammarSections, setGrammarSections] = useState<GrammarSection[]>([]);
  const [editWord,  setEditWord]  = useState<number | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoName, setPhotoName] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [duplicateContent, setDuplicateContent] = useState<ExistingContent | null>(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const publisher = PUBLISHERS[pubIdx] === '기타'
    ? otherPublisher.trim() || '기타'
    : PUBLISHERS[pubIdx];
  const publicationYear = PUBLICATION_YEARS[yearIdx] === '기타'
    ? otherPublicationYear.trim() || '기타'
    : PUBLICATION_YEARS[yearIdx];
  const currentGrade = GRADES[gradeIdx];
  const currentUnit = UNITS[unitIdx];
  const currentContentKey = buildContentKey({
    publisher,
    publicationYear,
    grade: currentGrade,
    unit: currentUnit,
    type,
  });

  const canAnalyze = type === 'grammar'
    ? (manualGrammarPoints.some(p => p.trim()) || text.trim().length > 0) && !duplicateContent
    : text.trim().length > 0 && !duplicateContent;

  useEffect(() => {
    if (!user?.academyId) {
      setDuplicateContent(null);
      setDuplicateLoading(false);
      return;
    }

    setDuplicateLoading(true);
    const q = query(
      collection(db, 'content'),
      where('academyId', '==', user.academyId)
    );
    const unsub = onSnapshot(q, snap => {
      const match = snap.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as ExistingContent)
        .find(content => {
          const storedKey = content.contentKey || buildContentKey({
            publisher: content.publisher ?? '',
            publicationYear: content.publicationYear ?? '기타',
            grade: content.grade ?? '',
            unit: content.unit ?? '',
            type: (content.type ?? 'word') as ContentType,
          });
          if (storedKey === currentContentKey) return true;
          const sameCore =
            normalizeContentKey(content.publisher ?? '') === normalizeContentKey(publisher) &&
            normalizeContentKey(content.grade ?? '') === normalizeContentKey(currentGrade) &&
            normalizeContentKey(content.unit ?? '') === normalizeContentKey(currentUnit) &&
            (content.type ?? 'word') === type;
          if (!sameCore) return false;
          return !content.publicationYear ||
            normalizeContentKey(content.publicationYear) === normalizeContentKey(publicationYear);
        });

      setDuplicateContent(match ?? null);
      setDuplicateLoading(false);
    }, () => {
      setDuplicateContent(null);
      setDuplicateLoading(false);
    });

    return () => unsub();
  }, [user?.academyId, currentContentKey, publisher, currentGrade, currentUnit, type, publicationYear]);

  // ── Step 1 → 2: AI 파싱 ──
  const analyzeContent = useCallback(async () => {
    if (duplicateContent) {
      Alert.alert('이미 업로드 완료', `"${duplicateContent.title}" 자료가 이미 등록되어 있어요.`);
      return;
    }
    if (type === 'grammar') {
      const validPoints = manualGrammarPoints.filter(p => p.trim().length > 0);
      if (!text.trim()) {
        if (validPoints.length === 0) return;
        setGrammar(validPoints);
        setGrammarSections(validPoints.map(point => ({
          title: point,
          explanation: '',
          examples: [],
        })));
        setSummary(`핵심 문법 ${validPoints.length}개를 수동 등록했습니다.`);
        setStep(2);
        return;
      }
    }
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await parseContentWithAI(text, type as any, currentGrade);
      setWords(result.words);
      setGrammar(result.grammarPoints);
      setGrammarSections(result.grammarSections);
      setSummary(result.summary);
      setStep(2);
    } catch (err) {
      if (__DEV__) {
        console.warn('[ContentUpload] content parsing failed, using text fallback:', err);
      }
      const fallback = buildParsedContentFallback(text, type as any, currentGrade);
      setWords(fallback.words);
      setGrammar(fallback.grammarPoints);
      setGrammarSections(fallback.grammarSections);
      setSummary(fallback.summary);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }, [text, type, currentGrade, manualGrammarPoints, duplicateContent]);

  const handlePhotoUpload = useCallback(async () => {
    if (typeof document === 'undefined') {
      Alert.alert('사진 업로드', '현재 사진 업로드는 웹 프리뷰에서 먼저 지원해요.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    const files = await new Promise<File[]>((resolve) => {
      input.onchange = () => resolve(Array.from(input.files ?? []));
      input.click();
    });

    if (files.length === 0) return;

    setPhotoLoading(true);
    setPhotoName('');
    setPhotoError('');
    try {
      const organizedPages: string[] = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        const image = getBase64Image(dataUrl);
        const organized = await organizeContentImageWithAI({
          ...image,
          contentType: type,
          grade: currentGrade,
        });
        if (organized.trim()) {
          organizedPages.push(organized.trim());
        }
      }

      const nextText = organizedPages.join('\n\n').trim();
      if (!nextText) {
        throw new Error('사진에서 텍스트를 추출하지 못했어요.');
      }
      setText(nextText);
      setPhotoName(files.length === 1 ? files[0].name : `${files.length}장 사진`);
      if (__DEV__) {
        console.log('[ContentUpload] image OCR result length:', nextText.length);
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('[ContentUpload] image OCR failed:', err);
      }
      const msg = '사진에서 텍스트를 추출하지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.';
      setPhotoName('');
      setPhotoError(msg);
      Alert.alert('사진 정리 실패', msg);
    } finally {
      setPhotoLoading(false);
    }
  }, [type, currentGrade]);

  // ── Step 2 → 3: Firestore 배포 ──
  const distribute = useCallback(async () => {
    if (!user) return;
    if (!user.academyId) {
      Alert.alert('배포 불가', '학원 정보가 없어 자료를 배포할 수 없어요. 선생님 계정의 academyId를 확인해 주세요.');
      return;
    }
    if (duplicateContent) {
      Alert.alert('이미 업로드 완료', `"${duplicateContent.title}" 자료가 이미 등록되어 있어요.`);
      return;
    }
    setLoading(true);
    try {
      const contentType = type;
      const stepCount   = STEP_DEFS[contentType].length;
      const quizCount   = contentType === 'word' ? words.length : 20;

      const title = `${publisher} ${publicationYear} ${currentGrade} ${currentUnit} ${CONTENT_TYPE_LABEL[contentType]}`;

      await addDoc(collection(db, 'content'), {
        title,
        publisher,
        publicationYear,
        grade:        currentGrade,
        unit:         currentUnit,
        type:         contentType,
        contentKey:   currentContentKey,
        text,
        words,
        grammarPoints: type === 'grammar'
          ? (grammar.length > 0 ? grammar : manualGrammarPoints.filter(p => p.trim().length > 0))
          : grammar,
        grammarSections: type === 'grammar' ? grammarSections : [],
        summary,
        wordCount:    words.length,
        stepCount,
        quizCount,
        assignedBy:   user.uid,
        academyId:    user.academyId,
        createdAt:    serverTimestamp(),
        status:       'published',
      });

      setStep(3);
    } catch (err) {
      Alert.alert('저장 실패', '다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [user, type, publisher, publicationYear, currentGrade, currentUnit, currentContentKey, text, words, grammar, grammarSections, summary, manualGrammarPoints, duplicateContent]);

  const previewQuizCount = type === 'word' ? words.length : 20;
  const reviewPrimaryCount = type === 'word'
    ? words.length
    : type === 'grammar'
    ? (grammarSections.length || grammar.length)
    : words.length;
  const reviewPrimaryLabel = type === 'word'
    ? '추출 단어'
    : type === 'grammar'
    ? '핵심 문법'
    : '추출 단어';

  const wordCountTxt = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => step === 1 ? router.back() : setStep(s => (s - 1) as Step)}>
            <Text style={{ fontSize:18 }}>←</Text>
          </Pressable>
          <View style={{ flex:1 }}>
            <Text style={[Typography.label2, { color:Colors.ink3 }]}>
              {currentGrade} {publisher} · {publicationYear} · {currentUnit}
            </Text>
            <Text style={[Typography.h4]}>자료 업로드</Text>
          </View>
        </View>
        <Stepper step={step} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom:120 }}>

        {/* ── STEP 1: 입력 ── */}
        {step === 1 && (
          <View style={s.body}>
            {/* 출판사 */}
            <Text style={s.sectionLabel}>출판사</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', gap:7 }}>
                {PUBLISHERS.map((p, i) => (
                  <Pressable key={p} onPress={() => setPubIdx(i)}
                    style={[s.pill, pubIdx===i && s.pillActive]}>
                    <Text style={[Typography.label2, { color:pubIdx===i?'#fff':Colors.ink3 }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {PUBLISHERS[pubIdx] === '기타' && (
              <TextInput
                style={s.otherPublisherInput}
                value={otherPublisher}
                onChangeText={setOtherPublisher}
                placeholder="출판사명을 입력해 주세요"
                placeholderTextColor={Colors.ink3}
              />
            )}

            {/* 출판년도 */}
            <Text style={s.sectionLabel}>출판년도</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', gap:7 }}>
                {PUBLICATION_YEARS.map((year, i) => (
                  <Pressable key={year} onPress={() => setYearIdx(i)}
                    style={[s.pill, yearIdx===i && s.pillActive]}>
                    <Text style={[Typography.label2, { color:yearIdx===i?'#fff':Colors.ink3 }]}>{year}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {PUBLICATION_YEARS[yearIdx] === '기타' && (
              <TextInput
                style={s.otherPublisherInput}
                value={otherPublicationYear}
                onChangeText={setOtherPublicationYear}
                placeholder="출판년도를 입력해 주세요"
                placeholderTextColor={Colors.ink3}
              />
            )}

            {/* 학년 + 단원 */}
            <View style={{ flexDirection:'row', gap:14, marginBottom:14 }}>
              <View style={{ flex:1 }}>
                <Text style={s.sectionLabel}>학년</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                  {GRADES.map((g, i) => (
                    <Pressable key={g} onPress={() => setGradeIdx(i)}
                      style={[s.smallPill, gradeIdx===i && s.pillActive]}>
                      <Text style={[Typography.label3, { color:gradeIdx===i?'#fff':Colors.ink3 }]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.sectionLabel}>단원</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                  {UNITS.map((u, i) => (
                    <Pressable key={u} onPress={() => setUnitIdx(i)}
                      style={[s.smallPill, unitIdx===i && s.pillActive]}>
                      <Text style={[Typography.label3, { color:unitIdx===i?'#fff':Colors.ink3 }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* 콘텐츠 타입 탭 */}
            <Text style={s.sectionLabel}>자료 유형</Text>
            <View style={s.typeTabs}>
              {(['dialog','reading','grammar','word'] as ContentType[]).map(t => (
                <Pressable key={t} onPress={() => setType(t)}
                  style={[s.typeTab, type===t && { borderColor:Colors.brand, backgroundColor:Colors.brandBg }]}>
                  <Text style={[Typography.label2, { color:type===t ? Colors.brand : Colors.ink3 }]}>
                    {CONTENT_TYPE_LABEL[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {duplicateContent ? (
              <View style={s.duplicateBox}>
                <View style={{ flex:1 }}>
                  <Text style={[Typography.bold3, { color:Colors.amberDk }]}>이미 업로드 완료</Text>
                  <Text style={[Typography.label2, { color:Colors.ink2, marginTop:3 }]} numberOfLines={2}>
                    {duplicateContent.title}
                  </Text>
                  <Text style={[Typography.label3, { color:Colors.ink3, marginTop:3 }]}>
                    같은 출판사·년도·학년·단원·자료유형 자료가 이미 등록되어 있어요.
                  </Text>
                </View>
                <Pressable style={s.duplicateBtn} onPress={() => router.push(`/(teacher)/content/${duplicateContent.id}` as any)}>
                  <Text style={[Typography.label2, { color:Colors.amberDk }]}>보기</Text>
                </Pressable>
              </View>
            ) : duplicateLoading ? (
              <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:10 }]}>중복 자료 확인 중...</Text>
            ) : null}

            {/* 텍스트 입력 */}
            <View style={s.textInputHead}>
              <Text style={s.sectionLabel}>텍스트 붙여넣기</Text>
              <Pressable
                style={[s.photoBtn, photoLoading && { opacity:0.5 }]}
                onPress={handlePhotoUpload}
                disabled={photoLoading}
              >
                {photoLoading
                  ? <ActivityIndicator color={Colors.brand} size="small" />
                  : <Text style={[Typography.label2, { color:Colors.brand }]}>사진업로드</Text>}
              </Pressable>
            </View>
            {(photoLoading || photoName || photoError) && (
              <Text style={[Typography.label2, { color:photoError ? Colors.red : Colors.ink3, marginBottom:8 }]}>
                {photoLoading
                  ? 'Gemini가 사진 속 자료를 텍스트로 정리하고 있어요...'
                  : photoError || `${photoName} 정리 완료 · 내용을 검토해 주세요`}
              </Text>
            )}
            <View style={s.textareaWrap}>
              <TextInput
                style={s.textarea}
                multiline
                value={text}
                onChangeText={setText}
                placeholder={TYPE_PLACEHOLDER[type]}
                placeholderTextColor={Colors.ink3}
              />
              <Text style={s.charCount}>{text.length}자 · {wordCountTxt}단어</Text>
            </View>

            {/* 문법 타입 전용: 문법 포인트 직접 입력 */}
            {type === 'grammar' && (
              <View style={{ marginBottom:14 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <Text style={s.sectionLabel}>문법 포인트 입력</Text>
                  <Pressable
                    onPress={() => setManualGrammarPoints(prev => [...prev, ''])}
                    style={{ paddingHorizontal:12, paddingVertical:5, borderRadius:8, borderWidth:1, borderColor:Colors.brand }}>
                    <Text style={[Typography.label2, { color:Colors.brand }]}>+ 추가</Text>
                  </Pressable>
                </View>
                <View style={{ backgroundColor:Colors.brandBg, borderRadius:13, borderWidth:1, borderColor:'#DDD9FF', padding:12, marginBottom:10 }}>
                  <Text style={[Typography.label2, { color:Colors.brand, marginBottom:4 }]}> 입력 예시</Text>
                  <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
                    • 현재완료{'\n'}• 수동태{'\n'}• 분사구문{'\n'}• 관계대명사 that/which
                  </Text>
                </View>
                {manualGrammarPoints.map((pt, i) => (
                  <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
                    <View style={{ width:24, height:24, borderRadius:7, backgroundColor:Colors.brand, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Text style={[Typography.label3, { color:'#fff', fontWeight:'700' }]}>{i+1}</Text>
                    </View>
                    <TextInput
                      style={[{
                        flex:1, backgroundColor:Colors.white, borderWidth:1.5,
                        borderColor: pt.trim() ? Colors.brand : Colors.line,
                        borderRadius:10, paddingHorizontal:12, paddingVertical:10,
                        fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink,
                      }]}
                      value={pt}
                      onChangeText={v => {
                        const updated = [...manualGrammarPoints];
                        updated[i] = v;
                        setManualGrammarPoints(updated);
                      }}
                      placeholder={`예: 현재완료, 수동태, 분사구문...`}
                      placeholderTextColor={Colors.ink3}
                    />
                    {manualGrammarPoints.length > 1 && (
                      <Pressable
                        onPress={() => setManualGrammarPoints(prev => prev.filter((_, j) => j !== i))}
                        style={{ width:28, height:28, borderRadius:8, backgroundColor:Colors.redBg, alignItems:'center', justifyContent:'center' }}>
                        <Text style={{ color:Colors.red, fontSize:14, fontWeight:'700' }}>×</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* AI 힌트 */}
            <View style={s.hint}>
              <Text style={[Typography.label2, { color:Colors.brand, marginBottom:5 }]}>AI가 자동 처리합니다</Text>
              <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
                {type === 'word'
                  ? '텍스트만 붙여넣으면 Gemini가 단어, 뜻, 품사, 영영풀이를 자동 정리합니다.'
                  : type === 'grammar'
                  ? '문법 포인트와 예문을 바탕으로 학습 단계에 맞는 문법 퀴즈 구조를 준비합니다.'
                  : '텍스트 구조를 검수해 대화문/본문 그룹이 학생 학습 흐름에 맞게 유지되었는지 확인합니다.'}
              </Text>
              {(type === 'dialog' || type === 'reading') && (
                <View style={{ marginTop:9, paddingTop:9, borderTopWidth:1, borderTopColor:'#DDD9FF' }}>
                  <Text style={[Typography.label2, { color:Colors.brand, marginBottom:3 }]}>
                    {type === 'dialog' ? ' 대화문 입력 규칙' : ' 본문 입력 규칙'}
                  </Text>
                  <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
                    {type === 'dialog'
                      ? '대화 그룹 사이에 빈 줄을 넣어주세요.\n각 그룹별로 독립적인 퀴즈가 생성됩니다.\n(예: 8개 그룹 → 그룹별 퀴즈 2~3개)'
                      : '단락 사이에 빈 줄을 넣어주세요.\n단락별로 독립적인 퀴즈가 생성됩니다.\n(예: 3단락 → 단락별 퀴즈 2~3개)'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── STEP 2: AI 검수 ── */}
        {step === 2 && (
          <View style={s.body}>
            {/* 요약 */}
            {/* 문법 타입: 전용 검수 화면 */}
            {type === 'grammar' && (
              <>
                <View style={{ backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:14 }}>
                  <View style={{ padding:12, paddingHorizontal:14, borderBottomWidth:1, borderBottomColor:Colors.line, backgroundColor:Colors.brandBg }}>
                    <Text style={[Typography.bold3, { color:Colors.brand }]}>
                      추출된 핵심 문법 {grammarSections.length || grammar.length}개
                    </Text>
                    <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>
                      핵심 문법, 설명, 예문을 분리해서 검수한 뒤 Step 1~4 퀴즈가 생성됩니다
                    </Text>
                  </View>
                  {(grammarSections.length > 0 ? grammarSections : grammar.map(point => ({
                    title: point,
                    explanation: '',
                    examples: [],
                  }))).map((section, i, arr) => (
                    <View key={`${section.title}_${i}`} style={{
                      padding:14,
                      borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
                      borderBottomColor:Colors.line,
                    }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
                        <View style={{ width:28, height:28, borderRadius:8, backgroundColor:Colors.brand, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Text style={[Typography.bold3, { color:'#fff', fontSize:12 }]}>{i+1}</Text>
                        </View>
                        <Text style={[Typography.bold3, { flex:1, color:Colors.ink }]}>{section.title}</Text>
                      </View>

                      {section.explanation ? (
                        <View style={s.grammarSectionBox}>
                          <Text style={[Typography.label2, { color:Colors.brand, marginBottom:4 }]}>설명</Text>
                          <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:21 }]}>{section.explanation}</Text>
                        </View>
                      ) : null}

                      {section.examples.length > 0 ? (
                        <View style={[s.grammarSectionBox, { marginTop:8 }]}>
                          <Text style={[Typography.label2, { color:Colors.greenDk, marginBottom:4 }]}>예문</Text>
                          {section.examples.map((example, exampleIndex) => (
                            <View key={`${exampleIndex}_${example.slice(0, 16)}`} style={{ flexDirection:'row', gap:8, marginTop: exampleIndex === 0 ? 0 : 6 }}>
                              <View style={s.grammarExampleDot} />
                              <Text style={[Typography.body3, { flex:1, color:Colors.ink, lineHeight:20 }]}>{example}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
                <View style={{ backgroundColor:Colors.greenBg, borderRadius:12, borderWidth:1, borderColor:'#86efac', padding:13, marginBottom:14 }}>
                  <Text style={[Typography.bold3, { color:Colors.greenDk, marginBottom:6 }]}> 생성될 퀴즈 구성</Text>
                  {['Step 1 · 개념 이해 — 문법 포인트 카드 학습','Step 2 · 예문 분석 — 예문 O/X 판단','Step 3 · 변형 연습 — AI 빈칸 완성 8문항','Step 4 · 실전 퀴즈 — AI 4지선다 어법 15문항'].map((s,i) => (
                    <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 }}>
                      <View style={{ width:5, height:5, borderRadius:3, backgroundColor:Colors.green }} />
                      <Text style={[Typography.body3, { color:Colors.ink, lineHeight:20 }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={s.summaryStrip}>
              <View style={s.summaryCell}>
                <Text style={[Typography.statSm, { color:Colors.brand }]}>{reviewPrimaryCount}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>{reviewPrimaryLabel}</Text>
              </View>
              <View style={[s.summaryCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.ink }]}>{STEP_DEFS[type].length}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>학습 단계</Text>
              </View>
              <View style={[s.summaryCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.green }]}>{previewQuizCount}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>퀴즈 수</Text>
              </View>
            </View>

            {/* 본문 요약 */}
            {summary ? (
              <View style={s.summaryBox}>
                <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:5 }]}>AI 요약</Text>
                <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:20 }]}>{summary}</Text>
              </View>
            ) : null}

            {/* 문법 포인트 */}
            {grammar.length > 0 && (
              <>
                <Text style={[Typography.bold3, { marginBottom:8, marginTop:4 }]}>
                  문법 포인트 {grammar.length}개
                </Text>
                {grammar.map((g, i) => (
                  <View key={i} style={s.grammarRow}>
                    <View style={s.grammarDot} />
                    <Text style={[Typography.body3, { flex:1, color:Colors.ink }]}>{g}</Text>
                  </View>
                ))}
              </>
            )}

            {/* 단어 목록 */}
            {words.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <Text style={[Typography.bold3]}>
                    추출 단어 <Text style={{ color:Colors.brand }}>{words.length}개</Text>
                  </Text>
                  <Pressable style={s.regenBtn}>
                    <Text style={[Typography.label2, { color:Colors.brand }]}>재생성</Text>
                  </Pressable>
                </View>

                <View style={s.wordListCard}>
                  {words.map((w, i) => (
                    <View key={i} style={[s.wordRow, i < words.length-1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}>
                      {/* 검수 상태 점 */}
                      <View style={[s.statusDot, { backgroundColor: i % 5 === 3 ? Colors.amber : Colors.green }]} />
                      <View style={{ flex:1 }}>
                        {editWord === i ? (
                          <TextInput
                            style={[Typography.bold3, { color:Colors.ink, borderBottomWidth:1, borderBottomColor:Colors.brand, paddingBottom:2 }]}
                            defaultValue={w.word}
                            onBlur={() => setEditWord(null)}
                            autoFocus
                          />
                        ) : (
                          <Text style={[Typography.bold3, { color:Colors.ink }]}>
                            {w.word} <Text style={[Typography.label2, { color:Colors.ink3 }]}>{w.pos}</Text>
                          </Text>
                        )}
                        <Text style={[Typography.label2, { color:Colors.ink3, marginTop:1 }]}>
                          {w.ko} · {w.def}
                        </Text>
                        {w.syn ? (
                          <Text style={[Typography.label3, { color:Colors.brand, marginTop:1 }]}>syn. {w.syn}</Text>
                        ) : null}
                      </View>
                      <Pressable onPress={() => setEditWord(i)} style={s.editBtn}>
                        <Text style={[Typography.label3, { color:Colors.ink3 }]}>편집</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── STEP 3: 완료 ── */}
        {step === 3 && (
          <View style={{ padding:28, alignItems:'center', paddingTop:48 }}>
            <View style={s.doneIcon}>
              <Text style={{ fontSize:36 }}>V</Text>
            </View>
            <Text style={[Typography.h2, { textAlign:'center', marginBottom:8 }]}>배포 완료!</Text>
            <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginBottom:10, lineHeight:22 }]}>
              {currentGrade} {currentUnit} {CONTENT_TYPE_LABEL[type]} 자료가{'\n'}학생들에게 전달됐어요
            </Text>
            <View style={s.doneInfo}>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>단어 {words.length}개</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>·</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>{STEP_DEFS[type].length}단계</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>·</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>퀴즈 {previewQuizCount}문항</Text>
            </View>
            <Pressable style={[s.doneBtn, { marginTop:32 }]} onPress={() => router.replace('/teacher-home' as any)}>
              <Text style={[Typography.bold1, { color:'#fff' }]}>대시보드로 돌아가기</Text>
            </Pressable>
            <Pressable style={[s.doneBtn, { backgroundColor:Colors.green, marginTop:10 }]}
              onPress={() => router.push('/(teacher)/content/list' as any)}>
              <Text style={[Typography.bold1, { color:'#fff' }]}>등록 자료 확인하기</Text>
            </Pressable>
            <Pressable style={[s.doneBtn, { backgroundColor:Colors.white, borderWidth:1.5, borderColor:Colors.line, marginTop:10 }]}
              onPress={() => { setStep(1); setText(''); setWords([]); setGrammar([]); setGrammarSections([]); setSummary(''); }}>
              <Text style={[Typography.bold1, { color:Colors.ink2 }]}>새 자료 업로드</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>

      {/* 하단 버튼 */}
      {step !== 3 && (
        <View style={s.bottomBar}>
          <Pressable style={s.draftBtn}>
            <Text style={[Typography.bold2, { color:Colors.ink3 }]}>임시저장</Text>
          </Pressable>
          <Pressable
            style={[s.nextBtn, (loading || photoLoading || (step===1 && !canAnalyze)) && { opacity:0.4 }]}
            onPress={step===1 ? analyzeContent : distribute}
            disabled={loading || photoLoading || (step===1 && !canAnalyze)}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[Typography.bold2, { color:'#fff' }]}>
                  {step===1
                    ? 'AI 분석 시작 →'
                    : '학생 배포하기'}
                </Text>
            }
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flex:1, backgroundColor:Colors.bg },
  header:       { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:0, borderBottomWidth:1, borderBottomColor:Colors.line },
  headerRow:    { flexDirection:'row', alignItems:'center', gap:10, paddingBottom:12 },
  backBtn:      { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  body:         { padding:16 },
  sectionLabel: { ...Typography.label2, color:Colors.ink3, letterSpacing:.3, marginBottom:8, marginTop:4 },
  pill:         { paddingHorizontal:14, paddingVertical:7, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  pillActive:   { backgroundColor:Colors.ink, borderColor:Colors.ink },
  otherPublisherInput: { backgroundColor:Colors.white, borderWidth:1.5, borderColor:Colors.line, borderRadius:12, paddingHorizontal:13, paddingVertical:10, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink, marginTop:-6, marginBottom:14 },
  smallPill:    { paddingHorizontal:11, paddingVertical:6, borderRadius:8, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  typeTabs:     { flexDirection:'row', gap:8, marginBottom:14 },
  typeTab:      { flex:1, alignItems:'center', paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  textInputHead: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 },
  photoBtn:     { minWidth:92, paddingHorizontal:12, paddingVertical:7, borderRadius:10, borderWidth:1.5, borderColor:Colors.brand, backgroundColor:Colors.brandBg, alignItems:'center', justifyContent:'center', marginBottom:8 },
  textareaWrap: { backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, marginBottom:12, position:'relative' },
  textarea:     { minHeight:160, padding:14, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink, lineHeight:22 },
  charCount:    { position:'absolute', bottom:10, right:14, fontSize:11, color:Colors.ink3 },
  hint:         { backgroundColor:Colors.brandBg, borderRadius:12, borderWidth:1, borderColor:'#DDD9FF', padding:13 },
  duplicateBox: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:Colors.amberBg, borderRadius:12, borderWidth:1, borderColor:'#FCD34D', padding:12, marginBottom:12 },
  duplicateBtn: { paddingHorizontal:12, paddingVertical:7, borderRadius:9, borderWidth:1, borderColor:Colors.amber, backgroundColor:Colors.white },
  summaryStrip: { flexDirection:'row', backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:12 },
  summaryCell:  { flex:1, padding:13, alignItems:'center' },
  summaryBox:   { backgroundColor:Colors.bg, borderRadius:12, padding:13, marginBottom:14 },
  grammarSectionBox: { backgroundColor:Colors.bg, borderRadius:12, padding:12 },
  grammarExampleDot: { width:6, height:6, borderRadius:99, backgroundColor:Colors.green, marginTop:7, flexShrink:0 },
  grammarRow:   { flexDirection:'row', alignItems:'center', gap:9, marginBottom:8 },
  grammarDot:   { width:7, height:7, borderRadius:99, backgroundColor:Colors.brand, flexShrink:0 },
  sectionRow:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10, marginTop:8 },
  regenBtn:     { paddingHorizontal:12, paddingVertical:5, borderRadius:8, borderWidth:1, borderColor:Colors.line },
  wordListCard: { backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:14 },
  wordRow:      { flexDirection:'row', alignItems:'center', gap:10, padding:12 },
  statusDot:    { width:8, height:8, borderRadius:99, flexShrink:0 },
  editBtn:      { paddingHorizontal:9, paddingVertical:4, borderRadius:7, backgroundColor:Colors.bg },
  doneIcon:     { width:80, height:80, borderRadius:24, backgroundColor:Colors.greenBg, alignItems:'center', justifyContent:'center', marginBottom:18 },
  doneInfo:     { flexDirection:'row', gap:8, alignItems:'center' },
  doneBtn:      { width:'100%', padding:16, borderRadius:14, backgroundColor:Colors.brand, alignItems:'center' },
  bottomBar:    { flexDirection:'row', gap:10, padding:14, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.line, position:'absolute', bottom:0, left:0, right:0 },
  draftBtn:     { flex:1, padding:14, borderRadius:13, borderWidth:1.5, borderColor:Colors.line, alignItems:'center' },
  nextBtn:      { flex:2, padding:14, borderRadius:13, backgroundColor:Colors.brand, alignItems:'center' },
});

// Stepper 내부 스타일
const st = StyleSheet.create({
  stepper:    { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:4, paddingVertical:14 },
  stepCircle: { width:24, height:24, borderRadius:12, backgroundColor:Colors.bg, borderWidth:1.5, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  stepLine:   { flex:1, height:2, backgroundColor:Colors.line, marginTop:11, marginHorizontal:4 },
});
