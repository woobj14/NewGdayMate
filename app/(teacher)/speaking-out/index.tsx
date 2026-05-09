// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  TextInput, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { parseContentWithAI } from '../../../lib/gemini';
import { generateSpeakingOutXlsx, shareSpeakingOutFile, WordEntry, DialogGroup, ReadingPage } from '../../../lib/generateSpeakingOut';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type ContentType = '대화문' | '본문' | '단어';
type Step = 1 | 2 | 3;

type StoredContentType = 'dialog' | 'reading' | 'word';
type StoredContent = {
  id: string;
  title: string;
  publisher?: string;
  publicationYear?: string;
  grade?: string;
  unit?: string;
  type: StoredContentType;
  text?: string;
  words?: Array<{ word?: string; ko?: string }>;
};

const PUBLISHERS = ['천재교육','미래엔','동아출판','YBM','비상교육','NE능률','기타'];
const GRADES     = ['중1','중2','중3','고1','고2','고3'];
const UNITS      = Array.from({ length: 8 }, (_, i) => `${i + 1}과`);

const CONTENT_TYPE_TO_STORED: Record<ContentType, StoredContentType> = {
  '대화문': 'dialog',
  '본문': 'reading',
  '단어': 'word',
};

function toDisplayType(type: StoredContentType): ContentType {
  if (type === 'dialog') return '대화문';
  if (type === 'reading') return '본문';
  return '단어';
}

// 단계 표시
function Stepper({ step }: { step: Step }) {
  const labels = ['입력', 'AI 추출 확인', '다운로드'];
  return (
    <View style={s.stepper}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done   = step > n;
        return (
          <View key={n} style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
            <View style={{ alignItems:'center', gap:4 }}>
              <View style={[s.stepCircle,
                done   && { backgroundColor: Colors.brand },
                active && { backgroundColor: Colors.brand },
              ]}>
                <Text style={[Typography.label2, { color: done||active ? '#fff' : Colors.ink3 }]}>
                  {done ? 'V' : n}
                </Text>
              </View>
              <Text style={[Typography.label3, { color: active ? Colors.brand : Colors.ink3 }]}>
                {label}
              </Text>
            </View>
            {i < 2 && <View style={[s.stepLine, done && { backgroundColor: Colors.brand }]} />}
          </View>
        );
      })}
    </View>
  );
}

