// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { useAppStore } from '../../../stores/useAppStore';
import { useCoach }     from '../../../hooks/useCoach';
import { useWrongNote } from '../../../hooks/useWrongNote';
import { Colors }      from '../../../constants/colors';
import { Typography }  from '../../../constants/typography';
import { CoachKey }    from '../../../lib/gemini';
import { ScoreBand } from '../../../stores/useAppStore';
import { getRecommendedScoreBand, SCORE_BAND_META } from '../../../lib/scoreBand';

const COACHES: Array<{
  key: CoachKey; name: string; emoji: string;
  role: string; career: string; color: string; bg: string;
  tags: string[]; quote: string;
}> = [
  {
    key: 'betty', name: 'Betty', emoji: '‍',
    role: '1타 강사 · NO-NONSENSE TOP TEACHER',
    career: '수백 명의 내신 1등급을 만들어온 핵심 압축 전문가. 최신 수능 트렌드에 누구보다 빠르게 반응해요.',
    color: Colors.betty, bg: Colors.bettyBg,
    tags: ['직설적', '열정적', '목표 지향적', '실전 중심'],
    quote: '"핵심만 쏙쏙 뽑아서 설명해줄게. 이거 왜 헷갈려? 이렇게만 봐!"',
  },
  {
    key: 'lukas', name: 'Lukas', emoji: '‍',
    role: '꼼꼼한 코치 · METICULOUS & CARING COACH',
    career: '단 한 명도 포기하지 않는 맞춤형 교육 전문가. 학생의 속도에 맞춘 단계별 코칭.',
    color: Colors.lukas, bg: Colors.lukasBg,
    tags: ['세심함', '인내심', '격려적', '단계별'],
    quote: '"천천히 같이 해보자. 모르는 부분은 언제든지 물어봐도 돼."',
  },
  {
    key: 'alex', name: 'Alex', emoji: '‍',
    role: '심리 멘토 · PSYCHOLOGY-AWARE MENTOR',
    career: '학습 심리학과 뇌과학 기반의 차세대 코칭 전문가. 공부 습관 설계부터 멘탈 관리까지.',
    color: Colors.alex, bg: Colors.alexBg,
    tags: ['통찰력', '심리 파악', '창의적', '자유로움'],
    quote: '"영어는 문법 규칙이 아니야. 마음가짐과 습관이 성적을 만들어."',
  },
];

type CoachView = 'select' | 'chat';

