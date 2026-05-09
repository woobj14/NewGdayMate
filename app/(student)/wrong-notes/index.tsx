// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useWrongNote, WrongNote } from '../../../hooks/useWrongNote';
import { generateVerifyQuestion, VerifyQuestion } from '../../../lib/gemini';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Filter = 'all' | 'unresolved' | 'resolved';
type TypeFilter = 'all' | 'grammar' | 'reading';

const TC: Record<string, { bg:string; text:string; label:string }> = {
  grammar: { bg:Colors.brandBg, text:Colors.brandDk, label:'문법'   },
  reading: { bg:Colors.blueLight,      text:Colors.blueDk,       label:'독해/본문' },
};

export default function WrongNotesScreen() {
  const router = useRouter();
  const { notes, loading, streaming, unresolvedCount, generateExplain, resolveNote } = useWrongNote();
  const [filter,   setFilter]   = useState<Filter>('all');
  const [typeFil,  setTypeFil]  = useState<TypeFilter>('all');
  const [selected, setSelected] = useState<WrongNote | null>(null);

  // Firestore 실제 데이터만 사용 (DEMO 제거)
  const all = notes;
  const visible = all.filter(n => {
    const sOk = filter==='all' || n.status===filter;
    const tOk = typeFil==='all' || n.type===typeFil;
    return sOk && tOk;
  });

  const handleTap = async (n: WrongNote) => {
    setSelected(n);
    if (n.explainStatus==='none') await generateExplain(n);
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ fontSize:18, color:Colors.ink }}>←</Text>
          </Pressable>
        </View>
        <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:3 }]}>오답 노트</Text>
        <Text style={[Typography.h2, { marginBottom:12 }]}>
          틀린 문제 복습
          {unresolvedCount>0 && <Text style={{ color:Colors.red }}> {unresolvedCount}</Text>}
        </Text>
        <View style={s.filterRow}>
          {(['all','unresolved','resolved'] as Filter[]).map(f => (
            <Pressable key={f} onPress={()=>setFilter(f)}
              style={[s.pill, filter===f && { backgroundColor:Colors.ink, borderColor:Colors.ink }]}>
              <Text style={[Typography.label2, { color:filter===f?'#fff':Colors.ink3 }]}>
                {f==='all'?'전체':f==='unresolved'?'미해결':'해결됨'}
              </Text>
            </Pressable>
          ))}
          <View style={{ width:1, height:18, backgroundColor:Colors.line }} />
          {(['all','grammar','reading'] as TypeFilter[]).map(t => (
            <Pressable key={t} onPress={()=>setTypeFil(t)}
              style={[s.pill, typeFil===t && { backgroundColor:Colors.brand, borderColor:Colors.brand }]}>
              <Text style={[Typography.label2, { color:typeFil===t?'#fff':Colors.ink3 }]}>
                {t==='all'?'전체':TC[t].label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList data={visible} keyExtractor={n=>n.id}
        contentContainerStyle={{ padding:16, gap:12 }}
        ListEmptyComponent={
          <View style={{ alignItems:'center', paddingTop:60 }}>
            <Text style={{ fontSize:40, marginBottom:12 }}></Text>
            <Text style={[Typography.bold2, { color:Colors.ink }]}>오답이 없어요!</Text>
            <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginTop:6 }]}>
              문제를 풀면서 틀린 문제를 저장해보세요.
            </Text>
          </View>
        }
        renderItem={({ item:n }) => {
          const tc = TC[n.type];
          return (
            <Pressable style={s.card} onPress={()=>handleTap(n)}>
              <View style={s.cardTop}>
                <View style={[s.typeBadge, { backgroundColor:tc.bg }]}>
                  <Text style={[Typography.label3, { color:tc.text }]}>{tc.label}</Text>
                </View>
                <View style={[s.dot, { backgroundColor:n.status==='resolved'?Colors.green:Colors.red }]} />
                <Text style={[Typography.label3, { color:Colors.ink3 }]}>{n.status==='resolved'?'해결됨':'미해결'}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3, marginLeft:'auto' }]}>
                  {n.savedAt.toLocaleDateString('ko-KR')}
                </Text>
              </View>
              <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:8, lineHeight:20 }]}>{n.question}</Text>
              {n.passageSnippet && (
                <Text style={[Typography.label2, { color:Colors.ink3, backgroundColor:Colors.bg, borderRadius:8, padding:8, marginBottom:10, lineHeight:18 }]} numberOfLines={2}>
                  {n.passageSnippet}
                </Text>
              )}
              <View style={s.ansRow}>
                <View style={[s.ansBox, { backgroundColor:Colors.redBg, borderColor:'#fca5a5' }]}>
                  <Text style={[Typography.label3, { color:Colors.red, marginBottom:3 }]}>내 답</Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{n.myAnswer}</Text>
                </View>
                <View style={[s.ansBox, { backgroundColor:Colors.greenBg, borderColor:'#86efac' }]}>
                  <Text style={[Typography.label3, { color:Colors.greenDk, marginBottom:3 }]}>정답</Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{n.correctAnswer}</Text>
                </View>
              </View>
              {/* AI 해설 상태 버튼 */}
              {n.explainStatus==='done' ? (
                <View style={[s.explainTag, { backgroundColor:Colors.greenBg, borderColor:'#86efac' }]}>
                  <Text style={{ fontSize:14 }}>‍</Text>
                  <Text style={[Typography.bold3, { color:Colors.greenDk }]}>선생님 해설 완료 · 탭해서 보기</Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginLeft:'auto' }]}>→</Text>
                </View>
              ) : (streaming===n.id || n.explainStatus==='loading') ? (
                <View style={[s.explainTag, { backgroundColor:Colors.brandBg, borderColor:'#DDD9FF' }]}>
                  <ActivityIndicator color={Colors.brand} size="small" />
                  <Text style={[Typography.bold3, { color:Colors.brand }]}>AI 해설 생성 중...</Text>
                </View>
              ) : (
                <View style={[s.explainTag, { backgroundColor:Colors.brandBg, borderColor:'#DDD9FF' }]}>
                  <Text style={{ fontSize:14 }}></Text>
                  <Text style={[Typography.bold3, { color:Colors.brand }]}>AI 선생님 해설 받기</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      {/* 상세 모달 */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setSelected(null)}>
        {selected && (
          <DetailModal
            note={all.find(n=>n.id===selected.id)??selected}
            streaming={streaming===selected.id}
            onClose={()=>setSelected(null)}
            onResolve={async()=>{ await resolveNote(selected.id); setSelected(null); }}
          />
        )}
      </Modal>
    </View>
  );
}