export default function SpeakingOutScreen() {
  const router = useRouter();
  const { user } = useAppStore();

  // ── Step 1 상태 ──
  const [step,       setStep]       = useState<Step>(1);
  const [type,       setType]       = useState<ContentType>('대화문');
  const [pubIdx,     setPubIdx]     = useState(0);
  const [gradeIdx,   setGradeIdx]   = useState(0);
  const [unitIdx,    setUnitIdx]    = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [contents,   setContents]   = useState<StoredContent[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── Step 2 상태 (AI 추출 결과) ──
  const [words,      setWords]      = useState<WordEntry[]>([]);
  const [dialogs,    setDialogs]    = useState<DialogGroup[]>([]);
  const [reading,    setReading]    = useState<ReadingPage[]>([]);
  const [editIdx,    setEditIdx]    = useState<number | null>(null);

  // ── Step 3 상태 ──
  const [filePath,   setFilePath]   = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const grade     = GRADES[gradeIdx];
  const publisher = PUBLISHERS[pubIdx];
  const unit      = UNITS[unitIdx];
  const filteredType = CONTENT_TYPE_TO_STORED[type];
  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    if (!user?.academyId) {
      setContents([]);
      setContentLoading(false);
      return;
    }

    setContentLoading(true);
    const q = query(
      collection(db, 'content'),
      where('academyId', '==', user.academyId),
      where('type', '==', filteredType)
    );

    const unsub = onSnapshot(q, snap => {
      const nextContents = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as StoredContent));
      setContents(nextContents);
      setContentLoading(false);
    }, () => {
      setContents([]);
      setContentLoading(false);
    });

    return () => unsub();
  }, [user?.academyId, filteredType]);

  const filteredContents = contents
    .filter(content => {
      const haystack = [
        content.title,
        content.publisher,
        content.publicationYear,
        content.grade,
        content.unit,
      ].join(' ').toLowerCase();
      return !normalizedSearch || haystack.includes(normalizedSearch);
    })
    .sort((a, b) => {
      const score = (content: StoredContent) => {
        let value = 0;
        if ((content.publisher ?? '') === publisher) value += 4;
        if ((content.grade ?? '') === grade) value += 2;
        if ((content.unit ?? '') === unit) value += 1;
        return value;
      };
      return score(b) - score(a);
    });

  useEffect(() => {
    if (selectedContentId && !filteredContents.some(content => content.id === selectedContentId)) {
      setSelectedContentId(null);
    }
  }, [filteredContents, selectedContentId]);

  const selectedContent = filteredContents.find(content => content.id === selectedContentId) ?? null;
  const activeType = selectedContent ? toDisplayType(selectedContent.type) : type;
  const activeGrade = selectedContent?.grade ?? grade;
  const activePublisher = selectedContent?.publisher ?? publisher;
  const activeUnit = selectedContent?.unit ?? unit;

  // Step 1 → 2: 등록 자료 기반 추출
  const analyzeContent = useCallback(async () => {
    if (!selectedContent) return;
    setLoading(true);
    try {
      const sourceText = selectedContent.text ?? '';
      const result = selectedContent.words?.length
        ? {
            words: selectedContent.words.map(word => ({
              word: word.word ?? '',
              ko: word.ko ?? '',
              pos: '',
              def: '',
              syn: '',
              grade: activeGrade,
            })),
          }
        : await parseContentWithAI(sourceText, 'word', activeGrade);

      // 단어 75개 채우기 (부족하면 빈 칸으로)
      const extracted: WordEntry[] = result.words.map(w => ({ en: w.word, ko: w.ko }));
      while (extracted.length < 75) extracted.push({ en: '', ko: '' });
      setWords(extracted.slice(0, 75));
      setDialogs([]);
      setReading([]);

      // 대화문 파싱 (빈 줄 기준 그룹 분리)
      if (selectedContent.type === 'dialog' && sourceText.trim()) {
        const groups = sourceText.split(/\n\s*\n/).map(g => g.trim()).filter(Boolean);
        const parsedDialogs: DialogGroup[] = groups.map((grp, i) => ({
          label: `대화문${i + 1}`,
          lines: grp.split('\n').filter(l => l.trim()).map(line => ({ en: line.trim(), ko: '' })),
        }));
        setDialogs(parsedDialogs);
      }

      // 본문 파싱 (빈 줄 기준 단락 분리)
      if (selectedContent.type === 'reading' && sourceText.trim()) {
        const paras = sourceText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        const parsedReading: ReadingPage[] = paras.map(para => ({
          lines: para.split('\n').filter(l => l.trim()).map(line => ({ en: line.trim(), ko: '' })),
        }));
        setReading(parsedReading);
      }

      setStep(2);
    } catch {
      // Fallback: 텍스트에서 직접 단어 추출
      const lines = (selectedContent.text ?? '').split('\n').filter(l => l.trim() && !l.includes(':'));
      const fallbackWords: WordEntry[] = lines.slice(0, 75).map(l => ({ en: l.trim(), ko: '' }));
      while (fallbackWords.length < 75) fallbackWords.push({ en: '', ko: '' });
      setWords(fallbackWords);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }, [selectedContent, activeGrade]);

  // Step 2 → 3: 엑셀 생성
  const generateExcel = useCallback(async () => {
    setGenerating(true);
    try {
      const path = await generateSpeakingOutXlsx({
        contentType: activeType,
        grade: activeGrade,
        publisher: activePublisher,
        author:  '선생님',
        unit: activeUnit,
        words,
        dialogs: activeType === '대화문' ? dialogs : undefined,
        reading: activeType === '본문'   ? reading : undefined,
      });
      setFilePath(path);
      setStep(3);
    } catch (e) {
      Alert.alert('생성 실패', '다시 시도해 주세요.');
    } finally {
      setGenerating(false);
    }
  }, [activeType, activeGrade, activePublisher, activeUnit, words, dialogs, reading]);

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
              <Pressable style={s.backBtn} onPress={() => step > 1 ? setStep(s => (s-1) as Step) : router.back()}>
                <Text style={{ fontSize:18, color:Colors.ink }}>←</Text>
              </Pressable>
              <View style={{ flex:1 }}>
                <Text style={[Typography.label2, { color:Colors.ink3 }]}>
              {activeGrade} {activePublisher} {activeUnit}
                </Text>
                <Text style={[Typography.h4]}>스피킹 아웃 트레이닝</Text>
              </View>
            </View>
        <Stepper step={step} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── STEP 1: 입력 ── */}
        {step === 1 && (
          <View style={s.body}>
            {/* 콘텐츠 타입 */}
            <Text style={s.label}>자료 유형</Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
              {(['대화문','본문','단어'] as ContentType[]).map(t => (
                <Pressable key={t} onPress={() => setType(t)}
                  style={[s.typeBtn, type===t && { borderColor:Colors.brand, backgroundColor:Colors.brandBg }]}>
                  <Text style={[Typography.bold2, { color: type===t ? Colors.brand : Colors.ink3 }]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            {/* 출판사 */}
            <Text style={s.label}>출판사</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', gap:7 }}>
                {PUBLISHERS.map((p, i) => (
                  <Pressable key={p} onPress={() => setPubIdx(i)}
                    style={[s.pill, pubIdx===i && s.pillActive]}>
                    <Text style={[Typography.label2, { color: pubIdx===i ? '#fff' : Colors.ink3 }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* 학년 + 단원 */}
            <View style={{ flexDirection:'row', gap:14, marginBottom:16 }}>
              <View style={{ flex:1 }}>
                <Text style={s.label}>학년</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                  {GRADES.map((g, i) => (
                    <Pressable key={g} onPress={() => setGradeIdx(i)}
                      style={[s.smallPill, gradeIdx===i && s.pillActive]}>
                      <Text style={[Typography.label3, { color: gradeIdx===i ? '#fff' : Colors.ink3 }]}>{g}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.label}>단원</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                  {UNITS.slice(0,6).map((u, i) => (
                    <Pressable key={u} onPress={() => setUnitIdx(i)}
                      style={[s.smallPill, unitIdx===i && s.pillActive]}>
                      <Text style={[Typography.label3, { color: unitIdx===i ? '#fff' : Colors.ink3 }]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={s.label}>등록 자료 선택</Text>
            <View style={s.searchWrap}>
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="등록한 자료 제목, 출판사, 학년, 단원 검색..."
                placeholderTextColor={Colors.ink3}
              />
            </View>

            <View style={s.contentPicker}>
              {contentLoading ? (
                <View style={s.emptyState}>
                  <ActivityIndicator color={Colors.brand} />
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>등록 자료를 불러오는 중...</Text>
                </View>
              ) : filteredContents.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>선택 가능한 등록 자료가 없어요</Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginTop:4, textAlign:'center' }]}>
                    자료 업로드에서 {type} 자료를 먼저 등록하면 여기서 바로 선택할 수 있어요.
                  </Text>
                </View>
              ) : (
                filteredContents.map(content => {
                  const selected = selectedContentId === content.id;
                  return (
                    <Pressable
                      key={content.id}
                      style={[s.contentCard, selected && s.contentCardSelected]}
                      onPress={() => setSelectedContentId(content.id)}
                    >
                      <View style={{ flex:1 }}>
                        <Text style={[Typography.bold3, { color:Colors.ink }]} numberOfLines={1}>{content.title}</Text>
                        <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>
                          {content.publisher ?? activePublisher} · {content.publicationYear ?? '년도 미지정'} · {content.grade ?? activeGrade} · {content.unit ?? activeUnit}
                        </Text>
                      </View>
                      <View style={[s.selectBadge, selected && s.selectBadgeActive]}>
                        <Text style={[Typography.label3, { color:selected ? '#fff' : Colors.brand }]}>
                          {selected ? '선택됨' : '선택'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* 안내 */}
            <View style={s.hint}>
              <Text style={[Typography.label2, { color:Colors.brand, marginBottom:5 }]}>
                등록 자료를 그대로 활용합니다
              </Text>
              <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
                이미 등록한 자료를 선택하면, 기존 텍스트와 단어 데이터를 바탕으로 스피킹 아웃 트레이닝 엑셀을 자동 준비합니다.
              </Text>
              {(type === '대화문' || type === '본문') && (
                <View style={{ marginTop:8, paddingTop:8, borderTopWidth:1, borderTopColor:'#DDD9FF' }}>
                  <Text style={[Typography.bold3, { color:Colors.brand, marginBottom:3 }]}>
                    {type === '대화문' ? ' 등록된 대화 그룹 구조를 그대로 사용' : ' 등록된 단락 구조를 그대로 사용'}
                  </Text>
                  <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
                    {type === '대화문'
                      ? '선택한 대화문 자료의 그룹별 구성을 그대로 엑셀에 반영합니다.'
                      : '선택한 본문 자료의 단락별 구성을 그대로 엑셀에 반영합니다.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── STEP 2: AI 추출 결과 확인 ── */}
        {step === 2 && (
          <View style={s.body}>
            {/* 요약 */}
            <View style={s.summaryRow}>
              <View style={s.summaryCell}>
                <Text style={[Typography.statSm, { color:Colors.brand }]}>
                  {words.filter(w => w.en).length}
                </Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>추출 단어</Text>
              </View>
              <View style={[s.summaryCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.ink }]}>75</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>목표 단어</Text>
              </View>
              <View style={[s.summaryCell, { borderLeftWidth:0.5, borderLeftColor:Colors.line }]}>
                <Text style={[Typography.statSm, { color:Colors.green }]}>6</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginTop:2 }]}>시트 수</Text>
              </View>
            </View>

            {/* 단어 목록 (왼쪽: 영어, 오른쪽: 한국어) */}
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10, marginTop:4 }}>
              <Text style={[Typography.bold3]}>
                단어 목록 <Text style={{ color:Colors.brand }}>75개</Text>
              </Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                탭하여 편집
              </Text>
            </View>

            {/* 3세트 레이블 */}
            {[0, 25, 50].map(setStart => (
              <View key={setStart} style={s.wordSetCard}>
                <View style={s.wordSetHeader}>
                  <Text style={[Typography.bold3, { color:Colors.brand }]}>
                    {setStart + 1}~{setStart + 25}번
                  </Text>
                </View>
                {words.slice(setStart, setStart + 25).map((w, i) => {
                  const idx = setStart + i;
                  const isEditing = editIdx === idx;
                  return (
                    <View key={idx} style={[s.wordRow, i < 24 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}>
                      <Text style={[Typography.label2, { color:Colors.ink3, width:24 }]}>{idx + 1}</Text>
                      {isEditing ? (
                        <>
                          <TextInput
                            style={[s.wordInput, { flex:1 }]}
                            defaultValue={w.en}
                            onBlur={e => {
                              const updated = [...words];
                              updated[idx] = { ...updated[idx], en: e.nativeEvent.text };
                              setWords(updated);
                            }}
                            autoFocus
                            placeholder="영어"
                          />
                          <TextInput
                            style={[s.wordInput, { flex:1 }]}
                            defaultValue={w.ko}
                            onBlur={e => {
                              const updated = [...words];
                              updated[idx] = { ...updated[idx], ko: e.nativeEvent.text };
                              setWords(updated);
                              setEditIdx(null);
                            }}
                            placeholder="한국어 뜻"
                          />
                        </>
                      ) : (
                        <Pressable style={{ flex:1, flexDirection:'row', gap:8 }} onPress={() => setEditIdx(idx)}>
                          <Text style={[Typography.body3, { flex:1, color: w.en ? Colors.ink : Colors.ink3 }]}>
                            {w.en || '(비어있음)'}
                          </Text>
                          <Text style={[Typography.body3, { flex:1, color: w.ko ? Colors.ink3 : Colors.line }]}>
                            {w.ko || '—'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* ── STEP 3: 완료 ── */}
        {step === 3 && (
          <View style={{ padding:28, alignItems:'center', paddingTop:40 }}>
            <View style={s.doneIcon}>
              <Text style={{ fontSize:34 }}>V</Text>
            </View>
            <Text style={[Typography.h2, { textAlign:'center', marginBottom:8 }]}>
              엑셀 생성 완료!
            </Text>
            <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginBottom:20, lineHeight:22 }]}>
              {activeGrade} {activePublisher} {activeUnit} {activeType}{'\n'}스피킹 아웃 트레이닝 파일이 준비됐어요
            </Text>

            {/* 시트 구성 안내 */}
            <View style={s.sheetInfo}>
              {['표지','단어 (영어/한국어 75개)',activeType === '대화문' ? '대화문 (영어/한국어)' : activeType === '본문' ? '본문 (영어/한국어)' : '단어 확장 학습','단어 테스트 뜻쓰기','단어 테스트 단어쓰기'].map((name, i) => (
                <View key={i} style={[s.sheetRow, i > 0 && { borderTopWidth:0.5, borderTopColor:Colors.line }]}>
                  <View style={s.sheetNum}><Text style={[Typography.label3, { color:'#fff', fontWeight:'700' }]}>{i+1}</Text></View>
                  <Text style={[Typography.body3, { color:Colors.ink }]}>{name}</Text>
                </View>
              ))}
            </View>

            <Pressable style={[s.downloadBtn, { marginTop:24, marginBottom:10 }]}
              onPress={() => shareSpeakingOutFile(filePath)}>
              <Text style={[Typography.bold1, { color:'#fff', letterSpacing:-.3 }]}>
                파일 저장 / 공유
              </Text>
            </Pressable>
            <Pressable style={s.secondBtn}
              onPress={() => { setStep(1); setSelectedContentId(null); setSearch(''); setWords([]); setDialogs([]); setReading([]); }}>
              <Text style={[Typography.bold1, { color:Colors.ink2 }]}>새 파일 만들기</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>

      {/* 하단 버튼 */}
      {step !== 3 && (
        <View style={s.bottomBar}>
          {step === 1 && (
            <Pressable
              style={[s.nextBtn, (!selectedContent || loading) && { opacity:0.4 }]}
              onPress={analyzeContent}
              disabled={!selectedContent || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[Typography.bold2, { color:'#fff' }]}>AI 분석 시작 →</Text>
              }
            </Pressable>
          )}
          {step === 2 && (
            <>
              <Pressable style={s.skipBtn} onPress={() => setStep(1)}>
                <Text style={[Typography.bold2, { color:Colors.ink3 }]}>다시 입력</Text>
              </Pressable>
              <Pressable
                style={[s.nextBtn, generating && { opacity:0.4 }]}
                onPress={generateExcel}
                disabled={generating}
              >
                {generating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[Typography.bold2, { color:'#fff' }]}>엑셀 생성</Text>
                }
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:0, borderBottomWidth:1, borderBottomColor:Colors.line },
  backBtn:     { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  body:        { padding:16 },
  label:       { ...Typography.label2, color:Colors.ink3, marginBottom:8, marginTop:4 },
  typeBtn:     { flex:1, alignItems:'center', paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  pill:        { paddingHorizontal:14, paddingVertical:7, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  pillActive:  { backgroundColor:Colors.ink, borderColor:Colors.ink },
  smallPill:   { paddingHorizontal:11, paddingVertical:6, borderRadius:8, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  searchWrap:  { backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, marginBottom:12, paddingHorizontal:12 },
  searchInput: { minHeight:44, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink },
  contentPicker:{ backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:12 },
  contentCard: { flexDirection:'row', alignItems:'center', gap:10, padding:13, borderTopWidth:0.5, borderTopColor:Colors.line },
  contentCardSelected: { backgroundColor:Colors.brandBg },
  selectBadge: { minWidth:58, paddingHorizontal:10, paddingVertical:6, borderRadius:99, borderWidth:1, borderColor:Colors.brand, alignItems:'center', justifyContent:'center' },
  selectBadgeActive: { backgroundColor:Colors.brand, borderColor:Colors.brand },
  emptyState:  { minHeight:120, alignItems:'center', justifyContent:'center', gap:8, padding:16 },
  textareaWrap:{ backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, marginBottom:12, position:'relative' },
  textarea:    { minHeight:160, padding:14, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink, lineHeight:22 },
  charCount:   { position:'absolute', bottom:10, right:14, fontSize:11, color:Colors.ink3 },
  hint:        { backgroundColor:Colors.brandBg, borderRadius:12, borderWidth:1, borderColor:'#DDD9FF', padding:13 },
  summaryRow:  { flexDirection:'row', backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:14 },
  summaryCell: { flex:1, padding:13, alignItems:'center' },
  wordSetCard: { backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden', marginBottom:12 },
  wordSetHeader:{ padding:10, paddingHorizontal:13, borderBottomWidth:1, borderBottomColor:Colors.line, backgroundColor:Colors.brandBg },
  wordRow:     { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:13, paddingVertical:9 },
  wordInput:   { borderBottomWidth:1, borderBottomColor:Colors.brand, paddingVertical:4, fontFamily:'Pretendard-Regular', fontSize:13, color:Colors.ink },
  doneIcon:    { width:80, height:80, borderRadius:24, backgroundColor:Colors.greenBg, alignItems:'center', justifyContent:'center', marginBottom:18 },
  sheetInfo:   { width:'100%', backgroundColor:Colors.white, borderRadius:14, borderWidth:1, borderColor:Colors.line, overflow:'hidden' },
  sheetRow:    { flexDirection:'row', alignItems:'center', gap:10, padding:12 },
  sheetNum:    { width:24, height:24, borderRadius:7, backgroundColor:Colors.brand, alignItems:'center', justifyContent:'center' },
  downloadBtn: { width:'100%', padding:16, borderRadius:14, backgroundColor:Colors.brand, alignItems:'center' },
  secondBtn:   { width:'100%', padding:14, borderRadius:14, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white, alignItems:'center' },
  bottomBar:   { flexDirection:'row', gap:10, padding:14, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.line, position:'absolute', bottom:0, left:0, right:0 },
  skipBtn:     { flex:1, padding:14, borderRadius:13, borderWidth:1.5, borderColor:Colors.line, alignItems:'center' },
  nextBtn:     { flex:2, padding:14, borderRadius:13, backgroundColor:Colors.brand, alignItems:'center' },
  stepper:     { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:4, paddingVertical:14 },
  stepCircle:  { width:24, height:24, borderRadius:12, backgroundColor:Colors.bg, borderWidth:1.5, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  stepLine:    { flex:1, height:2, backgroundColor:Colors.line, marginTop:11, marginHorizontal:4 },
});
