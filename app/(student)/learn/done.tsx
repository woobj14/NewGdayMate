// ═══════════════════════════════════════════════════════════════
// 🎓 LX팀 (Learning Experience) 소유 파일
// 원칙: 학습 과학 기반 · 파이프라인 수호 · Gemini 효율 · 좌절 없는 UX · Surgical
// 수정 전 CLAUDE.md 확인 필수 | CT/PI 파일 수정 금지
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { STEP_DEFS, ContentType } from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

export default function StepDoneScreen() {
  const router = useRouter();
  const { stepTitle, xp, lessonId, stepIndex, contentType } = useLocalSearchParams<{
    stepTitle:string; xp:string; lessonId:string; stepIndex:string; contentType:string;
  }>();

  const type    = (contentType as ContentType) ?? 'dialog';
  const steps   = STEP_DEFS[type] ?? STEP_DEFS.dialog;
  const idx     = parseInt(stepIndex ?? '0', 10);
  const xpVal   = parseInt(xp ?? '100', 10);
  const isLast  = idx >= steps.length - 1;
  const nextStep = !isLast ? steps[idx + 1] : null;

  // ── XP 카운트업 애니메이션 ──
  const [displayXp, setDisplayXp] = useState(0);
  const scaleAnim  = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconAnim   = useRef(new Animated.Value(0)).current;
  const xpScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. 아이콘 팝인
    Animated.spring(iconAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 80, friction: 7,
    }).start();

    // 2. 카드 페이드인
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue:1, useNativeDriver:true, tension:70, friction:8 }),
        Animated.timing(opacityAnim, { toValue:1, duration:300, useNativeDriver:true, easing:Easing.out(Easing.quad) }),
      ]),
    ]).start();

    // 3. XP 카운트업 (0 → xpVal)
    const duration = 800;
    const steps_n  = 30;
    const interval = duration / steps_n;
    let current    = 0;
    const timer    = setInterval(() => {
      current += 1;
      const eased = Math.round(xpVal * (1 - Math.pow(1 - current / steps_n, 3)));
      setDisplayXp(eased);
      if (current >= steps_n) {
        clearInterval(timer);
        setDisplayXp(xpVal);
        // 완료 시 XP 배지 펄스
        Animated.sequence([
          Animated.timing(xpScaleAnim, { toValue:1.12, duration:120, useNativeDriver:true }),
          Animated.timing(xpScaleAnim, { toValue:1,    duration:150, useNativeDriver:true }),
        ]).start();
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={s.wrap}>
      <View style={s.content}>
        {/* 완료 아이콘 — 팝인 */}
        <Animated.View style={[s.iconWrap, {
          transform: [{ scale: iconAnim }],
          opacity:   iconAnim,
        }]}>
          <Text style={{ fontSize: 40 }}>V</Text>
        </Animated.View>

        {/* 타이틀 + XP */}
        <Animated.View style={{
          opacity:   opacityAnim,
          transform: [{ scale: scaleAnim }],
          alignItems: 'center', width: '100%',
        }}>
          <Text style={[Typography.h2, { marginBottom:6, textAlign:'center' }]}>
            {stepTitle || '단계'} 완료!
          </Text>
          <Text style={[Typography.body3, { color:Colors.ink3, marginBottom:14, textAlign:'center' }]}>
            수고했어요! 계속 이 속도로 가봐요 
          </Text>

          {/* XP 카운트업 배지 */}
          <Animated.View style={[s.xpBadge, { transform:[{ scale: xpScaleAnim }] }]}>
            <Text style={[Typography.label2, { color:Colors.brand, marginBottom:2 }]}>획득 XP</Text>
            <Text style={{ fontSize:36, fontWeight:'800', color:Colors.brand, letterSpacing:-1 }}>
              +{displayXp}
            </Text>
          </Animated.View>

          {/* 전체 단계 진행 도트 */}
          <View style={s.stepDots}>
            {steps.map((_, i) => (
              <View key={i} style={[
                s.stepDot,
                i < idx  && { backgroundColor: Colors.green,  width: 18 },
                i === idx && { backgroundColor: Colors.brand,  width: 26 },
                i > idx  && { backgroundColor: Colors.line,   width: 18 },
              ]} />
            ))}
          </View>
          <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:20 }]}>
            {idx + 1} / {steps.length} 단계 완료
          </Text>

          {/* 다음 단계 미리보기 or 전체 완료 */}
          {nextStep && (
            <View style={s.nextPreview}>
              <Text style={[Typography.label3, { color:Colors.ink3, marginBottom:4, letterSpacing:.5 }]}>
                다음 단계
              </Text>
              <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:2 }]}>
                {nextStep.title}
              </Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>
                {nextStep.desc}
              </Text>
              <View style={s.nextXpTag}>
                <Text style={[Typography.label3, { color:Colors.brand, fontWeight:'700' }]}>
                  +{nextStep.xp} XP
                </Text>
              </View>
            </View>
          )}
          {isLast && (
            <View style={[s.nextPreview, { backgroundColor:Colors.greenBg, borderColor:'#86efac' }]}>
              <Text style={{ fontSize:32, textAlign:'center', width:'100%', marginBottom:8 }}></Text>
              <Text style={[Typography.bold2, { color:Colors.greenDk, textAlign:'center' }]}>
                모든 단계 완료!
              </Text>
              <Text style={[Typography.label2, { color:Colors.greenDk, textAlign:'center', marginTop:4 }]}>
                이 자료를 완전히 마스터했어요
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      {/* 버튼 */}
      <View style={s.btns}>
        {!isLast && nextStep ? (
          <Pressable
            style={s.primaryBtn}
            onPress={() => {
              const isContent = type === 'dialog' || type === 'reading';
              router.replace({
                pathname: isContent
                  ? '/(student)/learn/content-step'
                  : '/(student)/learn/step',
                params: {
                  lessonId,
                  stepIndex:   String(idx + 1),
                  quizType:    nextStep.quizType,
                  stepTitle:   nextStep.title,
                  xp:          String(nextStep.xp),
                  contentType,
                  text:        '',
                  lessonTitle: '',
                },
              });
            }}
          >
            <Text style={[Typography.bold1, { color:'#fff' }]}>다음 단계로 →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[s.primaryBtn, { backgroundColor: Colors.green }]}
            onPress={() => router.replace({
              pathname: '/(student)/learn/[lessonId]',
              params: { lessonId, type: contentType, title: '' },
            })}
          >
            <Text style={[Typography.bold1, { color:'#fff' }]}> 학습 완료!</Text>
          </Pressable>
        )}
        <Pressable style={s.secondaryBtn} onPress={() => router.replace('/(student)/learn/')}>
          <Text style={[Typography.bold2, { color:Colors.ink2 }]}>자료 목록으로</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.white },
  content:     { flex:1, alignItems:'center', justifyContent:'center', padding:24 },
  iconWrap:    { width:80, height:80, borderRadius:24, backgroundColor:Colors.greenBg, alignItems:'center', justifyContent:'center', marginBottom:16 },
  xpBadge:    { backgroundColor:Colors.brandBg, borderRadius:20, paddingHorizontal:32, paddingVertical:16, marginBottom:16, alignItems:'center', borderWidth:1.5, borderColor:'#DDD9FF', ...Shadow.brand },
  stepDots:   { flexDirection:'row', gap:5, marginBottom:6, alignItems:'center' },
  stepDot:    { height:5, borderRadius:3 },
  nextPreview: { width:'100%', backgroundColor:Colors.bg, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:16, marginBottom:8, position:'relative' },
  nextXpTag:  { position:'absolute', top:12, right:12, backgroundColor:Colors.brandBg, borderRadius:99, paddingHorizontal:10, paddingVertical:3 },
  btns:       { padding:16, paddingBottom:36, gap:10 },
  primaryBtn: { borderRadius:14, backgroundColor:Colors.brand, paddingVertical:16, alignItems:'center', ...Shadow.brand },
  secondaryBtn:{ borderRadius:14, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white, paddingVertical:14, alignItems:'center' },
});