function DetailModal({ note, streaming, onClose, onResolve }:
  { note:WrongNote; streaming:boolean; onClose:()=>void; onResolve:()=>void }) {

  const tc = TC[note.type];
  type Phase = 'explain' | 'verify' | 'done';
  const [phase,      setPhase]      = useState<Phase>('explain');
  const [verifyQ,    setVerifyQ]    = useState<VerifyQuestion | null>(null);
  const [loadingQ,   setLoadingQ]   = useState(false);
  const [selected,   setSelected]   = useState(-1);
  const [confirmed,  setConfirmed]  = useState(false);

  // "이해했어요" → 유사 문제 생성
  const handleUnderstood = async () => {
    setLoadingQ(true);
    setPhase('verify');
    try {
      const q = await generateVerifyQuestion(
        note.question,
        note.correctAnswer,
        note.explanation ?? '',
        TC[note.type]?.label ?? note.type,
      );
      setVerifyQ(q);
    } catch {
      setVerifyQ(null);
    } finally {
      setLoadingQ(false);
    }
  };

  // 검증 문제 정답 확인
  const handleConfirm = () => {
    if (selected < 0 || !verifyQ) return;
    setConfirmed(true);
  };

  // 정답 후 해결 처리
  const handleCorrect = async () => {
    await onResolve();
  };

  // 틀림 → 해설로 돌아가기
  const handleRetry = () => {
    setPhase('explain');
    setSelected(-1);
    setConfirmed(false);
    setVerifyQ(null);
  };

  const isCorrect = verifyQ !== null && selected === verifyQ.correct;

  return (
    <View style={{ flex:1, backgroundColor:Colors.white }}>
      {/* 헤더 */}
      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:18, paddingTop:20, borderBottomWidth:1, borderBottomColor:Colors.line }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <View style={[{ paddingHorizontal:12, paddingVertical:5, borderRadius:99, backgroundColor:tc.bg }]}>
            <Text style={[Typography.label2, { color:tc.text }]}>{tc.label}</Text>
          </View>
          {phase === 'verify' && (
            <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:99, backgroundColor:Colors.amberBg }}>
              <Text style={[Typography.label3, { color:Colors.amberDk }]}>검증 문제</Text>
            </View>
          )}
        </View>
        <Pressable onPress={onClose} style={{ width:32, height:32, borderRadius:10, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ fontSize:18, color:Colors.ink3 }}>X</Text>
        </Pressable>
      </View>

      {/* ── PHASE: explain ── */}
      {phase === 'explain' && (
        <ScrollView contentContainerStyle={{ padding:20, paddingBottom:100 }}>
          <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:12, lineHeight:22 }]}>{note.question}</Text>
          {note.passageSnippet && (
            <View style={{ backgroundColor:Colors.bg, borderRadius:14, padding:14, marginBottom:14 }}>
              <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:6, letterSpacing:0.5 }]}>지문</Text>
              <Text style={[Typography.body3, { color:Colors.ink, lineHeight:22 }]}>{note.passageSnippet}</Text>
            </View>
          )}
          <View style={{ flexDirection:'row', gap:9, marginBottom:16 }}>
            <View style={{ flex:1, backgroundColor:Colors.redBg, borderRadius:14, borderWidth:1, borderColor:'#fca5a5', padding:13 }}>
              <Text style={[Typography.label3, { color:Colors.red, marginBottom:4 }]}>내 답</Text>
              <Text style={[Typography.bold2, { color:Colors.ink }]}>{note.myAnswer}</Text>
            </View>
            <View style={{ flex:1, backgroundColor:Colors.greenBg, borderRadius:14, borderWidth:1, borderColor:'#86efac', padding:13 }}>
              <Text style={[Typography.label3, { color:Colors.greenDk, marginBottom:4 }]}>정답</Text>
              <Text style={[Typography.bold2, { color:Colors.ink }]}>{note.correctAnswer}</Text>
            </View>
          </View>
          {note.explanation && (
            <View style={{ backgroundColor:Colors.bg, borderRadius:16, padding:16, marginBottom:14 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
                <Text style={{ fontSize:16 }}></Text>
                <Text style={[Typography.bold3, { color:Colors.ink }]}>교재 해설</Text>
              </View>
              <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:22 }]}>{note.explanation}</Text>
            </View>
          )}
          <View style={{ backgroundColor:Colors.bg, borderRadius:16, padding:16, marginBottom:14 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:10 }}>
              <Text style={{ fontSize:16 }}>‍</Text>
              <Text style={[Typography.bold3, { color:Colors.ink }]}>AI 선생님 해설</Text>
              {(streaming || note.explainStatus==='loading') && <ActivityIndicator color={Colors.brand} size="small" style={{ marginLeft:'auto' }} />}
            </View>
            <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:24 }]}>
              {note.teacherExplain || (streaming ? '해설을 생성하고 있어요...' : '해설이 없어요.')}
              {streaming && <Text style={{ color:Colors.brand }}>▌</Text>}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── PHASE: verify ── */}
      {phase === 'verify' && (
        <ScrollView contentContainerStyle={{ padding:20, paddingBottom:100 }}>
          {/* 안내 배너 */}
          <View style={{ backgroundColor:Colors.amberBg, borderRadius:12, borderWidth:1, borderColor:'#FDE68A', padding:13, marginBottom:16, flexDirection:'row', alignItems:'center', gap:9 }}>
            <Text style={{ fontSize:20 }}></Text>
            <View style={{ flex:1 }}>
              <Text style={[Typography.bold3, { color:Colors.amberDk, marginBottom:2 }]}>정말 이해했나요?</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>비슷한 유형의 문제 1개를 풀어보세요.</Text>
            </View>
          </View>

          {loadingQ ? (
            <View style={{ alignItems:'center', paddingVertical:40 }}>
              <ActivityIndicator color={Colors.brand} size="large" />
              <Text style={[Typography.body3, { color:Colors.ink3, marginTop:12 }]}>AI가 검증 문제를 만들고 있어요...</Text>
            </View>
          ) : verifyQ ? (
            <>
              {/* 문제 */}
              <View style={{ backgroundColor:Colors.brandBg, borderRadius:13, borderWidth:1, borderColor:'#DDD9FF', padding:14, marginBottom:14 }}>
                <Text style={[Typography.bold2, { color:Colors.ink, lineHeight:24 }]}>{verifyQ.question}</Text>
              </View>

              {/* 선택지 */}
              <View style={{ gap:8 }}>
                {verifyQ.choices.map((c, i) => {
                  let bg: string = Colors.white, border: string = Colors.line, numBg: string = Colors.bg, numColor: string = Colors.ink3;
                  if (confirmed) {
                    if (i === verifyQ.correct)        { bg = Colors.greenBg; border = '#86efac'; numBg = Colors.green; numColor = '#fff'; }
                    else if (i === selected)          { bg = Colors.redBg;   border = '#fca5a5'; numBg = Colors.red;   numColor = '#fff'; }
                  } else if (i === selected) {
                    bg = Colors.brandBg; border = Colors.brand; numBg = Colors.brand; numColor = '#fff';
                  }
                  return (
                    <Pressable key={i}
                      onPress={() => { if (!confirmed) setSelected(i); }}
                      style={{ flexDirection:'row', alignItems:'center', gap:10, borderRadius:12, borderWidth:1.5, padding:13, backgroundColor:bg, borderColor:border }}
                    >
                      <View style={{ width:26, height:26, borderRadius:7, backgroundColor:numBg, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Text style={[Typography.label2, { color:numColor }]}>{i + 1}</Text>
                      </View>
                      <Text style={[Typography.body3, { flex:1, color:Colors.ink }]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 해설 (확인 후) */}
              {confirmed && (
                <View style={{ backgroundColor:Colors.bg, borderRadius:12, borderWidth:1, borderColor:Colors.line, padding:13, marginTop:12 }}>
                  <Text style={[Typography.label2, { color:Colors.brand, marginBottom:5 }]}>해설</Text>
                  <Text style={[Typography.body3, { color:Colors.ink2, lineHeight:20 }]}>{verifyQ.explain}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginTop:30 }]}>문제 생성에 실패했어요.</Text>
          )}
        </ScrollView>
      )}

      {/* 하단 버튼 */}
      <View style={{ padding:16, paddingBottom:32, borderTopWidth:1, borderTopColor:Colors.line, gap:9 }}>
        {/* explain 단계 */}
        {phase === 'explain' && note.status === 'unresolved' && (
          <Pressable
            onPress={handleUnderstood}
            style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:9, backgroundColor:Colors.brand, borderRadius:16, paddingVertical:15 }}
          >
            <Text style={{ fontSize:18 }}></Text>
            <Text style={[Typography.bold2, { color:'#fff' }]}>이해했어요! 검증 문제 풀기</Text>
          </Pressable>
        )}
        {phase === 'explain' && note.status === 'resolved' && (
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:Colors.greenBg, borderRadius:16, paddingVertical:15 }}>
            <Text style={{ fontSize:18 }}></Text>
            <Text style={[Typography.bold2, { color:Colors.greenDk }]}>해결된 문제예요</Text>
          </View>
        )}

        {/* verify 단계 — 확인 전 */}
        {phase === 'verify' && !confirmed && !loadingQ && (
          <Pressable
            onPress={handleConfirm}
            disabled={selected < 0}
            style={{ backgroundColor:Colors.brand, borderRadius:16, paddingVertical:15, alignItems:'center', opacity: selected < 0 ? 0.4 : 1 }}
          >
            <Text style={[Typography.bold2, { color:'#fff' }]}>확인</Text>
          </Pressable>
        )}

        {/* verify 단계 — 정답 */}
        {phase === 'verify' && confirmed && isCorrect && (
          <Pressable
            onPress={handleCorrect}
            style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:9, backgroundColor:Colors.green, borderRadius:16, paddingVertical:15 }}
          >
            <Text style={{ fontSize:18 }}></Text>
            <Text style={[Typography.bold2, { color:'#fff' }]}>완전히 이해! 해결됨으로 표시</Text>
          </Pressable>
        )}

        {/* verify 단계 — 오답 */}
        {phase === 'verify' && confirmed && !isCorrect && (
          <View style={{ gap:9 }}>
            <View style={{ backgroundColor:Colors.redBg, borderRadius:12, padding:12, flexDirection:'row', alignItems:'center', gap:8 }}>
              <Text style={{ fontSize:16 }}></Text>
              <Text style={[Typography.bold3, { color:Colors.red }]}>아직 조금 더 연습이 필요해요</Text>
            </View>
            <View style={{ flexDirection:'row', gap:9 }}>
              <Pressable onPress={handleRetry}
                style={{ flex:1, borderRadius:14, borderWidth:1.5, borderColor:Colors.brand, paddingVertical:13, alignItems:'center' }}>
                <Text style={[Typography.bold2, { color:Colors.brand }]}>해설 다시 보기</Text>
              </Pressable>
              <Pressable onPress={onClose}
                style={{ flex:1, borderRadius:14, borderWidth:1.5, borderColor:Colors.line, paddingVertical:13, alignItems:'center' }}>
                <Text style={[Typography.bold2, { color:Colors.ink3 }]}>나중에 다시</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:      { flex:1, backgroundColor:Colors.bg },
  header:    { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:18, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line },
  headerTop: { flexDirection:'row', marginBottom:12 },
  backBtn:   { width:34, height:34, borderRadius:11, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  filterRow: { flexDirection:'row', gap:7, flexWrap:'wrap', alignItems:'center' },
  pill:      { paddingHorizontal:12, paddingVertical:5, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  card:      { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:16 },
  cardTop:   { flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 },
  typeBadge: { paddingHorizontal:9, paddingVertical:3, borderRadius:99 },
  dot:       { width:7, height:7, borderRadius:99 },
  ansRow:    { flexDirection:'row', gap:9, marginBottom:12 },
  ansBox:    { flex:1, borderRadius:12, borderWidth:1, padding:11 },
  explainTag:{ flexDirection:'row', alignItems:'center', gap:8, borderWidth:1, borderRadius:12, padding:11 },
});
