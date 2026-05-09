// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 — 주간 랭킹 화면
// 같은 학원 반 내 XP 순위 · 리그 시스템
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

type League = 'bronze' | 'silver' | 'gold' | 'platinum';

const LEAGUE_INFO: Record<League, { label:string; emoji:string; color:string; minXp:number }> = {
  bronze:   { label:'브론즈',   emoji:'3위', color:'#CD7F32', minXp:0     },
  silver:   { label:'실버',     emoji:'2위', color:'#C0C0C0', minXp:500   },
  gold:     { label:'골드',     emoji:'1위', color:'#FFD700', minXp:1500  },
  platinum: { label:'플래티넘', emoji:'', color:'#5B50F0', minXp:3000  },
};

function getLeague(xp: number): League {
  if (xp >= 3000) return 'platinum';
  if (xp >= 1500) return 'gold';
  if (xp >= 500)  return 'silver';
  return 'bronze';
}

interface RankRow {
  uid: string; displayName: string; avatar: string;
  xp: number; streak: number; weeklyXp: number; isMe: boolean;
}

export default function RankingScreen() {
  const router = useRouter();
  const { user, xp: myXp } = useAppStore();
  const [rankings, setRankings] = useState<RankRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'weekly'|'total'>('weekly');

  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'users'),
          where('role', '==', 'student'),
          where('academyId', '==', user.academyId),
          limit(30)
        ));

        const list: RankRow[] = [];
        const oneWeekAgo = new Date(Date.now() - 7 * 86400000);

        for (const d of snap.docs) {
          const uid  = d.id;
          const data = d.data();
          // 진도에서 XP 집계
          const pSnap = await getDocs(collection(db, 'users', uid, 'progress'));
          let totalXp = 0, weeklyXp = 0;
          pSnap.docs.forEach(p => {
            const xpVal = p.data().xpEarned ?? 0;
            totalXp += xpVal;
            const ls = p.data().lastStudied?.toDate?.();
            if (ls && ls > oneWeekAgo) weeklyXp += xpVal;
          });
          list.push({
            uid, isMe: uid === user.uid,
            displayName: data.displayName ?? '학생',
            avatar:      data.avatar ?? '🦊',
            xp:          totalXp,
            weeklyXp,
            streak:      data.streak ?? 0,
          });
        }

        list.sort((a,b) => tab==='weekly' ? b.weeklyXp-a.weeklyXp : b.xp-a.xp);
        setRankings(list);
      } catch {
        // 데모 데이터
        setRankings([
          { uid:'1', displayName:'박서윤', avatar:'🐯', xp:2150, weeklyXp:420, streak:21, isMe:false },
          { uid:'2', displayName:'이하은', avatar:'🐰', xp:1980, weeklyXp:380, streak:18, isMe:false },
          { uid:'3', displayName:'김지민', avatar:'🦊', xp:1620, weeklyXp:290, streak:14, isMe:true  },
          { uid:'4', displayName:'최유진', avatar:'🐻', xp:1060, weeklyXp:180, streak:7,  isMe:false },
          { uid:'5', displayName:'정하늘', avatar:'🦁', xp:720,  weeklyXp:90,  streak:1,  isMe:false },
        ]);
      } finally { setLoading(false); }
    })();
  }, [user?.academyId, tab]);

  const myRank   = rankings.findIndex(r => r.isMe) + 1;
  const myLeague = getLeague(myXp);
  const leagueInfo = LEAGUE_INFO[myLeague];

  const top3Colors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:18 }}>←</Text>
        </Pressable>
        <View style={{ flex:1 }}>
          <Text style={[Typography.h3]}>주간 랭킹</Text>
          <Text style={[Typography.label2, { color:Colors.ink3 }]}>같은 학원 반 순위</Text>
        </View>
        {/* 내 리그 배지 */}
        <View style={[s.leagueBadge, { borderColor:leagueInfo.color }]}>
          <Text style={{ fontSize:16 }}>{leagueInfo.emoji}</Text>
          <Text style={[Typography.bold3, { color:leagueInfo.color }]}>{leagueInfo.label}</Text>
        </View>
      </View>

      {/* 내 순위 카드 */}
      {myRank > 0 && (
        <View style={[s.myRankCard, ...([Shadow.brand] as any)]}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            <View style={[s.rankCircle, { backgroundColor:Colors.brand }]}>
              <Text style={[Typography.bold1, { color:'#fff', fontSize:18 }]}>{myRank}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={[Typography.bold2, { color:Colors.white }]}>내 현재 순위</Text>
              <Text style={[Typography.label2, { color:'rgba(255,255,255,.7)' }]}>
                {tab==='weekly' ? '이번 주' : '전체'} {rankings[myRank-1]?.weeklyXp ?? myXp} XP
              </Text>
            </View>
            <View>
              <Text style={[Typography.statSm, { color:'#fff' }]}>#{myRank}</Text>
              <Text style={[Typography.label3, { color:'rgba(255,255,255,.6)' }]}>/{rankings.length}명</Text>
            </View>
          </View>
        </View>
      )}

      {/* 탭 */}
      <View style={s.tabRow}>
        {(['weekly','total'] as const).map(t => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={[s.tabBtn, tab===t && s.tabActive]}>
            <Text style={[Typography.bold3, { color:tab===t ? Colors.brand : Colors.ink3 }]}>
              {t==='weekly' ? '이번 주 ' : '전체 XP ⭐'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={Colors.brand} size="large"/>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom:32 }}>
          {/* TOP 3 포디엄 */}
          {rankings.length >= 3 && (
            <View style={s.podium}>
              {/* 2등 */}
              <View style={[s.podiumItem, { marginTop:28 }]}>
                <Text style={{ fontSize:28 }}>{rankings[1].avatar}</Text>
                <Text style={[Typography.bold3, { color:Colors.ink, marginTop:4 }]} numberOfLines={1}>
                  {rankings[1].displayName}
                </Text>
                <View style={[s.podiumBase, { backgroundColor:'#C0C0C0', height:50 }]}>
                  <Text style={[Typography.bold2, { color:'#fff' }]}>2위</Text>
                </View>
              </View>
              {/* 1등 */}
              <View style={s.podiumItem}>
                <Text style={{ fontSize:8, marginBottom:2 }}></Text>
                <Text style={{ fontSize:34 }}>{rankings[0].avatar}</Text>
                <Text style={[Typography.bold3, { color:Colors.ink, marginTop:4 }]} numberOfLines={1}>
                  {rankings[0].displayName}
                </Text>
                <View style={[s.podiumBase, { backgroundColor:'#FFD700', height:70 }]}>
                  <Text style={[Typography.bold2, { color:'#fff' }]}>1위</Text>
                </View>
              </View>
              {/* 3등 */}
              <View style={[s.podiumItem, { marginTop:44 }]}>
                <Text style={{ fontSize:26 }}>{rankings[2].avatar}</Text>
                <Text style={[Typography.bold3, { color:Colors.ink, marginTop:4 }]} numberOfLines={1}>
                  {rankings[2].displayName}
                </Text>
                <View style={[s.podiumBase, { backgroundColor:'#CD7F32', height:34 }]}>
                  <Text style={[Typography.bold2, { color:'#fff' }]}>3위</Text>
                </View>
              </View>
            </View>
          )}

          {/* 전체 순위 리스트 */}
          <View style={{ paddingHorizontal:16, gap:8 }}>
            {rankings.map((r, i) => {
              const isTop3 = i < 3;
              return (
                <View key={r.uid} style={[
                  s.rankRow,
                  r.isMe && { borderColor:Colors.brand, borderWidth:2, backgroundColor:Colors.brandBg },
                  isTop3 && { borderColor:top3Colors[i]+'60', borderWidth:1.5 },
                  ...([Shadow.card] as any),
                ]}>
                  {/* 순위 */}
                  <View style={[s.rankNum, isTop3 && { backgroundColor:top3Colors[i] }]}>
                    <Text style={[Typography.bold2, { color:isTop3?'#fff':Colors.ink3, fontSize:13 }]}>
                      {isTop3 ? ['1위','2위','3위'][i] : i+1}
                    </Text>
                  </View>
                  {/* 아바타 */}
                  <Text style={{ fontSize:24 }}>{r.avatar}</Text>
                  {/* 이름 */}
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                      <Text style={[Typography.bold3, { color:Colors.ink }]}>{r.displayName}</Text>
                      {r.isMe && (
                        <View style={{ backgroundColor:Colors.brand, borderRadius:99, paddingHorizontal:7, paddingVertical:2 }}>
                          <Text style={[Typography.label3, { color:'#fff' }]}>나</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>{r.streak}일</Text>
                  </View>
                  {/* XP */}
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={[Typography.bold2, { color:isTop3?top3Colors[i]:Colors.brand }]}>
                      {(tab==='weekly'?r.weeklyXp:r.xp).toLocaleString()}
                    </Text>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>XP</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, flexDirection:'row', alignItems:'center', gap:12, borderBottomWidth:0.5, borderBottomColor:Colors.line },
  backBtn:     { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  leagueBadge: { flexDirection:'row', alignItems:'center', gap:5, borderRadius:10, borderWidth:2, paddingHorizontal:11, paddingVertical:6 },
  myRankCard:  { backgroundColor:Colors.brand, margin:16, borderRadius:18, padding:16 },
  rankCircle:  { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  tabRow:      { flexDirection:'row', gap:8, paddingHorizontal:16, marginBottom:14 },
  tabBtn:      { flex:1, paddingVertical:9, borderRadius:11, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white, alignItems:'center' },
  tabActive:   { borderColor:Colors.brand, backgroundColor:Colors.brandBg },
  podium:      { flexDirection:'row', justifyContent:'center', alignItems:'flex-end', paddingHorizontal:20, gap:12, marginBottom:20, marginTop:8 },
  podiumItem:  { flex:1, alignItems:'center' },
  podiumBase:  { width:'100%', borderRadius:12, alignItems:'center', justifyContent:'center', marginTop:6 },
  rankRow:     { flexDirection:'row', alignItems:'center', gap:11, backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:13 },
  rankNum:     { width:32, height:32, borderRadius:9, backgroundColor:Colors.bg, alignItems:'center', justifyContent:'center', flexShrink:0 },
});
