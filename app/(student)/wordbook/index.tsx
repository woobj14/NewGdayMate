// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 (Product & Design) 소유 파일
// 원칙: 디자인 시스템 · 모바일 퍼스트 · 온보딩 전환율 · 동기 부여 UI · 컴포넌트 재사용
// 수정 전 CLAUDE.md 확인 필수 | 색상/폰트 하드코딩 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useWordbook, WordbookEntry } from '../../../hooks/useWordbook';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type TabKey = 'due' | 'all' | 'mastered';

const STATUS_STYLE: Record<WordbookEntry['status'], { bg: string; text: string }> = {
  '모름':   { bg: Colors.redBg,   text: Colors.redDk },
  '햇갈림': { bg: Colors.amberBg, text: Colors.amberDk },
  '외움':   { bg: Colors.greenBg, text: Colors.greenDk },
};

export default function WordbookScreen() {
  const router  = useRouter();
  const { words, loading, dueWords, masteredWords, removeWord } = useWordbook();
  const [tab, setTab] = useState<TabKey>('due');

  const allWords   = words;
  const dueCnt     = dueWords.length;
  const masteredCnt= masteredWords.length;

  const listData =
    tab === 'due'      ? allWords.filter(w => w.status !== '외움') :
    tab === 'mastered' ? allWords.filter(w => w.status === '외움') :
    allWords;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key:'due',      label:'복습 필요',  count:dueCnt     },
    { key:'all',      label:'전체',       count:allWords.length },
    { key:'mastered', label:'외운 단어',  count:masteredCnt },
  ];

  return (
    <View style={s.wrap}>
      {/* 헤더 */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <Text style={{ fontSize:18, color:'#fff' }}>←</Text>
            </Pressable>
            <View>
              <Text style={[Typography.label2, { color:'rgba(255,255,255,0.68)', marginBottom:3 }]}>나만의</Text>
              <Text style={[Typography.h2, { color:'#fff' }]}>단어장</Text>
            </View>
          </View>
          <Pressable
            style={[s.startBtn, dueCnt === 0 && { opacity:0.4 }]}
            onPress={() => dueCnt > 0 && router.push('/(student)/wordbook/review')}
            disabled={dueCnt === 0}
          >
            <Text style={{ fontSize:16 }}>▶</Text>
            <Text style={[Typography.bold3, { color:'#fff' }]}>복습 시작</Text>
          </Pressable>
        </View>

        {/* 통계 스트립 */}
        <View style={s.statsRow}>
          {[
            { val:allWords.length, lbl:'전체 단어',  color:Colors.ink   },
            { val:dueCnt,          lbl:'복습 필요',  color:Colors.orange },
            { val:masteredCnt,     lbl:'완전 암기',  color:Colors.green  },
          ].map((st,i) => (
            <View key={i} style={[s.statCell, i<2 && { borderRightWidth:0.5, borderRightColor:'rgba(255,255,255,0.2)' }]}>
              <Text style={[Typography.statSm, { color:st.color === Colors.ink ? '#fff' : st.color }]}>{st.val}</Text>
              <Text style={[Typography.label2, { color:'rgba(255,255,255,0.65)', marginTop:2 }]}>{st.lbl}</Text>
            </View>
          ))}
        </View>

        {/* 탭 */}
        <View style={s.tabs}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)}
              style={[s.tabBtn, tab===t.key && { backgroundColor:'rgba(255,255,255,0.15)' }]}>
              <Text style={[Typography.bold3, { color: tab===t.key ? '#fff' : 'rgba(255,255,255,0.55)' }]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={s.cntBadge}>
                  <Text style={[Typography.label3, { color:Colors.ink }]}>{t.count}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={Colors.brand} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={w => w.id}
          contentContainerStyle={{ padding:16, gap:10 }}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={{ fontSize:40, marginBottom:12 }}></Text>
              <Text style={[Typography.bold2, { color:Colors.ink, marginBottom:6 }]}>
                {tab === 'mastered' ? '아직 완전히 외운 단어가 없어요' : '단어장이 비어 있어요'}
              </Text>
              <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', lineHeight:20 }]}>
                {tab === 'mastered'
                  ? '단어를 복습해서 외움 상태로 만들어보세요!'
                  : '단어 퀴즈 중 모르는 단어를\n단어장에 추가해보세요'}
              </Text>
            </View>
          }
          renderItem={({ item:w }) => {
            const ss = STATUS_STYLE[w.status];
            return (
              <View style={s.wordCard}>
                <View style={s.cardLeft}>
                  <View style={s.wordTop}>
                    <Text style={[Typography.bold1, { color:Colors.ink, letterSpacing:-0.5 }]}>{w.word}</Text>
                    <View style={[s.statusPill, { backgroundColor:ss.bg }]}>
                      <Text style={[Typography.label3, { color:ss.text }]}>{w.status}</Text>
                    </View>
                  </View>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:4 }]}>
                    {w.phonetic}  {w.pos}
                  </Text>
                  <Text style={[Typography.bold3, { color:Colors.ink }]}>{w.ko}</Text>
                  <Text style={[Typography.label2, { color:Colors.ink3, marginTop:3 }]} numberOfLines={1}>
                    {w.def}
                  </Text>
                  {w.syn && (
                    <Text style={[Typography.label2, { color:Colors.brand, marginTop:2 }]}>syn. {w.syn}</Text>
                  )}
                  <View style={s.metaRow}>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>{w.unitId || '3과'}</Text>
                    <Text style={[Typography.label3, { color:Colors.ink3 }]}>
                      {w.interval > 1 ? `${w.interval}일 후 복습` : '오늘 복습'}
                    </Text>
                  </View>
                </View>
                <Pressable style={s.removeBtn} onPress={() => removeWord(w.id)}>
                  <Text style={{ fontSize:14, color:Colors.ink3 }}>X</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  header:     { backgroundColor:Colors.brand, paddingTop:52, paddingBottom:0 },
  headerTop:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', paddingHorizontal:18, paddingBottom:16 },
  backBtn:    { width:34, height:34, borderRadius:11, borderWidth:1, borderColor:'rgba(255,255,255,0.25)', alignItems:'center', justifyContent:'center' },
  startBtn:   { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:13, paddingHorizontal:15, paddingVertical:10, borderWidth:1, borderColor:'rgba(255,255,255,0.3)' },
  statsRow:   { flexDirection:'row', borderTopWidth:0.5, borderTopColor:'rgba(255,255,255,0.15)', borderBottomWidth:0.5, borderBottomColor:'rgba(255,255,255,0.15)' },
  statCell:   { flex:1, paddingVertical:12, alignItems:'center' },
  tabs:       { flexDirection:'row', paddingHorizontal:14, paddingTop:12, paddingBottom:0, gap:4 },
  tabBtn:     { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:13, paddingVertical:8, borderRadius:10 },
  cntBadge:   { backgroundColor:'rgba(255,255,255,0.9)', borderRadius:99, paddingHorizontal:7, paddingVertical:1 },
  wordCard:   { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:15, flexDirection:'row', alignItems:'flex-start', gap:10 },
  cardLeft:   { flex:1 },
  wordTop:    { flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  statusPill: { paddingHorizontal:9, paddingVertical:3, borderRadius:99 },
  metaRow:    { flexDirection:'row', justifyContent:'space-between', marginTop:8 },
  removeBtn:  { width:28, height:28, borderRadius:8, backgroundColor:Colors.bg, alignItems:'center', justifyContent:'center', marginTop:2 },
  emptyWrap:  { alignItems:'center', paddingTop:60 },
});
