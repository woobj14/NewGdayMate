// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useWordbook, Rating } from '../../../hooks/useWordbook';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

const RATING_BTNS: { rating: Rating; label: string; sub: string; bg: string; text: string }[] = [
  { rating:0, label:'모름',   sub:'다시',    bg:Colors.redBg,   text:Colors.red    },
  { rating:1, label:'어려움', sub:'1일 후',  bg:Colors.amberBg, text:Colors.amberDk     },
  { rating:2, label:'보통',   sub:'3일 후',  bg:Colors.brandBg, text:Colors.brand  },
  { rating:3, label:'쉬움',   sub:'7일 후',  bg:Colors.greenBg, text:Colors.greenDk },
];

export default function WordReviewScreen() {
  const router = useRouter();
  const { dueWords, rateWord } = useWordbook();
  // nextReview 오름차순 정렬 — 가장 오래된 단어부터 복습
  // 버그 수정: 실제 dueWords만 사용 (DEMO_DUE 제거)
  const sorted = [...dueWords]
    .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
  const queue = sorted;

  const [idx,      setIdx]      = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [stats,    setStats]    = useState({ 모름:0, 햇갈림:0, 외움:0 });
  const flipAnim = useRef(new Animated.Value(0)).current;

  const current = queue[idx];
  const progress = queue.length > 0 ? (idx / queue.length) * 100 : 0;

  const flip = () => {
    if (flipped) return;
    Animated.timing(flipAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start(() => setFlipped(true));
  };

  const handleRate = async (rating: Rating) => {
    if (!current) return;

    await rateWord(current.id, rating);
    const statusMap: Record<Rating, keyof typeof stats> = { 0:'모름', 1:'햇갈림', 2:'햇갈림', 3:'외움' };
    setStats(prev => ({ ...prev, [statusMap[rating]]: prev[statusMap[rating]] + 1 }));

    if (idx + 1 >= queue.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setFlipped(false);
      flipAnim.setValue(0);
    }
  };

  // 완료 화면
  if (done) {
    return (
      <View style={[s.wrap, { justifyContent:'center', alignItems:'center', padding:28 }]}>
        <Text style={{ fontSize:56, marginBottom:16 }}></Text>
        <Text style={[Typography.h2, { marginBottom:8, textAlign:'center' }]}>복습 완료!</Text>
        <Text style={[Typography.body2, { color:Colors.ink3, marginBottom:32, textAlign:'center', lineHeight:24 }]}>
          오늘의 단어 {queue.length}개를\n모두 복습했어요
        </Text>
        {/* 결과 카드 */}
        <View style={s.resultCard}>
          {[
            { label:'완전히 외움',  val:stats['외움'],   color:Colors.green  },
            { label:'햇갈림',       val:stats['햇갈림'], color:Colors.orange },
            { label:'다시 공부',    val:stats['모름'],   color:Colors.red    },
          ].map((r,i) => (
            <View key={i} style={[s.resultCell, i<2 && { borderRightWidth:0.5, borderRightColor:Colors.line }]}>
              <Text style={[Typography.stat, { color:r.color }]}>{r.val}</Text>
              <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]}>{r.label}</Text>
            </View>
          ))}
        </View>
        <Pressable style={s.doneBtn} onPress={() => router.replace('/(student)/wordbook/' as any)}>
          <Text style={[Typography.bold1, { color:'#fff' }]}>단어장으로</Text>
        </Pressable>
        <Pressable style={[s.doneBtn, { backgroundColor:Colors.white, borderWidth:1.5, borderColor:Colors.line, marginTop:10 }]}
          onPress={() => { setIdx(0); setFlipped(false); setDone(false); flipAnim.setValue(0); setStats({ 모름:0, 햇갈림:0, 외움:0 }); }}>
          <Text style={[Typography.bold1, { color:Colors.ink2 }]}>다시 복습</Text>
        </Pressable>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[s.wrap, { justifyContent:'center', alignItems:'center', padding:28 }]}>
        <Text style={{ fontSize:56, marginBottom:16 }}></Text>
        <Text style={[Typography.h2, { marginBottom:8, textAlign:'center' }]}>복습할 단어가 없어요</Text>
        <Text style={[Typography.body2, { color:Colors.ink3, marginBottom:32, textAlign:'center', lineHeight:24 }]}>
          지금은 오늘 복습 대기 중인 단어가 없습니다.
          {'\n'}단어장이나 복습 허브에서 다음 학습을 이어가면 돼요.
        </Text>
        <Pressable style={s.doneBtn} onPress={() => router.replace('/(student)/wordbook' as any)}>
          <Text style={[Typography.bold1, { color:'#fff' }]}>단어장으로</Text>
        </Pressable>
        <Pressable
          style={[s.doneBtn, { backgroundColor:Colors.white, borderWidth:1.5, borderColor:Colors.line, marginTop:10 }]}
          onPress={() => router.replace('/(student)/review-center' as any)}
        >
          <Text style={[Typography.bold1, { color:Colors.ink2 }]}>복습 허브로</Text>
        </Pressable>
      </View>
    );
  }

  const rotateY = flipAnim.interpolate({ inputRange:[0,1], outputRange:['0deg','180deg'] });

  return (
    <View style={s.wrap}>
      {/* 상단 바 */}
      <View style={s.topBar}>
        <Pressable style={s.closeBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:16, color:Colors.ink }}>X</Text>
        </Pressable>
        <View style={s.progressWrap}>
          <View style={[s.progressFill, { width:`${progress}%` as any }]} />
        </View>
        <Text style={[Typography.bold3, { color:Colors.ink, minWidth:36, textAlign:'right' }]}>
          {idx+1}/{queue.length}
        </Text>
      </View>

      <View style={s.content}>
        <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:16 }]}>
          {current.unitId} · {current.pos}
        </Text>

        {/* 플래시카드 */}
        <Pressable onPress={flip}>
          <Animated.View style={[s.card, { transform:[{ rotateY }] }]}>
            {!flipped ? (
              /* 앞면: 영어 */
              <View style={s.cardFace}>
                <Text style={[Typography.label2, { color:Colors.brand, marginBottom:12 }]}>
                  영어 뜻을 기억해보세요
                </Text>
                <Text style={[Typography.h1, { letterSpacing:-1.5, marginBottom:6, textAlign:'center' }]}>
                  {current.word}
                </Text>
                <Text style={[Typography.body3, { color:Colors.ink3, marginBottom:24 }]}>
                  {current.phonetic}
                </Text>
                <View style={s.tapHint}>
                  <Text style={{ fontSize:14 }}></Text>
                  <Text style={[Typography.label2, { color:Colors.ink3 }]}>탭해서 정답 확인</Text>
                </View>
              </View>
            ) : (
              /* 뒷면: 뜻 */
              <Animated.View style={[s.cardFace, { transform:[{ rotateY:'180deg' }] }]}>
                <Text style={[Typography.label2, { color:Colors.green, marginBottom:12 }]}>정답</Text>
                <Text style={[Typography.h3, { color:Colors.ink, marginBottom:6, textAlign:'center' }]}>
                  {current.ko}
                </Text>
                <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', marginBottom:8, lineHeight:22 }]}>
                  {current.def}
                </Text>
                {current.syn && (
                  <View style={s.synBox}>
                    <Text style={[Typography.label2, { color:Colors.brand }]}>syn. {current.syn}</Text>
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>
        </Pressable>

        {/* 평가 버튼 (뒷면에서만 표시) */}
        {flipped && (
          <View style={s.ratingSection}>
            <Text style={[Typography.label2, { color:Colors.ink3, textAlign:'center', marginBottom:12 }]}>
              얼마나 잘 기억했나요?
            </Text>
            <View style={s.ratingRow}>
              {RATING_BTNS.map(btn => (
                <Pressable key={btn.rating}
                  style={[s.ratingBtn, { backgroundColor:btn.bg }]}
                  onPress={() => handleRate(btn.rating)}
                >
                  <Text style={[Typography.bold3, { color:btn.text }]}>{btn.label}</Text>
                  <Text style={[Typography.label3, { color:btn.text, opacity:0.7 }]}>{btn.sub}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:          { flex:1, backgroundColor:Colors.bg },
  topBar:        { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:18, paddingTop:52, paddingBottom:14, backgroundColor:Colors.white, borderBottomWidth:1, borderBottomColor:Colors.line },
  closeBtn:      { width:34, height:34, borderRadius:11, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  progressWrap:  { flex:1, height:6, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' },
  progressFill:  { height:'100%', backgroundColor:Colors.brand, borderRadius:99 },
  content:       { flex:1, padding:20, paddingTop:24 },
  card:          { backgroundColor:Colors.white, borderRadius:28, borderWidth:1, borderColor:Colors.line, padding:32, alignItems:'center', minHeight:260, justifyContent:'center', marginBottom:24, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:10, elevation:3 },
  cardFace:      { alignItems:'center', width:'100%' },
  tapHint:       { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:Colors.bg, borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  synBox:        { backgroundColor:Colors.brandBg, borderRadius:10, paddingHorizontal:14, paddingVertical:7, marginTop:4 },
  ratingSection: { },
  ratingRow:     { flexDirection:'row', gap:9 },
  ratingBtn:     { flex:1, paddingVertical:13, borderRadius:14, alignItems:'center', gap:3 },
  resultCard:    { flexDirection:'row', backgroundColor:Colors.white, borderRadius:20, borderWidth:1, borderColor:Colors.line, width:'100%', marginBottom:28, overflow:'hidden' },
  resultCell:    { flex:1, padding:16, alignItems:'center' },
  doneBtn:       { width:'100%', padding:16, borderRadius:16, backgroundColor:Colors.brand, alignItems:'center' },
});
