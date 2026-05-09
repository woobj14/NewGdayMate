// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 — 커리큘럼 빌더
// 단원 단위로 4개 트랙을 묶어 한 번에 배포
// Firestore: academies/{id}/curricula/{curriculumId}
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, addDoc, getDocs, query,
  where, orderBy, doc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppStore } from '../../../stores/useAppStore';
import {
  ContentType, CONTENT_TYPE_LABEL,
  CONTENT_TYPE_COLOR, CONTENT_TYPE_EMOJI,
} from '../../../types/lesson';
import { Colors } from '../../../constants/colors';
import { Shadow } from '../../../constants/shadow';
import { Typography } from '../../../constants/typography';

interface ContentItem { id:string; title:string; type:ContentType; unit:string; grade:string; }
interface CurriculumSlot { type:ContentType; contentId:string|null; contentTitle:string; }
interface Curriculum {
  id:        string;
  title:     string;
  grade:     string;
  unit:      string;
  slots:     CurriculumSlot[];
  status:    'draft'|'published';
  createdAt: any;
}

const TRACK_ORDER: ContentType[] = ['word','dialog','reading','grammar'];
const TRACK_LABELS: Record<ContentType,string> = { word:'단어', dialog:'대화문', reading:'본문', grammar:'문법' };

// ── 슬롯 카드 ────────────────────────────────────────────────
function SlotCard({
  slot, availableContents, onSelect,
}: {
  slot: CurriculumSlot;
  availableContents: ContentItem[];
  onSelect: (type:ContentType, id:string, title:string) => void;
}) {
  const [open, setOpen] = useState(false);
  const color   = CONTENT_TYPE_COLOR[slot.type];
  const emoji   = CONTENT_TYPE_EMOJI[slot.type];
  const options = availableContents.filter(c => c.type === slot.type);
  const isSet   = !!slot.contentId;

  return (
    <View style={[ss.slotCard, { borderLeftColor:color, borderLeftWidth:4 }, ...[Shadow.card as any]]}>
      <Pressable style={ss.slotTop} onPress={() => setOpen(o => !o)}>
        <View style={[ss.slotIcon, { backgroundColor:color+'18' }]}>
          <Text style={{ fontSize:22 }}>{emoji}</Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={[Typography.bold3, { color }]}>{TRACK_LABELS[slot.type]}</Text>
          {isSet ? (
            <Text style={[Typography.label2, { color:Colors.ink }]} numberOfLines={1}>
              {slot.contentTitle}
            </Text>
          ) : (
            <Text style={[Typography.label2, { color:Colors.ink3 }]}>
              자료를 선택하세요 →
            </Text>
          )}
        </View>
        <View style={[ss.statusDot, { backgroundColor: isSet ? Colors.green : Colors.line }]}/>
        <Text style={{ color:Colors.ink3, fontSize:14 }}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View style={ss.dropdown}>
          {options.length === 0 ? (
            <Text style={[Typography.label2, { color:Colors.ink3, padding:12, textAlign:'center' }]}>
              등록된 {TRACK_LABELS[slot.type]} 자료가 없어요
            </Text>
          ) : options.map(opt => (
            <Pressable
              key={opt.id}
              style={[ss.dropItem, slot.contentId===opt.id && { backgroundColor:color+'10' }]}
              onPress={() => { onSelect(slot.type, opt.id, opt.title); setOpen(false); }}
            >
              <Text style={[Typography.body3, { color: slot.contentId===opt.id ? color : Colors.ink }]}>
                {opt.title}
              </Text>
              {slot.contentId===opt.id && (
                <Text style={{ color, fontWeight:'800' }}>V</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CurriculumScreen() {
  const router = useRouter();
  const { user } = useAppStore();

  // 화면 모드
  const [view,       setView]       = useState<'list'|'create'>('list');
  const [curricula,  setCurricula]  = useState<Curriculum[]>([]);
  const [contents,   setContents]   = useState<ContentItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [deploying,  setDeploying]  = useState<string|null>(null);

  // 신규 커리큘럼 상태
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState('중3');
  const [newUnit,  setNewUnit]  = useState('3과');
  const [slots,    setSlots]    = useState<CurriculumSlot[]>(
    TRACK_ORDER.map(t => ({ type:t, contentId:null, contentTitle:'' }))
  );

  const GRADES = ['중1','중2','중3','고1','고2'];
  const UNITS  = Array.from({length:8},(_,i)=>`${i+1}과`);

  useEffect(() => {
    if (!user?.academyId) { setLoading(false); return; }
    (async () => {
      try {
        // 커리큘럼 목록
        const cSnap = await getDocs(query(
          collection(db, 'curricula'),
          where('academyId','==',user.academyId),
          orderBy('createdAt','desc'),
        ));
        setCurricula(cSnap.docs.map(d=>({ id:d.id, ...d.data() })) as Curriculum[]);

        // 등록된 자료 목록
        const contentSnap = await getDocs(query(
          collection(db,'content'),
          where('academyId','==',user.academyId),
        ));
        setContents(contentSnap.docs.map(d=>({
          id:d.id, title:d.data().title, type:d.data().type,
          unit:d.data().unit, grade:d.data().grade,
        })) as ContentItem[]);
      } catch {
        // 데모
        setContents([
          { id:'d1', title:'천재교육 중3 3과 대화문', type:'dialog',  unit:'3과', grade:'중3' },
          { id:'d2', title:'천재교육 중3 3과 본문',   type:'reading', unit:'3과', grade:'중3' },
          { id:'d3', title:'천재교육 중3 3과 단어',   type:'word',    unit:'3과', grade:'중3' },
          { id:'d4', title:'천재교육 중3 3과 문법',   type:'grammar', unit:'3과', grade:'중3' },
        ]);
      } finally { setLoading(false); }
    })();
  }, [user?.academyId]);

  const handleSlotSelect = (type:ContentType, id:string, title:string) => {
    setSlots(prev => prev.map(s => s.type===type ? {...s,contentId:id,contentTitle:title} : s));
  };

  const saveCurriculum = async () => {
    if (!newTitle.trim() || !user) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db,'curricula'), {
        title:     newTitle.trim(),
        grade:     newGrade,
        unit:      newUnit,
        slots,
        status:    'draft',
        academyId: user.academyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setCurricula(prev => [{
        id:docRef.id, title:newTitle.trim(), grade:newGrade, unit:newUnit,
        slots, status:'draft', createdAt:new Date(),
      }, ...prev]);
      setView('list');
      setNewTitle(''); setSlots(TRACK_ORDER.map(t=>({type:t,contentId:null,contentTitle:''})));
    } catch { Alert.alert('오류','저장 실패'); }
    finally { setSaving(false); }
  };

  // 커리큘럼 배포 — 연결된 자료들을 학원 학생에게 일괄 배포
  const publishCurriculum = async (curr: Curriculum) => {
    if (!user?.academyId) return;
    setDeploying(curr.id);
    try {
      // 각 슬롯의 contentId를 학생들에게 노출
      const filledSlots = curr.slots.filter(s => s.contentId);
      for (const slot of filledSlots) {
        await updateDoc(doc(db,'content',slot.contentId!), {
          published:  true,
          publishedAt: serverTimestamp(),
          curriculumId: curr.id,
        });
      }
      // 커리큘럼 상태 업데이트
      await updateDoc(doc(db,'curricula',curr.id), { status:'published' });
      setCurricula(prev => prev.map(c => c.id===curr.id ? {...c,status:'published'} : c));
      Alert.alert('배포 완료',`${curr.title}이 학생들에게 배포됐어요!\n총 ${filledSlots.length}개 자료`);
    } catch { Alert.alert('오류','배포 실패'); }
    finally { setDeploying(null); }
  };

  const deleteCurriculum = (curr:Curriculum) => {
    Alert.alert('삭제 확인',`"${curr.title}"을 삭제할까요?`,[
      { text:'취소', style:'cancel' },
      { text:'삭제', style:'destructive', onPress:async()=>{
        await deleteDoc(doc(db,'curricula',curr.id));
        setCurricula(prev=>prev.filter(c=>c.id!==curr.id));
      }},
    ]);
  };

  const filledCount = slots.filter(s=>s.contentId).length;

  // ── 목록 화면 ──────────────────────────────────────────────
  if (view === 'list') return (
    <View style={ss.wrap}>
      <View style={ss.header}>
        <Pressable style={ss.backBtn} onPress={()=>router.back()}>
          <Text style={{fontSize:18}}>←</Text>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={[Typography.h3]}>커리큘럼 관리</Text>
          <Text style={[Typography.label2,{color:Colors.ink3}]}>단원별 4개 트랙 묶기</Text>
        </View>
        <Pressable
          style={[ss.newBtn,...([Shadow.brand] as any)]}
          onPress={()=>setView('create')}
        >
          <Text style={[Typography.bold3,{color:'#fff'}]}>+ 새 커리큘럼</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
          <ActivityIndicator color={Colors.brand} size="large"/>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{padding:14,gap:10,paddingBottom:40}}>
          {curricula.length === 0 && (
            <View style={[ss.emptyCard,...([Shadow.card] as any)]}>
              <Text style={{fontSize:48,textAlign:'center',marginBottom:12}}></Text>
              <Text style={[Typography.bold2,{color:Colors.ink,textAlign:'center',marginBottom:6}]}>
                아직 커리큘럼이 없어요
              </Text>
              <Text style={[Typography.body3,{color:Colors.ink3,textAlign:'center',lineHeight:22}]}>
                단원을 만들고 단어·대화문·본문·문법{'\n'}자료를 묶어서 한 번에 배포하세요
              </Text>
              <Pressable
                style={[ss.newBtn,{marginTop:16,alignSelf:'center'},...([Shadow.brand] as any)]}
                onPress={()=>setView('create')}
              >
                <Text style={[Typography.bold2,{color:'#fff'}]}>첫 커리큘럼 만들기 →</Text>
              </Pressable>
            </View>
          )}

          {curricula.map(curr => {
            const filled = curr.slots.filter(s=>s.contentId).length;
            const isDone = curr.status === 'published';
            return (
              <View key={curr.id} style={[ss.currCard,...([Shadow.card] as any)]}>
                <View style={{flexDirection:'row',alignItems:'flex-start',marginBottom:10}}>
                  <View style={{flex:1}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4}}>
                      <Text style={[Typography.bold2,{color:Colors.ink}]}>{curr.title}</Text>
                      <View style={[ss.statusPill,{backgroundColor:isDone?Colors.greenBg:Colors.amberBg}]}>
                        <Text style={[Typography.label3,{
                          color:isDone?Colors.greenDk:Colors.amberDk,fontWeight:'700',
                        }]}>{isDone?'배포됨':'초안'}</Text>
                      </View>
                    </View>
                    <Text style={[Typography.label2,{color:Colors.ink3}]}>
                      {curr.grade} · {curr.unit} · {filled}/{curr.slots.length} 자료 연결
                    </Text>
                  </View>
                  <Pressable onPress={()=>deleteCurriculum(curr)} style={ss.deleteBtn}>
                    <Text style={[Typography.label3,{color:Colors.red}]}>삭제</Text>
                  </Pressable>
                </View>

                {/* 트랙 상태 */}
                <View style={{flexDirection:'row',gap:6,marginBottom:12}}>
                  {curr.slots.map((sl,i) => (
                    <View key={i} style={[ss.trackChip,{
                      backgroundColor: sl.contentId
                        ? CONTENT_TYPE_COLOR[sl.type]+'18'
                        : Colors.bg,
                      borderColor: sl.contentId
                        ? CONTENT_TYPE_COLOR[sl.type]
                        : Colors.line,
                    }]}>
                      <Text style={{fontSize:12}}>{CONTENT_TYPE_EMOJI[sl.type]}</Text>
                      <Text style={[Typography.label3,{
                        color: sl.contentId ? CONTENT_TYPE_COLOR[sl.type] : Colors.ink3,
                        fontWeight:'600',
                      }]}>{TRACK_LABELS[sl.type]}</Text>
                    </View>
                  ))}
                </View>

                {/* 배포 버튼 */}
                {!isDone && (
                  <Pressable
                    style={[ss.publishBtn,
                      filled===0 && {opacity:0.4},
                      ...(filled>0?[Shadow.brand as any]:[]),
                    ]}
                    onPress={()=>filled>0&&publishCurriculum(curr)}
                    disabled={filled===0||deploying===curr.id}
                  >
                    {deploying===curr.id
                      ? <ActivityIndicator color="#fff" size="small"/>
                      : <Text style={[Typography.bold2,{color:'#fff'}]}>
                           {filled}개 자료 학생 배포
                        </Text>
                    }
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // ── 신규 커리큘럼 생성 화면 ────────────────────────────────
  return (
    <View style={ss.wrap}>
      <View style={ss.header}>
        <Pressable style={ss.backBtn} onPress={()=>setView('list')}>
          <Text style={{fontSize:18}}>←</Text>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={[Typography.h3]}>새 커리큘럼</Text>
          <Text style={[Typography.label2,{color:Colors.ink3}]}>4개 트랙을 묶어서 관리</Text>
        </View>
        <View style={[ss.statusPill,{backgroundColor:
          filledCount===4?Colors.greenBg:Colors.amberBg,
        }]}>
          <Text style={[Typography.bold3,{color:
            filledCount===4?Colors.greenDk:Colors.amberDk,
          }]}>{filledCount}/4</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{padding:16,gap:12,paddingBottom:120}}>
        {/* 기본 정보 */}
        <View style={[ss.metaCard,...([Shadow.card] as any)]}>
          <Text style={[Typography.bold3,{color:Colors.ink,marginBottom:10}]}>단원 정보</Text>

          <Text style={[Typography.label2,{color:Colors.ink3,marginBottom:5}]}>커리큘럼 이름</Text>
          <TextInput
            style={ss.textInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="예: 천재교육 중3 3과"
            placeholderTextColor={Colors.ink3}
          />

          <Text style={[Typography.label2,{color:Colors.ink3,marginTop:10,marginBottom:5}]}>학년</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{flexDirection:'row',gap:7}}>
              {GRADES.map(g=>(
                <Pressable key={g} onPress={()=>setNewGrade(g)}
                  style={[ss.chip,newGrade===g&&ss.chipActive]}>
                  <Text style={[Typography.label2,{color:newGrade===g?'#fff':Colors.ink3}]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={[Typography.label2,{color:Colors.ink3,marginTop:10,marginBottom:5}]}>단원</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{flexDirection:'row',gap:7}}>
              {UNITS.map(u=>(
                <Pressable key={u} onPress={()=>setNewUnit(u)}
                  style={[ss.chip,newUnit===u&&ss.chipActive]}>
                  <Text style={[Typography.label2,{color:newUnit===u?'#fff':Colors.ink3}]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 자료 슬롯 */}
        <Text style={[Typography.bold2,{color:Colors.ink}]}>트랙별 자료 연결</Text>
        <View style={[ss.infoBox]}>
          <Text style={[Typography.label3,{color:Colors.brand,lineHeight:18}]}>
             학생 학습 순서: 단어 → 대화문 → 본문 → 문법{'\n'}
            자료를 연결하지 않은 트랙은 배포되지 않아요
          </Text>
        </View>

        {slots.map(sl => (
          <SlotCard
            key={sl.type}
            slot={sl}
            availableContents={contents.filter(c=>
              (!newGrade || c.grade===newGrade) &&
              (!newUnit  || c.unit===newUnit)
            )}
            onSelect={handleSlotSelect}
          />
        ))}
      </ScrollView>

      {/* 저장 버튼 */}
      <View style={ss.bottomBar}>
        <Pressable
          style={[ss.saveBtn,
            (!newTitle.trim()||saving) && {opacity:0.4},
            ...(newTitle.trim()?[Shadow.brand as any]:[]),
          ]}
          onPress={saveCurriculum}
          disabled={!newTitle.trim()||saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={[Typography.bold1,{color:'#fff'}]}>
                {filledCount>0 ? `커리큘럼 저장 (${filledCount}개 자료)` : '커리큘럼 저장'}
              </Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:       { flex:1, backgroundColor:Colors.bg },
  header:     { backgroundColor:Colors.white, paddingTop:52, paddingHorizontal:16, paddingBottom:14, flexDirection:'row', alignItems:'center', gap:12, borderBottomWidth:0.5, borderBottomColor:Colors.line },
  backBtn:    { width:36, height:36, borderRadius:12, borderWidth:1, borderColor:Colors.line, alignItems:'center', justifyContent:'center' },
  newBtn:     { backgroundColor:Colors.brand, borderRadius:11, paddingHorizontal:14, paddingVertical:9 },
  emptyCard:  { backgroundColor:Colors.white, borderRadius:20, borderWidth:1, borderColor:Colors.line, padding:24, alignItems:'center' },
  currCard:   { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:14 },
  statusPill: { paddingHorizontal:10, paddingVertical:4, borderRadius:99 },
  deleteBtn:  { paddingHorizontal:10, paddingVertical:5, borderRadius:9, borderWidth:1.5, borderColor:'#fca5a5', backgroundColor:Colors.redBg },
  trackChip:  { flexDirection:'row', alignItems:'center', gap:4, borderRadius:8, borderWidth:1.5, paddingHorizontal:8, paddingVertical:5 },
  publishBtn: { backgroundColor:Colors.brand, borderRadius:13, paddingVertical:13, alignItems:'center' },
  // 슬롯 카드
  slotCard:   { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, overflow:'hidden' },
  slotTop:    { flexDirection:'row', alignItems:'center', gap:11, padding:13 },
  slotIcon:   { width:42, height:42, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  statusDot:  { width:8, height:8, borderRadius:4, flexShrink:0 },
  dropdown:   { borderTopWidth:0.5, borderTopColor:Colors.line },
  dropItem:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:13, borderBottomWidth:0.5, borderBottomColor:Colors.line },
  // 폼
  metaCard:   { backgroundColor:Colors.white, borderRadius:18, borderWidth:1, borderColor:Colors.line, padding:16 },
  textInput:  { backgroundColor:Colors.bg, borderRadius:11, borderWidth:1.5, borderColor:Colors.line, paddingHorizontal:13, paddingVertical:11, fontFamily:'Pretendard-Regular', fontSize:14, color:Colors.ink },
  chip:       { paddingHorizontal:14, paddingVertical:7, borderRadius:99, borderWidth:1.5, borderColor:Colors.line, backgroundColor:Colors.white },
  chipActive: { backgroundColor:Colors.brand, borderColor:Colors.brand },
  infoBox:    { backgroundColor:Colors.brandBg, borderRadius:12, borderWidth:1, borderColor:'#DDD9FF', padding:12 },
  bottomBar:  { padding:16, paddingBottom:32, backgroundColor:Colors.white, borderTopWidth:0.5, borderTopColor:Colors.line },
  saveBtn:    { backgroundColor:Colors.brand, borderRadius:16, paddingVertical:16, alignItems:'center' },
});
