// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  Animated, Platform,
} from 'react-native';
import { useRouter }   from 'expo-router';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db }          from '../../lib/firebase';
import { useAppStore } from '../../stores/useAppStore';
import { useLesson }   from '../../hooks/useLesson';
import { STEP_DEFS, CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI, ContentType } from '../../types/lesson';
import { useWordbook } from '../../hooks/useWordbook';
import { useWrongNote } from '../../hooks/useWrongNote';
import { useFCM }      from '../../hooks/useFCM';
import { useMission }  from '../../hooks/useMission';
import { Colors }      from '../../constants/colors';
import { Flame, Star, BookOpen, ChevronRight, MessageCircle, BookMarked } from 'lucide-react-native';
import { Shadow }      from '../../constants/shadow';
import { Typography }  from '../../constants/typography';

interface FeedItem {
  id:string; title:string; subtitle:string;
  type:'word'|'grammar'|'reading'|'mock';
  xpReward:number; progress:number; done:boolean;
}

// ── 눌림 피드백 래퍼 ─────────────────────────────────────────────
function ScalePressable({ children, style, onPress }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform:[{scale}] }}>
      <Pressable
        style={style}
        onPress={onPress}
        onPressIn={()  => Animated.spring(scale,{toValue:.96,useNativeDriver:true,speed:60}).start()}
        onPressOut={()  => Animated.spring(scale,{toValue:1,  useNativeDriver:true,speed:40}).start()}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function StudentHome() {
  const router = useRouter();
  const { dueWords }                  = useWordbook();
  const { unresolvedCount }           = useWrongNote();
  const { lessons, getPct }           = useLesson();
  const { scheduleWordReviewNotif }   = useFCM();
  const { user, xp, streak, level, selectedCoach } = useAppStore();
  const [feed, setFeed]               = useState<FeedItem[]>([]);
  const { missions, completedCount }  = useMission();
  const dailyMissionXp = missions.filter(m=>m.completed).reduce((a,m)=>a+m.xpReward,0);
  const xpInLevel   = xp % 400;
  const xpPct       = Math.min(100, Math.round(xpInLevel / 400 * 100));
  const reviewBacklog = dueWords.length + unresolvedCount;
  const coachMap    = { betty:'B', lukas:'L', alex:'A' } as const;

  const nextLesson = lessons.find(l => { const p=getPct(l.id,l.stepCount); return p>0&&p<100; })
                  ?? lessons.find(l => getPct(l.id,l.stepCount)===0);

  const typeColor: Record<string,string> = {
    word:Colors.green, grammar:Colors.amber, reading:Colors.brand, mock:Colors.orange,
  };

  useEffect(() => {
    if (dueWords.length > 0) scheduleWordReviewNotif(dueWords.length, 19);
  }, [dueWords.length]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,'users',user.uid,'feed'), orderBy('createdAt','desc'), limit(5));
    return onSnapshot(q, snap => setFeed(snap.docs.map(d=>({id:d.id,...d.data()}as FeedItem))));
  }, [user]);

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom:36 }} showsVerticalScrollIndicator={false}>

      {/* ── 그라데이션 헤더 ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={[Typography.label2,{color:'rgba(255,255,255,.65)',marginBottom:2}]}>
              안녕하세요, {user?.displayName ?? '학생'}님 
            </Text>
            <Text style={[Typography.h2,{color:'#fff',letterSpacing:-.8}]}>
              오늘도 화이팅!
            </Text>
          </View>
          <View style={s.levelBadge}>
            <Text style={[Typography.bold3,{color:'#fff',fontSize:11}]}>Lv.{level}</Text>
          </View>
        </View>

        {/* 스탯 칩 */}
        <View style={{flexDirection:'row',gap:7,marginTop:10}}>
          {[
            {Icon:Flame,  val:`${streak}일`,           lbl:'연속', onPress:null},
            {Icon:Star,   val:`${xp.toLocaleString()}`, lbl:'XP', onPress:null},
            {Icon:BookMarked,val:`${reviewBacklog}`,  lbl:'복습대기', onPress:()=>router.push('/(student)/review-center' as any)},
          ].map((st,i)=>(
            <Pressable key={i} style={s.statChip} onPress={st.onPress ?? undefined} disabled={!st.onPress}>
              <st.Icon size={13} color="rgba(255,255,255,.8)" strokeWidth={2}/>
              <View>
                <Text style={[Typography.bold3,{color:'#fff',fontSize:12}]}>{st.val}</Text>
                <Text style={[Typography.label3,{color:'rgba(255,255,255,.6)'}]}>{st.lbl}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* XP 진행바 */}
        <View style={{marginTop:12}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:5}}>
            <Text style={[Typography.label3,{color:'rgba(255,255,255,.65)'}]}>다음 레벨까지</Text>
            <Text style={[Typography.bold3,{color:'#fff',fontSize:11}]}>{xpInLevel}/400 XP</Text>
          </View>
          <View style={s.xpTrack}>
            <View style={[s.xpFill,{width:`${xpPct}%` as any}]}/>
          </View>
        </View>
      </View>

      <View style={{paddingHorizontal:16,paddingTop:14}}>

        {/* ── 다음 학습 추천 카드 ── */}
        {nextLesson && (
          <ScalePressable
            style={[s.nextCard, Shadow.brand as any]}
            onPress={()=>router.push({pathname:'/(student)/learn/[lessonId]',params:{lessonId:nextLesson.id,type:nextLesson.type,title:nextLesson.title}})}
          >
            <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8}}>
              <View style={{width:6,height:6,borderRadius:3,backgroundColor:Colors.green}}/>
              <Text style={[Typography.label3,{color:Colors.green,fontWeight:'700',letterSpacing:.5}]}>지금 이어서</Text>
            </View>
            <View style={{flexDirection:'row',alignItems:'center',gap:11,marginBottom:12}}>
              <View style={{width:40,height:40,borderRadius:12,backgroundColor:Colors.brand+'18',alignItems:'center',justifyContent:'center'}}><BookOpen size={20} color={Colors.brand} strokeWidth={1.8}/></View>
              <View style={{flex:1}}>
                <Text style={[Typography.bold2,{color:Colors.ink,marginBottom:2}]} numberOfLines={1}>
                  {nextLesson.title}
                </Text>
                <Text style={[Typography.label2,{color:Colors.ink3}]}>
                  {nextLesson.type==='word'?`단어 ${nextLesson.wordCount}개`:`${STEP_DEFS[nextLesson.type as ContentType]?.length}단계`}
                </Text>
              </View>
              <View style={{backgroundColor:Colors.greenBg,borderRadius:99,paddingHorizontal:10,paddingVertical:4}}>
                <Text style={[Typography.bold3,{color:Colors.greenDk}]}>
                  +{STEP_DEFS[nextLesson.type as ContentType]?.reduce((a,b)=>a+b.xp,0)} XP
                </Text>
              </View>
            </View>
            {/* 진행바 */}
            <View style={{height:6,backgroundColor:Colors.line,borderRadius:99,overflow:'hidden',marginBottom:5}}>
              <View style={{height:'100%',width:`${getPct(nextLesson.id,nextLesson.stepCount)}%` as any,backgroundColor:Colors.brand,borderRadius:99}}/>
            </View>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={[Typography.label3,{color:Colors.ink3}]}>{getPct(nextLesson.id,nextLesson.stepCount)}% 완료</Text>
              <Text style={[Typography.bold3,{color:Colors.brand}]}>계속 학습 →</Text>
            </View>
          </ScalePressable>
        )}

        {/* ── AI 코치 버디 ── */}
        <ScalePressable
          style={[s.coachCard, Shadow.card as any]}
          onPress={()=>router.push('/(student)/coach')}
        >
          <View style={s.coachLeft}>
            <View style={s.coachAva}>
              <Text style={{fontSize:26}}>{coachMap[selectedCoach]}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={[Typography.label2,{color:Colors.brand,marginBottom:3,fontWeight:'700'}]}>AI 코치</Text>
              <Text style={[Typography.body3,{color:Colors.ink,lineHeight:18}]}>
                오늘 3과 단어가 약해 보여! 같이 복습해볼까? 
              </Text>
            </View>
          </View>
          <View style={s.coachArrow}><ChevronRight size={16} color={Colors.brand} strokeWidth={2}/></View>
        </ScalePressable>

        {/* ── SM-2 복습 배너 ── */}
        {dueWords.length > 0 && (
          <ScalePressable
            style={[s.reviewBanner, Shadow.card as any]}
            onPress={()=>router.push('/(student)/review-center' as any)}
          >
            <View style={s.reviewIco}>
              <Text style={{fontSize:20}}></Text>
            </View>
            <View style={{flex:1}}>
              <Text style={[Typography.bold2,{color:'#fff',marginBottom:2}]}>
                오늘 복습할 단어 {dueWords.length}개
              </Text>
              <Text style={[Typography.label2,{color:'rgba(255,255,255,.7)'}]}>
                SM-2 알고리즘 · 지금 복습하면 기억력 +40%
              </Text>
            </View>
            <ChevronRight size={18} color='rgba(255,255,255,.8)' strokeWidth={2}/>
          </ScalePressable>
        )}

        {/* ── 일일 미션 배너 ── */}
        {missions.length > 0 && (
          <Pressable
            style={[s.missionBanner, completedCount===missions.length && { backgroundColor:Colors.green }]}
            onPress={() => router.push('/(student)/missions' as any)}
          >
            <View style={{ flex:1 }}>
              <Text style={[Typography.bold2, { color:'#fff', marginBottom:2 }]}>
                 오늘의 미션 {completedCount}/{missions.length}
              </Text>
              <View style={{ height:4, backgroundColor:'rgba(255,255,255,.25)', borderRadius:99, overflow:'hidden' }}>
                <View style={{ height:'100%', width:`${Math.round(completedCount/Math.max(missions.length,1)*100)}%` as any, backgroundColor:'#fff', borderRadius:99 }}/>
              </View>
            </View>
            {dailyMissionXp > 0 && (
              <View style={{ backgroundColor:'rgba(255,255,255,.2)', borderRadius:99, paddingHorizontal:10, paddingVertical:4, marginLeft:10 }}>
                <Text style={[Typography.bold3, { color:'#fff' }]}>+{dailyMissionXp} XP</Text>
              </View>
            )}
          </Pressable>
        )}

        {/* ── 랭킹 진입점 ── */}
        <Pressable
          style={[s.rankingCard]}
          onPress={() => router.push('/(student)/ranking' as any)}
        >
          <Text style={{ fontSize:20 }}></Text>
          <View style={{ flex:1 }}>
            <Text style={[Typography.bold3, { color:Colors.ink }]}>주간 랭킹</Text>
            <Text style={[Typography.label2, { color:Colors.ink3 }]}>같은 반 순위 확인하기</Text>
          </View>
          <Text style={[Typography.bold2, { color:Colors.amber }]}>→</Text>
        </Pressable>

        {/* ── 오늘 할 일 ── */}
        <View style={s.sectionRow}>
          <Text style={[Typography.h4]}>오늘 할 일</Text>
          <Pressable onPress={()=>router.push('/(student)/learn/')}>
            <View style={{flexDirection:'row',alignItems:'center',gap:2}}><Text style={[Typography.label2,{color:Colors.brand}]}>전체</Text><ChevronRight size={13} color={Colors.brand} strokeWidth={2}/></View>
          </Pressable>
        </View>

        {feed.length === 0 ? (
          nextLesson ? (
            <ScalePressable
              style={[s.emptyCard, Shadow.card as any]}
              onPress={()=>router.push({pathname:'/(student)/learn/[lessonId]',params:{lessonId:nextLesson.id,type:nextLesson.type,title:nextLesson.title}})}
            >
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <Text style={{fontSize:28}}>{CONTENT_TYPE_EMOJI[nextLesson.type as ContentType]}</Text>
                <View style={{flex:1}}>
                  <Text style={[Typography.label2,{color:Colors.brand,marginBottom:2}]}>
                    {getPct(nextLesson.id,nextLesson.stepCount)>0?'계속 학습하기':'지금 시작하기'}
                  </Text>
                  <Text style={[Typography.bold3,{color:Colors.ink}]} numberOfLines={1}>{nextLesson.title}</Text>
                </View>
                <ChevronRight size={18} color={Colors.brand} strokeWidth={2}/>
              </View>
            </ScalePressable>
          ) : (
            <View style={[s.emptyCard, Shadow.card as any]}>
              <Text style={{fontSize:36,textAlign:'center',marginBottom:10}}></Text>
              <Text style={[Typography.bold2,{color:Colors.ink,textAlign:'center',marginBottom:6}]}>오늘 할 일이 없어요</Text>
              <Text style={[Typography.body3,{color:Colors.ink3,textAlign:'center',lineHeight:20,marginBottom:14}]}>
                선생님이 자료를 등록하면{'\n'}여기에 학습 과제가 나타나요
              </Text>
              <Pressable
                onPress={()=>router.push('/(student)/learn/')}
                style={{backgroundColor:Colors.brand,borderRadius:12,paddingHorizontal:24,paddingVertical:12,alignSelf:'center',...(Shadow.brand as any)}}
              >
                <Text style={[Typography.bold2,{color:'#fff'}]}>자료 목록 보기 →</Text>
              </Pressable>
            </View>
          )
        ) : (
          feed.map(item=>(
            <ScalePressable
              key={item.id}
              style={[s.taskCard, Shadow.card as any]}
              onPress={()=>router.push(`/(student)/learn?type=${item.type}` as any)}
            >
              <View style={[s.taskIcon,{backgroundColor:typeColor[item.type]+'18'}]}>
                <BookOpen size={18} color={typeColor[item.type]} strokeWidth={1.8}/>
              </View>
              <View style={{flex:1}}>
                <Text style={[Typography.bold3,{color:item.done?Colors.ink3:Colors.ink,textDecorationLine:item.done?'line-through':'none'}]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[Typography.label2,{color:Colors.ink3,marginTop:2}]}>{item.subtitle}</Text>
                {!item.done && item.progress>0 && (
                  <View style={{height:3,backgroundColor:Colors.line,borderRadius:99,overflow:'hidden',marginTop:6}}>
                    <View style={{height:'100%',width:`${item.progress}%` as any,backgroundColor:typeColor[item.type],borderRadius:99}}/>
                  </View>
                )}
              </View>
              {item.done
                ? <View style={s.doneBadge}><Text style={{color:Colors.green,fontSize:14,fontWeight:'800'}}>V</Text></View>
                : <View style={{backgroundColor:Colors.greenBg,borderRadius:99,paddingHorizontal:8,paddingVertical:3,borderWidth:1,borderColor:'#86efac'}}>
                    <Text style={[Typography.label3,{color:Colors.greenDk,fontWeight:'700'}]}>+{item.xpReward}</Text>
                  </View>
              }
            </ScalePressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },

  // 헤더 — 그라데이션
  header:      { backgroundColor:Colors.brand, paddingTop:52, paddingHorizontal:18, paddingBottom:20 },
  headerTop:   { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  levelBadge:  { backgroundColor:'rgba(255,255,255,.2)', borderRadius:99, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,.3)' },
  statChip:    { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(255,255,255,.15)', borderRadius:99, paddingHorizontal:12, paddingVertical:6 },
  xpTrack:     { height:6, backgroundColor:'rgba(255,255,255,.25)', borderRadius:99, overflow:'hidden' },
  xpFill:      { height:'100%', backgroundColor:'#fff', borderRadius:99 },

  // 다음 학습 카드
  nextCard:    { backgroundColor:Colors.white, borderRadius:20, borderWidth:2, borderColor:Colors.brand, padding:16, marginBottom:12 },

  // AI 코치
  coachCard:   { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:14, marginBottom:10, flexDirection:'row', alignItems:'center' },
  coachLeft:   { flexDirection:'row', alignItems:'center', gap:12, flex:1 },
  coachAva:    { width:46, height:46, borderRadius:14, backgroundColor:Colors.brandBg, alignItems:'center', justifyContent:'center' },
  coachArrow:  { width:32, height:32, borderRadius:10, backgroundColor:Colors.brandBg, alignItems:'center', justifyContent:'center' },

  // 복습 배너
  reviewBanner:{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.ink, borderRadius:18, padding:14, marginBottom:10 },
  reviewIco:   { width:40, height:40, borderRadius:12, backgroundColor:'rgba(255,255,255,.1)', alignItems:'center', justifyContent:'center' },

  // 섹션
  sectionRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:6, marginBottom:10 },

  // 할 일 카드
  taskCard:    { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.white, borderRadius:16, padding:14, marginBottom:9 },
  taskIcon:    { width:44, height:44, borderRadius:13, alignItems:'center', justifyContent:'center', flexShrink:0 },
  doneBadge:   { width:28, height:28, borderRadius:14, backgroundColor:Colors.greenBg, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#86efac' },
  emptyCard:    { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:20, marginBottom:10, alignItems:'center' },
  missionBanner:{ flexDirection:'row', alignItems:'center', backgroundColor:Colors.amber, borderRadius:16, padding:14, marginBottom:10 },
  rankingCard:  { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:13, marginBottom:12 },
});