export default function CoachScreen() {
  const [view, setView]     = useState<CoachView>('select');
  const { user, selectedCoach, setCoach, chatHistory } = useAppStore();
  const { ask, streaming, streamingText, error } = useCoach();
  const { notes, topWrongReason }                = useWrongNote();
  const scoreBand = (user?.scoreBand ?? '80s') as ScoreBand;
  const recommendedBand = getRecommendedScoreBand(user?.latestMockScore);

  // 미해결 오답 자동 연동 — 최근 오답 최대 3개
  const unresolvedNotes = notes.filter(n => n.status === 'unresolved').slice(0, 3);
  const autoContext = unresolvedNotes.length > 0
    ? `\n\n[학생 최근 오답 정보]:\n${unresolvedNotes.map(n =>
        `- ${n.questionType ?? '문법'}: "${n.question.slice(0,40)}..." (정답: ${n.correctAnswer})`
      ).join('\n')}`
    : '';
  const [input, setInput]   = useState('');
  const flatRef             = useRef<FlatList>(null);

  // 메시지 목록 자동 스크롤
  useEffect(() => {
    if (chatHistory.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatHistory, streamingText]);

  const currentCoach = COACHES.find(c => c.key === selectedCoach)!;
  const quickPrompts: Record<ScoreBand, string[]> = {
    '70s': [
      '오늘 20분 공부 루틴 짜줘',
      '본문 해석이 약한데 어디부터 보면 돼?',
      '단어와 문법 중 뭐부터 해야 해?',
    ],
    '80s': [
      '내 실수 패턴 기준으로 오늘 복습 순서 짜줘',
      '빈칸이랑 순서배열 실수 줄이는 법 알려줘',
      '90점 가려면 지금 뭘 먼저 잡아야 해?',
    ],
    '90plus': [
      '만점권 학생용 변별력 훈련 15분 코스 짜줘',
      '고난도 선지 비교하는 법 알려줘',
      '시간 압박 줄이는 실전 팁 줘',
    ],
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || streaming) return;
    setInput('');
    await ask(q);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (streaming) return;
    await ask(prompt);
  };

  if (view === 'chat') {
    const messages = [
      ...chatHistory,
      ...(streaming ? [{ role: 'model' as const, content: streamingText, ts: Date.now() }] : []),
    ];

    return (
      <KeyboardAvoidingView
        style={s.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* 채팅 헤더 */}
        <View style={s.chatHeader}>
          <Pressable style={s.backBtn} onPress={() => setView('select')}>
            <Text>←</Text>
          </Pressable>
          <View style={[s.ava, { backgroundColor: currentCoach.bg }]}>
            <Text style={{ fontSize: 20 }}>{currentCoach.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bold2]}>{currentCoach.name}</Text>
            <Text style={[Typography.label2, { color: Colors.green }]}>● 온라인</Text>
          </View>
          <View style={s.engineTag}>
            <Text style={[Typography.label3, { color: Colors.amberDk }]}>Gemini 2.0 Flash</Text>
          </View>
        </View>

        <View style={s.contextStrip}>
          <Text style={[Typography.label2, { color: Colors.brand }]}>
            {SCORE_BAND_META[scoreBand].label}
            {recommendedBand && recommendedBand !== scoreBand ? ` · 추천 ${SCORE_BAND_META[recommendedBand].label}` : ''}
          </Text>
          {topWrongReason && (
            <Text style={[Typography.label3, { color: Colors.ink3, marginTop: 2 }]}>
              최근 약점 기반으로 답변을 조정하고 있어요.
            </Text>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickRow}
        >
          {quickPrompts[scoreBand].map((prompt) => (
            <Pressable key={prompt} style={s.quickChip} onPress={() => handleQuickPrompt(prompt)} disabled={streaming}>
              <Text style={[Typography.label2, { color: Colors.brand }]}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 메시지 목록 */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          style={{ flex: 1, backgroundColor: Colors.bg }}
          renderItem={({ item }) => (
            <View style={[s.msgRow, item.role === 'user' && { flexDirection: 'row-reverse' }]}>
              {item.role === 'model' && (
                <View style={[s.avaSm, { backgroundColor: currentCoach.bg }]}>
                  <Text style={{ fontSize: 14 }}>{currentCoach.emoji}</Text>
                </View>
              )}
              <View style={[
                s.bubble,
                item.role === 'user'
                  ? { backgroundColor: currentCoach.color, borderBottomRightRadius: 3 }
                  : { backgroundColor: Colors.white, borderBottomLeftRadius: 3, borderWidth: 1, borderColor: Colors.line },
              ]}>
                <Text style={[Typography.body3, { color: item.role === 'user' ? '#fff' : Colors.ink, lineHeight: 20 }]}>
                  {item.content}
                  {item.role === 'model' && streaming && item.ts === messages[messages.length-1]?.ts ? '▌' : ''}
                </Text>
              </View>
            </View>
          )}
        />

        {error && (
          <View style={s.errorBox}>
            <Text style={[Typography.label2, { color: Colors.red }]}>
              코치 응답을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </Text>
            <Text style={[Typography.label3, { color: Colors.ink3, marginTop: 4 }]}>
              {error}
            </Text>
          </View>
        )}

        {/* 입력창 */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="코치에게 질문하기..."
            placeholderTextColor={Colors.ink3}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!streaming}
          />
          <Pressable
            style={[s.sendBtn, { backgroundColor: currentCoach.color, opacity: streaming ? 0.5 : 1 }]}
            onPress={handleSend}
            disabled={streaming}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // 코치 선택 화면
  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.selHeader}>
        <Text style={[Typography.label2, { color: Colors.brand, marginBottom: 5 }]}>
          나에게 딱 맞는 코치를 골라봐요
        </Text>
        <Text style={[Typography.h2]}>AI 학습 코치를{'\n'}선택하세요</Text>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {COACHES.map(c => (
          <View key={c.key} style={[s.coachCard, selectedCoach === c.key && { borderColor: c.color, borderWidth: 2 }]}>
            <View style={s.coachTop}>
              <View style={[s.coachAva, { backgroundColor: c.bg }]}>
                <Text style={{ fontSize: 26 }}>{c.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.h4, { letterSpacing: -0.5 }]}>{c.name}</Text>
                <Text style={[Typography.label2, { color: c.color, marginTop: 2 }]}>{c.role}</Text>
              </View>
            </View>
            <Text style={[Typography.body3, { color: c.color, marginBottom: 10, lineHeight: 20 }]}>{c.career}</Text>
            <View style={s.tags}>
              {c.tags.map(t => (
                <View key={t} style={[s.tag, { backgroundColor: c.bg, borderColor: c.color + '44' }]}>
                  <Text style={[Typography.label2, { color: c.color }]}>{t}</Text>
                </View>
              ))}
            </View>
            <Text style={[Typography.body3, { fontStyle: 'italic', color: c.color, backgroundColor: c.bg, padding: 12, borderRadius: 12, marginBottom: 14, lineHeight: 20 }]}>
              {c.quote}
            </Text>
            <Pressable
              style={[s.selBtn, { backgroundColor: c.color }]}
              onPress={() => { setCoach(c.key); setView('chat'); }}
            >
              <Text style={[Typography.bold2, { color: '#fff' }]}>{c.name}와 시작하기</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: Colors.bg },
  selHeader:  { padding: 18, paddingTop: 56, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line, marginBottom: 14 },
  coachCard:  { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.line, padding: 18 },
  coachTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  coachAva:   { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tags:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1.5 },
  selBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingTop: 52, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.line },
  contextStrip: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: Colors.white },
  quickRow: { gap: 8, paddingHorizontal: 14, paddingBottom: 10, backgroundColor: Colors.white },
  quickChip: { borderRadius: 99, borderWidth: 1, borderColor: '#DDD9FF', backgroundColor: Colors.brandBg, paddingHorizontal: 12, paddingVertical: 8 },
  backBtn:    { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  ava:        { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avaSm:      { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  engineTag:  { backgroundColor: Colors.amberBg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FDE68A' },
  msgRow:     { flexDirection: 'row', gap: 7, alignItems: 'flex-end' },
  bubble:     { maxWidth: 240, borderRadius: 16, padding: 10 },
  errorBox:   { marginHorizontal: 10, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: Colors.redBg, padding: 12 },
  inputRow:   { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: Colors.line, backgroundColor: Colors.white },
  input:      { flex: 1, borderWidth: 1.5, borderColor: Colors.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontFamily: 'Pretendard-Regular', fontSize: 13, color: Colors.ink, backgroundColor: Colors.bg },
  sendBtn:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
