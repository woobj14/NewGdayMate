// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 — 학습 세션 시작/완료 화면
// 학습 전: 오늘 목표 설정 + 예상 시간
// 학습 후: 오늘 배운 것 요약 + 성취 피드백
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet,
  Animated, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';
import { STEP_DEFS, CONTENT_TYPE_LABEL, CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI, ContentType } from '../../../types/lesson';
import { useLesson } from '../../../hooks/useLesson';

type Phase = 'goal' | 'summary';

const GOAL_OPTIONS = [
  { steps:1, label:'가볍게',   sub:'1단계만',       time:'약 5분',  emoji:'' },
  { steps:2, label:'적당히',   sub:'2단계까지',      time:'약 12분', emoji:'' },
  { steps:3, label:'열심히',   sub:'3단계까지',      time:'약 20분', emoji:'' },
  { steps:-1,label:'끝까지',   sub:'모든 단계',      time:'최대 도전', emoji:'' },
];

export default function SessionScreen() {
  const router = useRouter();
  const { lessonId, type, title, phase, completedSteps, earnedXp } = useLocalSearchParams<{
    lessonId:string; type:string; title:string;
    phase?:string; completedSteps?:string; earnedXp?:string;
  }>();

  const [goalIdx, setGoalIdx] = useState(1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const { getPct } = useLesson();

  const contentType  = type as ContentType;
  const trackColor   = CONTENT_TYPE_COLOR[contentType] ?? Colors.brand;
  const trackEmoji   = CONTENT_TYPE_EMOJI[contentType] ?? '';
  const trackLabel   = CONTENT_TYPE_LABEL[contentType] ?? '';
  const steps        = STEP_DEFS[contentType] ?? [];
  const currentPct   = lessonId ? getPct(lessonId, steps.length) : 0;
  const doneStepped  = completedSteps ? JSON.parse(completedSteps) as number[] : [];
  const totalXp      = earnedXp ? parseInt(earnedXp) : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:350, useNativeDriver:true }),
      Animated.spring(scaleAnim, { toValue:1, useNativeDriver:true, tension:70, friction:8 }),
    ]).start();
  }, []);

  // ── 목표 설정 화면 ─────────────────────────────────────────────
  if (phase !== 'summary') {
    const goal = GOAL_OPTIONS[goalIdx];
    const targetSteps = goal.steps === -1 ? steps.length : Math.min(goal.steps, steps.length);
    const estimatedXp = steps.slice(0, targetSteps).reduce((a,b) => a+b.xp, 0);

    return (
      <View style={s.wrap}>
        {/* 헤더 */}
        <View style={[s.header, { backgroundColor: trackColor }]}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ color:'#fff', fontSize:16 }}>←</Text>
          </Pressable>
          <View style={{ flex:1 }}>
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.65)' }]}>{trackLabel}</Text>
            <Text style={[Typography.bold2, { color:'#fff' }]} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={{ fontSize:28 }}>{trackEmoji}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding:20, paddingBottom:100 }}>
          {/* 현재 진도 */}
          <Animated.View style={{ opacity:fadeAnim, transform:[{scale:scaleAnim}] }}>
            <View style={[s.progressCard, { borderColor:trackColor }]}>
              <Text style={[Typography.label2, { color:trackColor, marginBottom:4 }]}>현재 진행률</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={{ flex:1, height:8, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' }}>
                  <View style={{ height:'100%', width:`${currentPct}%` as any, backgroundColor:trackColor, borderRadius:99 }}/>
                </View>
                <Text style={[Typography.bold2, { color:trackColor }]}>{currentPct}%</Text>
              </View>
              <Text style={[Typography.label3, { color:Colors.ink3, marginTop:6 }]}>
                {steps.filter((_,i) => i < Math.round(currentPct/100*steps.length)).length}/{steps.length} 단계 완료
              </Text>
            </View>

            {/* 오늘 목표 선택 */}
            <Text style={[Typography.h4, { marginTop:20, marginBottom:12 }]}>오늘 목표를 정해요</Text>
            <View style={{ gap:9 }}>
              {GOAL_OPTIONS.map((g, i) => (
                <Pressable
                  key={i}
                  onPress={() => setGoalIdx(i)}
                  style={[s.goalCard,
                    goalIdx===i && { borderColor:trackColor, borderWidth:2, backgroundColor:trackColor+'0A' }
                  ]}
                >
                  <Text style={{ fontSize:28 }}>{g.emoji}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[Typography.bold2, { color: goalIdx===i ? trackColor : Colors.ink }]}>
                      {g.label}
                    </Text>
                    <Text style={[Typography.label2, { color:Colors.ink3 }]}>{g.sub} · {g.time}</Text>
                  </View>
                  <View style={{
                    width:22, height:22, borderRadius:11,
                    borderWidth:2, borderColor: goalIdx===i ? trackColor : Colors.line,
                    backgroundColor: goalIdx===i ? trackColor : 'transparent',
                    alignItems:'center', justifyContent:'center',
                  }}>
                    {goalIdx===i && <Text style={{ color:'#fff', fontSize:12, fontWeight:'800' }}>V</Text>}
                  </View>
                </Pressable>
              ))}
            </View>

            {/* 예상 XP */}
            <View style={[s.xpPreview, { borderColor:trackColor+'40' }]}>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>목표 달성 시 예상 XP</Text>
              <Text style={[Typography.statSm, { color:trackColor }]}>+{estimatedXp} XP</Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* 시작 버튼 */}
        <View style={s.bottomBar}>
          <Pressable
            style={[s.startBtn, { backgroundColor:trackColor, ...Shadow.brand as any }]}
            onPress={() => router.replace({
              pathname: '/(student)/learn/[lessonId]',
              params: { lessonId, type, title, goalSteps: String(targetSteps) },
            })}
          >
            <Text style={{ fontSize:18 }}></Text>
            <Text style={[Typography.bold1, { color:'#fff' }]}>학습 시작!</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── 세션 완료 요약 화면 ───────────────────────────────────────
  const countAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(countAnim, { toValue:totalXp, duration:1000, useNativeDriver:false }).start();
  }, []);

  const messages = [
    totalXp >= 400 ? ' 완벽해요! 오늘 최고의 학습!' :
    totalXp >= 200 ? ' 대단해요! 목표 초과 달성!' :
    totalXp >= 100 ? '⭐ 잘했어요! 꾸준히 이 페이스로!' :
    ' 좋은 시작이에요! 내일도 해봐요!',
  ];

  return (
    <View style={s.wrap}>
      <View style={[s.header, { backgroundColor:trackColor }]}>
        <Text style={[Typography.h3, { color:'#fff' }]}>오늘의 학습 완료!</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:20, alignItems:'center', paddingBottom:100 }}>
        <Animated.View style={{ opacity:fadeAnim, transform:[{scale:scaleAnim}], width:'100%' }}>
          {/* 완료 아이콘 */}
          <View style={{ alignItems:'center', marginVertical:16 }}>
            <View style={[s.doneIcon, { backgroundColor:trackColor+'18', borderColor:trackColor }]}>
              <Text style={{ fontSize:44 }}>{trackEmoji}</Text>
            </View>
            <Text style={[Typography.h3, { marginTop:12, textAlign:'center' }]}>{messages[0]}</Text>
          </View>

          {/* 획득 XP */}
          <View style={[s.xpCard, { borderColor:trackColor, ...Shadow.brand as any }]}>
            <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>오늘 획득 XP</Text>
            <Animated.Text style={[Typography.stat, { color:trackColor, fontSize:40, letterSpacing:-2 }]}>
              +{totalXp}
            </Animated.Text>
            <Text style={[Typography.label2, { color:Colors.ink3, marginTop:4 }]}>XP 획득!</Text>
          </View>

          {/* 완료한 단계들 */}
          {doneStepped.length > 0 && (
            <View style={s.stepSummary}>
              <Text style={[Typography.bold2, { marginBottom:10 }]}>오늘 완료한 단계</Text>
              {doneStepped.map(idx => {
                const step = steps[idx];
                if (!step) return null;
                return (
                  <View key={idx} style={s.stepRow}>
                    <Text style={{ fontSize:18 }}>{step.emoji}</Text>
                    <Text style={[Typography.bold3, { flex:1, color:Colors.ink }]}>{step.title}</Text>
                    <View style={{ backgroundColor:Colors.greenBg, borderRadius:99, paddingHorizontal:9, paddingVertical:3 }}>
                      <Text style={[Typography.label3, { color:Colors.greenDk, fontWeight:'700' }]}>+{step.xp} XP</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* 내일 예고 */}
          {currentPct < 100 && (
            <View style={s.tomorrowCard}>
              <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>내일 이어서</Text>
              {steps.filter((_,i) => !doneStepped.includes(i)).slice(0,2).map((step,i) => (
                <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:6 }}>
                  <Text style={{ fontSize:16 }}>{step.emoji}</Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{step.title}</Text>
                  <Text style={[Typography.label3, { color:Colors.ink3, marginLeft:'auto' as any }]}>+{step.xp} XP</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <View style={s.bottomBar}>
        <Pressable
          style={[s.startBtn, { backgroundColor:Colors.green, ...Shadow.green as any }]}
          onPress={() => router.replace('/(student)/' as any)}
        >
          <Text style={[Typography.bold1, { color:'#fff' }]}>홈으로 돌아가기 </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flex:1, backgroundColor:Colors.bg },
  header:       { paddingTop:52, paddingHorizontal:18, paddingBottom:16, flexDirection:'row', alignItems:'center', gap:12 },
  backBtn:      { width:28, height:28, borderRadius:8, borderWidth:1, borderColor:'rgba(255,255,255,.3)', alignItems:'center', justifyContent:'center' },
  progressCard: { backgroundColor:Colors.white, borderRadius:16, borderWidth:1.5, padding:14, marginBottom:4 },
  goalCard:     { flexDirection:'row', alignItems:'center', gap:13, backgroundColor:Colors.white, borderRadius:16, borderWidth:1.5, borderColor:Colors.line, padding:14 },
  xpPreview:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:Colors.white, borderRadius:14, borderWidth:1.5, padding:14, marginTop:14 },
  bottomBar:    { padding:16, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:0.5, borderTopColor:Colors.line },
  startBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, borderRadius:16, paddingVertical:16 },
  doneIcon:     { width:90, height:90, borderRadius:26, borderWidth:2, alignItems:'center', justifyContent:'center' },
  xpCard:       { backgroundColor:Colors.white, borderRadius:20, borderWidth:2, padding:20, alignItems:'center', marginBottom:14, width:'100%' },
  stepSummary:  { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:12, width:'100%' },
  stepRow:      { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderTopWidth:0.5, borderTopColor:Colors.line },
  tomorrowCard: { backgroundColor:Colors.bg, borderRadius:14, borderWidth:1, borderColor:Colors.line, padding:14, width:'100%' },
});
