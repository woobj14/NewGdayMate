// ═══════════════════════════════════════════════════════════════
// 📊 GA팀 (Growth & Admin) 소유 파일
// 원칙: 데이터 신뢰성 · B2B 지원 · 운영 자동화 · 리텐션 분석 · 문서 최신화
// 수정 전 CLAUDE.md 확인 필수 | academyId 필터 누락 금지
// ═══════════════════════════════════════════════════════════════
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../stores/useAppStore';

const KPI = [
  { label:'오늘 접속',    val:'324명',  sub:'↑ 어제 대비 +12%',  subColor:Colors.green,  bg:Colors.white,  border:Colors.line },
  { label:'미처리 요청',  val:'12건',   sub:'긴급 2건 포함',      subColor:Colors.red,    bg:Colors.redBg,  border:'#fca5a5' },
  { label:'등록 콘텐츠',  val:'2,841',  sub:'이번 주 +34개',      subColor:Colors.ink3,   bg:Colors.white,  border:Colors.line },
  { label:'AI 코치 호출', val:'18,420', sub:'누적',               subColor:Colors.ink3,   bg:Colors.white,  border:Colors.line },
];

const ACTIVITY = [
  { icon:'', color:Colors.brandBg, title:'천재교육 중3 4과 단어 64개 등록', sub:'AI 영영풀이 자동 생성 완료', time:'1시간' },
  { icon:'', color:Colors.redBg,   title:'iOS PDF 버그 개발팀 이관',        sub:'최유진 학생 리포트 → GitHub #284', time:'2시간' },
  { icon:'완료', color:Colors.greenBg, title:'미래엔 중2 5과 배포 완료',        sub:'학생 156명에게 자동 배포', time:'어제' },
  { icon:'', color:Colors.amberBg, title:'신규 선생님 3명 가입 승인',       sub:'YBM · 고1 · 신규 학원 2곳', time:'어제' },
];

const QUICK = [
  { icon:'', color:Colors.brandBg, iconColor:Colors.brand, label:'콘텐츠 입력', sub:'단어/문법/본문 등록', route:'/(admin)/content' },
  { icon:'', color:Colors.redBg,   iconColor:Colors.red,   label:'요청함',      sub:'미처리 12건',        route:'/(admin)/requests' },
  { icon:'', color:Colors.greenBg, iconColor:Colors.green, label:'사용자 관리', sub:'선생님/학생 승인',    route:'/(admin)/users' },
  { icon:'', color:Colors.amberBg, iconColor:Colors.amber, label:'서비스 통계', sub:'학습 데이터 분석',    route:'/(admin)/stats' },
];

const TEST_MODES: { role: Role; label: string; sub: string; bg: string; color: string }[] = [
  { role:'student', label:'학생 모드', sub:'학습 화면 테스트', bg:Colors.brandBg, color:Colors.brand },
  { role:'teacher', label:'선생님 모드', sub:'관리 화면 테스트', bg:Colors.amberBg, color:Colors.orange },
  { role:'admin',   label:'관리자 모드', sub:'운영 화면 복귀',   bg:Colors.greenBg, color:Colors.green },
];

