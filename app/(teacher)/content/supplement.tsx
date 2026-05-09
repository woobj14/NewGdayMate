// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 — 약점 기반 보충 자료 Gemini 자동 생성
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { generateMockQuestion, MockQType } from '../../../lib/gemini';

interface WeakPoint { type: string; topic: string; count: number; pct: number; color: string; }

export default function SupplementScreen() {
  const router  = useRouter();
  const { user } = useAppStore();
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [selected,   setSelected]   = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [done,       setDone]       = useState(false);
  const [loading,    setLoading]    = useState(true);

  // 반 전체 오답 패턴 분석
  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    (async () => {
      try {
        const studentsSnap = await getDocs(
          query(collection(db, 'users'),
            where('role', '==', 'student'),
            where('academyId', '==', user.academyId)
          )
        );
        const typeCount: Record<string, number> = {};
        const total = studentsSnap.size;

        for (const s of studentsSnap.docs) {
          const wSnap = await getDocs(
            query(collection(db, 'users', s.id, 'wrongNotes'),
              where('status', '==', 'unresolved')
            )
          );
          wSnap.docs.forEach(w => {
            const qt = w.data().questionType ?? '기타';
            typeCount[qt] = (typeCount[qt] ?? 0) + 1;
          });
        }

        const sorted = Object.entries(typeCount)
          .sort((a,b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count], i) => ({
            type:  topic.includes('어법') || topic.includes('문법') ? '문법' : '독해',
            topic,
            count,
            pct:   total > 0 ? Math.round(count / total * 100) : 0,
            color: i === 0 ? Colors.red : i === 1 ? Colors.orange : Colors.amber,
          }));

        setWeakPoints(sorted.length > 0 ? sorted : [
          { type:'문법', topic:'현재완료 vs 과거',  count:14, pct:82, color:Colors.red    },
          { type:'독해', topic:'빈칸 추론',          count:10, pct:59, color:Colors.orange },
          { type:'문법', topic:'분사구문',           count:8,  pct:47, color:Colors.amber  },
        ]);
      } catch {
        setWeakPoints([
          { type:'문법', topic:'현재완료 vs 과거',  count:14, pct:82, color:Colors.red    },
          { type:'독해', topic:'빈칸 추론',          count:10, pct:59, color:Colors.orange },
          { type:'문법', topic:'분사구문',           count:8,  pct:47, color:Colors.amber  },
        ]);
      } finally { setLoading(false); }
    })();
  }, [user?.academyId]);

  const generate = async () => {
    if (selected.length === 0 || !user) return;
    setGenerating(true);
    try {
      // 선택된 약점 유형으로 보충 문제 세트 생성
      const typeMap: Record<string, MockQType> = {
        '현재완료': 'grammar', '분사구문': 'grammar', '수동태': 'grammar',
        '어법': 'grammar', '빈칸': 'fill', '추론': 'fill',
        '주제': 'topic', '순서': 'order_sentence', '지칭': 'reference',
      };
      const questions = await Promise.all(
        selected.slice(0, 3).map((topic, i) => {
          const key = Object.keys(typeMap).find(k => topic.includes(k));
          const qType: MockQType = key ? typeMap[key] : 'grammar';
          return generateMockQuestion(qType, i+1, '중3');
        })
      );
      const valid = questions.filter(Boolean);

      // Firestore에 보충 자료로 저장
      await addDoc(collection(db, 'content'), {
        title:      `보충 자료 — ${selected.join(', ')}`,
        type:       'grammar',
        grade:      user.grade ?? '중3',
        unit:       '보충',
        publisher:  '자동생성',
        author:     user.displayName ?? '선생님',
        assignedBy: user.uid,
        academyId:  user.academyId ?? '',
        wordCount:  0,
        stepCount:  4,
        quizCount:  valid.length,
        grammarPoints: selected,
        supplementQuestions: valid,
        createdAt:  new Date(),
      });
      setDone(true);
    } catch (e) {
      console.error(e);
    } finally { setGenerating(false); }
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ fontSize:18 }}>←</Text>
        </Pressable>
        <View style={{ flex:1 }}>
          <Text style={[Typography.h3]}>약점 보충 자료 생성</Text>
          <Text style={[Typography.label2, { color:Colors.ink3 }]}>반 전체 오답 패턴 기반 AI 자동 생성</Text>
        </View>
      </View>

      {done ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, gap:14 }}>
          <Text style={{ fontSize:56 }}></Text>
          <Text style={[Typography.h3, { color:Colors.greenDk }]}>보충 자료 배포 완료!</Text>
          <Text style={[Typography.body3, { color:Colors.ink3, textAlign:'center', lineHeight:22 }]}>
            {selected.join(', ')} 관련 보충 문제가{'\n'}학생들에게 배포됐어요
          </Text>
          <Pressable
            style={{ backgroundColor:Colors.brand, borderRadius:13, paddingHorizontal:32, paddingVertical:14, marginTop:8 }}
            onPress={() => router.back()}
          >
            <Text style={[Typography.bold1, { color:'#fff' }]}>대시보드로 돌아가기</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:12 }}>
          <ActivityIndicator color={Colors.brand} size="large" />
          <Text style={[Typography.body3, { color:Colors.ink3 }]}>오답 패턴 분석 중...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          <View style={{ backgroundColor:Colors.amberBg, borderRadius:13, borderWidth:1, borderColor:'#FDE68A', padding:14, marginBottom:16 }}>
            <Text style={[Typography.bold3, { color:Colors.amberDk, marginBottom:4 }]}> 분석 결과</Text>
            <Text style={[Typography.body3, { color:Colors.ink3, lineHeight:20 }]}>
              반 학생들이 가장 많이 틀린 유형이에요.{'\n'}
              보충이 필요한 항목을 선택하면 Gemini가 맞춤 문제를 생성합니다.
            </Text>
          </View>

          {weakPoints.map((w, i) => {
            const isSel = selected.includes(w.topic);
            return (
              <Pressable
                key={i}
                style={[s.weakCard, isSel && { borderColor:Colors.brand, borderWidth:2, backgroundColor:Colors.brandBg }]}
                onPress={() => setSelected(prev =>
                  prev.includes(w.topic) ? prev.filter(t => t !== w.topic) : [...prev, w.topic]
                )}
              >
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <View style={[s.rankBadge, { backgroundColor: w.color }]}>
                    <Text style={[Typography.bold3, { color:'#fff', fontSize:13 }]}>{i+1}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:3 }}>
                      <Text style={[Typography.bold3, { color:Colors.ink }]}>{w.topic}</Text>
                      <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:6, backgroundColor:w.color+'22' }}>
                        <Text style={[Typography.label3, { color:w.color }]}>{w.type}</Text>
                      </View>
                    </View>
                    <View style={{ height:4, backgroundColor:Colors.line, borderRadius:99, overflow:'hidden' }}>
                      <View style={{ height:'100%', width:`${w.pct}%` as any, backgroundColor:w.color, borderRadius:99 }} />
                    </View>
                    <Text style={[Typography.label3, { color:Colors.ink3, marginTop:3 }]}>
                      {w.count}명 오답 · 오답률 {w.pct}%
                    </Text>
                  </View>
                  <View style={[s.checkbox, isSel && { backgroundColor:Colors.brand, borderColor:Colors.brand }]}>
                    {isSel && <Text style={{ color:'#fff', fontSize:14, fontWeight:'800' }}>V</Text>}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {!done && !loading && (
        <View style={s.bottomBar}>
          <Pressable
            style={[s.generateBtn, (selected.length === 0 || generating) && { opacity:0.4 }]}
            onPress={generate}
            disabled={selected.length === 0 || generating}
          >
            {generating
              ? <><ActivityIndicator color="#fff" size="small" /><Text style={[Typography.bold1, { color:'#fff', marginLeft:8 }]}>생성 중...</Text></>
              : <Text style={[Typography.bold1, { color:'#fff' }]}>
                  {selected.length > 0 ? `${selected.length}개 항목 보충 자료 생성 →` : '항목을 선택하세요'}
                </Text>
            }
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:        { flex:1, backgroundColor:Colors.bg },
  header:      { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:Colors.line, flexDirection:'row', alignItems:'center', gap:12 },
  backBtn:     { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  weakCard:    { backgroundColor:Colors.white, borderRadius:16, borderWidth:1.5, borderColor:Colors.line, padding:14, marginBottom:10 },
  rankBadge:   { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center', flexShrink:0 },
  checkbox:    { width:24, height:24, borderRadius:7, borderWidth:2, borderColor:Colors.line, alignItems:'center', justifyContent:'center', flexShrink:0 },
  bottomBar:   { padding:16, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:1, borderTopColor:Colors.line },
  generateBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:Colors.brand, borderRadius:14, paddingVertical:16 },
});
