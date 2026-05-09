import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, CircleCheckBig, Clock3, BrainCircuit, NotebookPen, Sparkles } from 'lucide-react-native';
import { useWordbook } from '../../../hooks/useWordbook';
import { useWrongNote } from '../../../hooks/useWrongNote';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Shadow } from '../../../constants/shadow';

function ReviewCard({
  icon,
  title,
  subtitle,
  countLabel,
  accent,
  onPress,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  countLabel: string;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.card, disabled && { opacity: 0.55 }]}
    >
      <View style={[s.iconWrap, { backgroundColor: `${accent}14` }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.cardTop}>
          <Text style={[Typography.bold2, { color: Colors.ink }]}>{title}</Text>
          <View style={[s.pill, { backgroundColor: `${accent}12`, borderColor: `${accent}33` }]}>
            <Text style={[Typography.label3, { color: accent }]}>{countLabel}</Text>
          </View>
        </View>
        <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 20, marginTop: 6 }]}>
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={18} color={Colors.ink3} strokeWidth={2} />
    </Pressable>
  );
}

export default function ReviewCenterScreen() {
  const router = useRouter();
  const { words, dueWords, masteredWords } = useWordbook();
  const { notes } = useWrongNote();

  const unresolvedNotes = useMemo(
    () => notes.filter(note => note.status === 'unresolved'),
    [notes]
  );

  const totalBacklog = dueWords.length + unresolvedNotes.length;
  const recommendedMinutes = Math.max(8, dueWords.length * 2 + unresolvedNotes.length * 3);
  const reviewFlow = [
    {
      title: '1단계 · 기억 깨우기',
      desc: dueWords.length > 0 ? `오늘 복습할 단어 ${dueWords.length}개를 빠르게 회상합니다.` : '오늘 복습할 단어는 없어요. 다음 단계로 넘어가도 좋아요.',
      status: dueWords.length > 0 ? 'ready' : 'done',
    },
    {
      title: '2단계 · 오답 원인 잡기',
      desc: unresolvedNotes.length > 0 ? `미해결 오답 ${unresolvedNotes.length}개에서 헷갈린 이유를 다시 확인합니다.` : '현재 미해결 오답은 없어요.',
      status: unresolvedNotes.length > 0 ? 'ready' : 'done',
    },
    {
      title: '3단계 · 저장 자료 정리',
      desc: words.length > 0 ? `누적 저장 단어 ${words.length}개 중 외운 단어 ${masteredWords.length}개를 점검합니다.` : '아직 저장된 단어가 없어요. 단어 학습 중 단어장을 채워보세요.',
      status: words.length > 0 ? 'ready' : 'idle',
    },
  ] as const;

  return (
    <View style={s.wrap}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <Text style={{ fontSize: 18, color: '#fff' }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.label2, { color: 'rgba(255,255,255,.68)', marginBottom: 2 }]}>Review Hub</Text>
              <Text style={[Typography.h3, { color: '#fff' }]}>복습 허브</Text>
            </View>
          </View>

          <View style={s.heroCard}>
            <View style={s.heroTop}>
              <View>
                <Text style={[Typography.label2, { color: Colors.brand, marginBottom: 4 }]}>오늘의 복습 큐</Text>
                <Text style={[Typography.h2, { color: Colors.ink }]}>{totalBacklog}개</Text>
              </View>
              <View style={s.heroBadge}>
                <Clock3 size={14} color={Colors.brand} strokeWidth={2} />
                <Text style={[Typography.label2, { color: Colors.brand }]}>{recommendedMinutes}분 코스</Text>
              </View>
            </View>
            <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 21 }]}>
              단어 회상, 오답 복기, 저장 자료 정리를 한 흐름으로 묶었습니다. 짧게 시작해도 복습이 끊기지 않도록 구성했어요.
            </Text>
            <Pressable
              style={[s.primaryBtn, totalBacklog === 0 && { opacity: 0.55 }]}
              disabled={totalBacklog === 0}
              onPress={() => {
                if (dueWords.length > 0) router.push('/(student)/wordbook/review' as any);
                else if (unresolvedNotes.length > 0) router.push('/(student)/wrong-notes' as any);
                else router.push('/(student)/wordbook' as any);
              }}
            >
              <Sparkles size={16} color="#fff" strokeWidth={2} />
              <Text style={[Typography.bold2, { color: '#fff' }]}>오늘의 복습 시작</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.content}>
          <View style={s.sectionRow}>
            <Text style={[Typography.h4, { color: Colors.ink }]}>추천 커리큘럼</Text>
            <Text style={[Typography.label2, { color: Colors.ink3 }]}>충분히 복습하는 흐름</Text>
          </View>

          <View style={s.flowWrap}>
            {reviewFlow.map((step, index) => {
              const accent =
                step.status === 'done' ? Colors.green :
                step.status === 'ready' ? Colors.brand : Colors.ink3;
              return (
                <View key={step.title} style={s.flowRow}>
                  <View style={s.flowRail}>
                    <View style={[s.flowDot, { backgroundColor: accent }]} />
                    {index < reviewFlow.length - 1 && <View style={s.flowLine} />}
                  </View>
                  <View style={s.flowCard}>
                    <View style={s.flowTitleRow}>
                      <Text style={[Typography.bold3, { color: Colors.ink }]}>{step.title}</Text>
                      <Text style={[Typography.label3, { color: accent }]}>
                        {step.status === 'done' ? '준비 완료' : step.status === 'ready' ? '추천' : '대기'}
                      </Text>
                    </View>
                    <Text style={[Typography.body3, { color: Colors.ink3, lineHeight: 20 }]}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={s.sectionRow}>
            <Text style={[Typography.h4, { color: Colors.ink }]}>복습 진입점</Text>
            <Text style={[Typography.label2, { color: Colors.ink3 }]}>저장한 자료에서 바로 시작</Text>
          </View>

          <ReviewCard
            icon={<BrainCircuit size={20} color={Colors.brand} strokeWidth={2} />}
            title="단어장 복습"
            subtitle="오늘 복습이 필요한 단어를 먼저 풀고, 저장한 단어 전체도 점검할 수 있어요."
            countLabel={dueWords.length > 0 ? `${dueWords.length}개 대기` : '오늘은 비어 있음'}
            accent={Colors.brand}
            onPress={() => router.push((dueWords.length > 0 ? '/(student)/wordbook/review' : '/(student)/wordbook') as any)}
          />

          <ReviewCard
            icon={<NotebookPen size={20} color={Colors.red} strokeWidth={2} />}
            title="오답노트 복습"
            subtitle="틀린 문제를 다시 보고, AI 해설과 검증 문제로 이해를 끝까지 확인합니다."
            countLabel={unresolvedNotes.length > 0 ? `${unresolvedNotes.length}개 미해결` : '미해결 없음'}
            accent={Colors.red}
            onPress={() => router.push('/(student)/wrong-notes' as any)}
          />

          <ReviewCard
            icon={<CircleCheckBig size={20} color={Colors.greenDk} strokeWidth={2} />}
            title="저장 자료 정리"
            subtitle="누적 저장 단어와 외운 단어를 나눠 보면서, 복습 리듬을 정리합니다."
            countLabel={`${masteredWords.length}/${words.length} 외움`}
            accent={Colors.green}
            onPress={() => router.push('/(student)/wordbook' as any)}
          />

          <View style={s.sectionRow}>
            <Text style={[Typography.h4, { color: Colors.ink }]}>지금 바로 보기</Text>
            <Text style={[Typography.label2, { color: Colors.ink3 }]}>최근 저장 기준</Text>
          </View>

          <View style={s.previewCard}>
            <Text style={[Typography.bold3, { color: Colors.ink, marginBottom: 10 }]}>단어장 미리보기</Text>
            {words.slice(0, 3).map(word => (
              <View key={word.id} style={s.previewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bold3, { color: Colors.ink }]}>{word.word}</Text>
                  <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 2 }]}>{word.ko}</Text>
                </View>
                <Text style={[Typography.label3, { color: word.status === '외움' ? Colors.greenDk : Colors.ink3 }]}>
                  {word.status}
                </Text>
              </View>
            ))}
            {words.length === 0 && (
              <Text style={[Typography.body3, { color: Colors.ink3 }]}>아직 저장된 단어가 없어요.</Text>
            )}
          </View>

          <View style={s.previewCard}>
            <Text style={[Typography.bold3, { color: Colors.ink, marginBottom: 10 }]}>오답노트 미리보기</Text>
            {unresolvedNotes.slice(0, 3).map(note => (
              <View key={note.id} style={s.previewRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bold3, { color: Colors.ink }]} numberOfLines={1}>{note.question}</Text>
                  <Text style={[Typography.label2, { color: Colors.ink3, marginTop: 2 }]}>{note.correctAnswer}</Text>
                </View>
                <Text style={[Typography.label3, { color: Colors.red }]}>미해결</Text>
              </View>
            ))}
            {unresolvedNotes.length === 0 && (
              <Text style={[Typography.body3, { color: Colors.ink3 }]}>현재 바로 복습할 오답은 없어요.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.brand, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,.25)', alignItems: 'center', justifyContent: 'center' },
  heroCard: { backgroundColor: Colors.white, borderRadius: 22, padding: 18, ...(Shadow.card as any) },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.brandBg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  primaryBtn: { marginTop: 14, backgroundColor: Colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  content: { padding: 16, gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  flowWrap: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: Colors.line, padding: 16, gap: 10 },
  flowRow: { flexDirection: 'row', gap: 12 },
  flowRail: { alignItems: 'center' },
  flowDot: { width: 10, height: 10, borderRadius: 99, marginTop: 4 },
  flowLine: { width: 2, flex: 1, backgroundColor: Colors.line, marginTop: 6 },
  flowCard: { flex: 1, paddingBottom: 10 },
  flowTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  card: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.line, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  pill: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  previewCard: { backgroundColor: Colors.white, borderRadius: 18, borderWidth: 1, borderColor: Colors.line, padding: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 0.5, borderTopColor: Colors.line },
});