export default function AdminHome() {
  const router = useRouter();
  const { switchLocalAdminMode } = useAuth();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.ink }}>
      {/* 다크 히어로 */}
      <View style={s.hero}>
        <Text style={[Typography.label2, { color:'rgba(255,255,255,.5)', marginBottom: 4 }]}>관리자 · G'day Mate</Text>
        <Text style={[Typography.h2, { color:'#fff', marginBottom: 14 }]}>서비스 현황 </Text>
        <View style={s.heroKpi}>
          {[
            { val:'1,248', lbl:'전체 학생' },
            { val:'84',    lbl:'선생님'   },
            { val:'92%',   lbl:'월간 활성', color:Colors.brand },
          ].map((k, i) => (
            <View key={i} style={s.heroKpiItem}>
              <Text style={[Typography.statSm, { color: k.color ?? '#fff' }]}>{k.val}</Text>
              <Text style={[Typography.label2, { color:'rgba(255,255,255,.5)', marginTop:3 }]}>{k.lbl}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={{ flex:1, backgroundColor:Colors.bg }} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
        {/* KPI 카드 */}
        <View style={s.kpiGrid}>
          {KPI.map((k, i) => (
            <View key={i} style={[s.kpiCard, { backgroundColor:k.bg, borderColor:k.border }]}>
              <Text style={[Typography.label2, { color:Colors.ink3, marginBottom:5 }]}>{k.label}</Text>
              <Text style={[Typography.stat, { color:Colors.ink }]}>{k.val}</Text>
              <Text style={[Typography.label2, { color:k.subColor, marginTop:3 }]}>{k.sub}</Text>
            </View>
          ))}
        </View>

        {/* 테스트 모드 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>테스트 전환</Text>
        <View style={[s.card, { marginBottom:14, padding:10 }]}>
          <View style={{ flexDirection:'row', gap:8 }}>
            {TEST_MODES.map((mode) => (
              <Pressable
                key={mode.role}
                style={[s.modeBtn, { backgroundColor:mode.bg, borderColor:mode.color }]}
                onPress={() => switchLocalAdminMode(mode.role)}
              >
                <Text style={[Typography.bold3, { color:mode.color, marginBottom:3 }]}>{mode.label}</Text>
                <Text style={[Typography.label3, { color:Colors.ink3 }]}>{mode.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 최근 활동 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>최근 활동</Text>
        <View style={[s.card, { marginBottom:14 }]}>
          {ACTIVITY.map((a, i) => (
            <View key={i} style={[s.actRow, i < ACTIVITY.length-1 && { borderBottomWidth:0.5, borderBottomColor:Colors.line }]}>
              <View style={[s.actIco, { backgroundColor:a.color }]}>
                <Text style={{ fontSize:16 }}>{a.icon}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={[Typography.bold3, { color:Colors.ink, marginBottom:2 }]}>{a.title}</Text>
                <Text style={[Typography.label2, { color:Colors.ink3 }]}>{a.sub}</Text>
              </View>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>{a.time}</Text>
            </View>
          ))}
        </View>

        {/* 빠른 실행 */}
        <Text style={[Typography.h4, { marginBottom:10 }]}>빠른 실행</Text>
        <View style={s.quickGrid}>
          {QUICK.map((q, i) => (
            <Pressable key={i} style={s.quickCard} onPress={() => router.push(q.route as any)}>
              <View style={[s.quickIco, { backgroundColor:q.color }]}>
                <Text style={{ fontSize:20 }}>{q.icon}</Text>
              </View>
              <Text style={[Typography.bold3, { color:Colors.ink, marginTop:8, marginBottom:3 }]}>{q.label}</Text>
              <Text style={[Typography.label2, { color:Colors.ink3 }]}>{q.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero:        { paddingTop:52, paddingHorizontal:22, paddingBottom:24 },
  heroKpi:     { flexDirection:'row', gap:10 },
  heroKpiItem: { flex:1, backgroundColor:'rgba(255,255,255,.08)', borderRadius:14, padding:12, alignItems:'center' },
  kpiGrid:     { flexDirection:'row', flexWrap:'wrap', gap:9, marginBottom:14 },
  kpiCard:     { width:'47.5%', borderRadius:16, borderWidth:1, padding:14 },
  card:        { backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line },
  actRow:      { flexDirection:'row', alignItems:'center', gap:12, padding:13 },
  actIco:      { width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center' },
  quickGrid:   { flexDirection:'row', flexWrap:'wrap', gap:9 },
  quickCard:   { width:'47.5%', backgroundColor:Colors.white, borderRadius:16, borderWidth:1, borderColor:Colors.line, padding:16 },
  quickIco:    { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center' },
  modeBtn:     { flex:1, borderRadius:12, borderWidth:1, paddingVertical:12, paddingHorizontal:8, alignItems:'center' },
});
