// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 (Growth & Admin) 소유 파일
// 원칙: 데이터 신뢰성 · B2B 지원 · 운영 자동화 · 리텐션 분석 · 문서 최신화
// 수정 전 CLAUDE.md 확인 필수 | academyId 필터 누락 금지
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

type Tab = 'all'|'teacher'|'student';

const PENDING = [
  { id:'p1', name:'김영준', role:'선생님', org:'새빛영어학원', time:'10분 전', color:Colors.purpleAlt },
  { id:'p2', name:'오미래', role:'선생님', org:'탑클래스학원', time:'2시간 전', color:Colors.orange },
];

const USERS = [
  { id:'1', name:'이재영',role:'선생님',sub:'천재교육 · 중3 A,B반 · 학생 48명',status:'active',  color:Colors.purpleAlt },
  { id:'2', name:'박선영',role:'선생님',sub:'미래엔 · 중2 C반 · 학생 24명',      status:'active',  color:Colors.orange },
  { id:'3', name:'최연우',role:'선생님',sub:'YBM · 고1 · 30일 미접속',           status:'inactive',color:Colors.ink3 },
  { id:'4', name:'김지민',role:'학생',  sub:'중3 · 천재교육 · 이재영T',           status:'active',  color:Colors.green },
  { id:'5', name:'장민서',role:'학생',  sub:'중2 · 미래엔 · 박선영T · 14일 미접속',status:'inactive',color:Colors.blue },
];

export default function AdminUsersScreen() {
  const [tab,    setTab]    = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [approved, setApproved] = useState<string[]>([]);

  const filtered = USERS.filter(u => {
    const tabOk   = tab==='all'||u.role===(tab==='teacher'?'선생님':'학생');
    const searchOk= search===''||u.name.includes(search)||u.sub.includes(search);
    return tabOk&&searchOk;
  });

  const pendingLeft = PENDING.filter(p=>!approved.includes(p.id));

  return (
    <View style={s.wrap}>
      <View style={s.hdr}>
        <Text style={[Typography.label2,{color:Colors.ink3,marginBottom:3}]}>관리자</Text>
        <Text style={[Typography.h2,{marginBottom:14}]}>사용자 관리</Text>

        {/* 승인 대기 */}
        {pendingLeft.length>0&&(
          <View style={s.pendingBox}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10}}>
              <Text style={{fontSize:14}}>⏰</Text>
              <Text style={[Typography.bold3,{color:Colors.amberText}]}>승인 대기 {pendingLeft.length}명</Text>
            </View>
            {pendingLeft.map(p=>(
              <View key={p.id} style={s.pendingRow}>
                <View style={[s.ava,{backgroundColor:p.color}]}>
                  <Text style={[Typography.bold3,{color:'#fff'}]}>{p.name[0]}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={[Typography.bold3,{color:Colors.ink}]}>{p.name} {p.role}</Text>
                  <Text style={[Typography.label2,{color:Colors.ink3}]}>{p.org} · {p.time}</Text>
                </View>
                <Pressable style={s.approveBtn} onPress={()=>setApproved(a=>[...a,p.id])}>
                  <Text style={[Typography.label2,{color:'#fff'}]}>승인</Text>
                </Pressable>
                <Pressable style={s.rejectBtn}>
                  <Text style={[Typography.label2,{color:Colors.ink3}]}>거절</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* 탭 */}
        <View style={s.tabs}>
          {(['all','teacher','student'] as Tab[]).map(t=>(
            <Pressable key={t} onPress={()=>setTab(t)}
              style={[s.tabBtn,tab===t&&{backgroundColor:'#fff',shadowColor:'#000',shadowOpacity:.08,shadowRadius:4,elevation:2}]}>
              <Text style={[Typography.bold3,{color:tab===t?Colors.ink:Colors.ink3}]}>
                {t==='all'?`전체 ${USERS.length}`:t==='teacher'?`선생님 ${USERS.filter(u=>u.role==='선생님').length}`:`학생 ${USERS.filter(u=>u.role==='학생').length}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 검색 */}
      <View style={s.searchBar}>
        <Text style={{fontSize:15,color:Colors.ink3}}></Text>
        <TextInput style={s.searchInput} placeholder="이름, 학원, 학교 검색..." placeholderTextColor={Colors.ink3} value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u=>u.id}
        contentContainerStyle={{gap:1}}
        renderItem={({item:u})=>(
          <View style={[s.userRow,{backgroundColor:Colors.white}]}>
            <View style={[s.ava,{backgroundColor:u.color}]}>
              <Text style={[Typography.bold3,{color:'#fff'}]}>{u.name[0]}</Text>
            </View>
            <View style={{flex:1}}>
              <Text style={[Typography.bold3,{color:Colors.ink}]}>{u.name}</Text>
              <Text style={[Typography.label2,{color:Colors.ink3}]}>{u.sub}</Text>
            </View>
            <View style={[s.statusBadge,{backgroundColor:u.status==='active'?Colors.greenBg:Colors.bg}]}>
              <Text style={[Typography.label3,{color:u.status==='active'?Colors.greenDk:Colors.ink3}]}>
                {u.status==='active'?'활성':'비활성'}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s=StyleSheet.create({
  wrap:        {flex:1,backgroundColor:Colors.bg},
  hdr:         {backgroundColor:Colors.white,paddingTop:52,paddingHorizontal:18,paddingBottom:14,borderBottomWidth:1,borderBottomColor:Colors.line},
  pendingBox:  {backgroundColor:Colors.amberBg,borderRadius:14,borderWidth:1,borderColor:'#FDE68A',padding:13,marginBottom:12},
  pendingRow:  {flexDirection:'row',alignItems:'center',gap:10,marginBottom:8},
  ava:         {width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',flexShrink:0},
  approveBtn:  {backgroundColor:Colors.brand,borderRadius:9,paddingHorizontal:12,paddingVertical:7},
  rejectBtn:   {backgroundColor:Colors.white,borderRadius:9,paddingHorizontal:12,paddingVertical:7,borderWidth:1.5,borderColor:Colors.line},
  tabs:        {flexDirection:'row',backgroundColor:Colors.line,borderRadius:12,padding:4,gap:4},
  tabBtn:      {flex:1,alignItems:'center',paddingVertical:9,borderRadius:9},
  searchBar:   {flexDirection:'row',alignItems:'center',gap:10,backgroundColor:Colors.white,borderBottomWidth:0.5,borderBottomColor:Colors.line,paddingHorizontal:16,paddingVertical:11},
  searchInput: {flex:1,fontFamily:'Pretendard-Regular',fontSize:13,color:Colors.ink},
  userRow:     {flexDirection:'row',alignItems:'center',gap:12,padding:14,borderBottomWidth:0.5,borderBottomColor:Colors.line},
  statusBadge: {paddingHorizontal:9,paddingVertical:3,borderRadius:99},
});
