// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 — 일일 미션 화면
// 매일 3개 미션 · 진행률 · XP 보상 · 완료 애니메이션
// ═══════════════════════════════════════════════════════════════
import { useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable,
  StyleSheet, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMission } from '../../../hooks/useMission';
import { Colors }     from '../../../constants/colors';
import { Shadow }     from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

// ── 미션 카드 ─────────────────────────────────────────────────
function MissionCard({ mission, index }: { mission: any; index: number }) {
  const scaleAnim  = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkAnim  = useRef(new Animated.Value(0)).current;
  const pct = Math.round((mission.current / mission.target) * 100);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue:1, duration:300, delay:index*100, useNativeDriver:true,
      }),
      Animated.spring(scaleAnim, {
        toValue:1, tension:70, friction:8, delay:index*100, useNativeDriver:true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (mission.completed) {
      Animated.spring(checkAnim, {
        toValue:1, tension:80, friction:6, useNativeDriver:true,
      }).start();
    }
  }, [mission.completed]);

  const borderColor = mission.completed ? Colors.green : pct > 0 ? Colors.amber : Colors.line;
  const bgColor     = mission.completed ? Colors.greenBg : Colors.white;

  return (
    <Animated.View style={{
      opacity:   opacityAnim,
      transform: [{ scale: scaleAnim }],
    }}>
      <View style={[s.missionCard, { borderColor, backgroundColor: bgColor, ...Shadow.card as any }]}>
        {/* 이모지 + 제목 */}
        <View style={s.cardTop}>
          <View style={[s.iconWrap, {
            backgroundColor: mission.completed ? Colors.green+'20' : Colors.bg,
          }]}>
            <Text style={{ fontSize: 26 }}>{mission.emoji}</Text>
          </View>

          <View style={{ flex:1 }}>
            <Text style={[Typography.bold2, {
              color: mission.completed ? Colors.greenDk : Colors.ink,
            }]}>
              {mission.title}
            </Text>
            <Text style={[Typography.label2, { color:Colors.ink3, marginTop:2 }]}>
              {mission.desc}
            </Text>
          </View>

          {/* 완료 체크 or XP 배지 */}
          {mission.completed ? (
            <Animated.View style={[s.checkCircle, {
              transform: [{ scale: checkAnim }],
            }]}>
              <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>V</Text>
            </Animated.View>
          ) : (
            <View style={s.xpTag}>
              <Text style={[Typography.bold3, { color:Colors.amber }]}>+{mission.xpReward}</Text>
              <Text style={[Typography.label3, { color:Colors.amberDk }]}>XP</Text>
            </View>
          )}
        </View>

        {/* 진행바 */}
        <View style={{ marginTop:12, gap:5 }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
            <Text style={[Typography.label3, { color: mission.completed ? Colors.greenDk : Colors.ink3 }]}>
              {mission.completed ? '완료!' : `${mission.current} / ${mission.target}`}
            </Text>
            <Text style={[Typography.bold3, {
              color: mission.completed ? Colors.green : pct > 0 ? Colors.amber : Colors.ink3,
            }]}>
              {pct}%
            </Text>
          </View>
          <View style={[s.progTrack, { backgroundColor: mission.completed ? Colors.green+'30' : Colors.line }]}>
            <Animated.View style={[s.progFill, {
              width:`${pct}%` as any,
              backgroundColor: mission.completed ? Colors.green : pct > 60 ? Colors.amber : Colors.brand,
            }]}/>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function MissionsScreen() {
  const router = useRouter();
  const { missions, loading, completedCount, totalXp } = useMission();

  const allDone    = completedCount === missions.length && missions.length > 0;
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue:1, duration:400, useNativeDriver:true }).start();
  }, []);

  // 자정까지 남은 시간
  const now        = new Date();
  const midnight   = new Date(now); midnight.setHours(24,0,0,0);
  const remaining  = midnight.getTime() - now.getTime();
  const hoursLeft  = Math.floor(remaining / 3600000);
  const minsLeft   = Math.floor((remaining % 3600000) / 60000);

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <Animated.View style={[s.header, {
        opacity:   headerAnim,
        backgroundColor: allDone ? Colors.green : Colors.amber,
      }]}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={{ color:'#fff', fontSize:18 }}>←</Text>
          </Pressable>
          <View style={{ flex:1 }}>
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.7)' }]}>
              {hoursLeft}시간 {minsLeft}분 후 초기화
            </Text>
            <Text style={[Typography.h3, { color:'#fff' }]}>오늘의 미션</Text>
          </View>
          <View style={s.completeBadge}>
            <Text style={[Typography.bold2, { color:'#fff' }]}>{completedCount}/{missions.length}</Text>
          </View>
        </View>

        {/* 전체 진행바 */}
        <View style={{ marginTop:10 }}>
          <View style={[s.totalProg]}>
            <View style={[s.totalFill, {
              width: missions.length > 0 ? `${Math.round(completedCount/missions.length*100)}%` as any : '0%',
            }]}/>
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:5 }}>
            <Text style={[Typography.label3, { color:'rgba(255,255,255,.75)' }]}>
              {allDone ? ' 전부 완료!' : `${missions.length - completedCount}개 남음`}
            </Text>
            {totalXp > 0 && (
              <Text style={[Typography.bold3, { color:'#fff' }]}>+{totalXp} XP 획득</Text>
            )}
          </View>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding:16, gap:10, paddingBottom:40 }}>

        {/* 전체 완료 배너 */}
        {allDone && (
          <View style={[s.allDoneBanner, ...([Shadow.green] as any)]}>
            <Text style={{ fontSize:36 }}></Text>
            <View style={{ flex:1 }}>
              <Text style={[Typography.bold2, { color:Colors.greenDk }]}>오늘 미션 전부 완료!</Text>
              <Text style={[Typography.label2, { color:Colors.green }]}>
                내일 새로운 미션이 기다려요
              </Text>
            </View>
          </View>
        )}

        {/* 미션 카드 목록 */}
        {loading ? (
          [0,1,2].map(i => (
            <View key={i} style={[s.skeletonCard]}>
              <View style={s.skeletonIcon}/>
              <View style={{ flex:1, gap:6 }}>
                <View style={[s.skeletonLine, { width:'70%' }]}/>
                <View style={[s.skeletonLine, { width:'45%', height:8 }]}/>
              </View>
            </View>
          ))
        ) : (
          missions.map((m, i) => (
            <MissionCard key={m.id} mission={m} index={i} />
          ))
        )}

        {/* 미션 팁 */}
        <View style={s.tipCard}>
          <Text style={[Typography.label2, { color:Colors.brand, marginBottom:6 }]}> 미션 팁</Text>
          <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
            미션은 매일 자정에 초기화돼요.{'\n'}
            학습을 진행하면 자동으로 진행도가 올라가요.{'\n'}
            모든 미션 완료 시 보너스 XP를 드려요!
          </Text>
        </View>

        {/* 학습 시작 CTA */}
        {!allDone && (
          <Pressable
            style={[s.ctaBtn, ...([Shadow.brand] as any)]}
            onPress={() => router.push('/(student)/learn/')}
          >
            <Text style={{ fontSize:20 }}></Text>
            <Text style={[Typography.bold1, { color:'#fff' }]}>학습하러 가기</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:          { flex:1, backgroundColor:Colors.bg },
  header:        { paddingTop:52, paddingHorizontal:18, paddingBottom:18 },
  headerRow:     { flexDirection:'row', alignItems:'center', gap:12, marginBottom:2 },
  backBtn:       { width:30, height:30, borderRadius:9, borderWidth:1, borderColor:'rgba(255,255,255,.3)', alignItems:'center', justifyContent:'center' },
  completeBadge: { backgroundColor:'rgba(255,255,255,.25)', borderRadius:99, paddingHorizontal:13, paddingVertical:5 },
  totalProg:     { height:6, backgroundColor:'rgba(255,255,255,.25)', borderRadius:99, overflow:'hidden' },
  totalFill:     { height:'100%', backgroundColor:'#fff', borderRadius:99 },

  missionCard:   { borderRadius:18, borderWidth:1.5, padding:16 },
  cardTop:       { flexDirection:'row', alignItems:'center', gap:12 },
  iconWrap:      { width:52, height:52, borderRadius:15, alignItems:'center', justifyContent:'center', flexShrink:0 },
  checkCircle:   { width:34, height:34, borderRadius:17, backgroundColor:Colors.green, alignItems:'center', justifyContent:'center', flexShrink:0 },
  xpTag:         { alignItems:'center', flexShrink:0 },
  progTrack:     { height:6, borderRadius:99, overflow:'hidden' },
  progFill:      { height:'100%', borderRadius:99 },

  allDoneBanner: { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:Colors.greenBg, borderRadius:18, borderWidth:2, borderColor:'#86efac', padding:16 },

  skeletonCard:  { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:16 },
  skeletonIcon:  { width:52, height:52, borderRadius:15, backgroundColor:Colors.bg, flexShrink:0 },
  skeletonLine:  { height:12, backgroundColor:Colors.bg, borderRadius:6 },

  tipCard:       { backgroundColor:Colors.brandBg, borderRadius:16, borderWidth:1, borderColor:'#DDD9FF', padding:14 },
  ctaBtn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:Colors.brand, borderRadius:16, paddingVertical:16 },
});
