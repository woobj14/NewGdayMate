// ═══════════════════════════════════════════════════════════════
// 🎨 PD팀 — 학생 탭바 레이아웃 (Lucide 아이콘 전용)
// ═══════════════════════════════════════════════════════════════
import { Tabs } from 'expo-router';
import { View, Text, Platform, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import {
  Home, BookOpen, Trophy, Target, MessageCircle, BarChart2,
} from 'lucide-react-native';
import { useWrongNote } from '../../hooks/useWrongNote';
import { useAuth } from '../../hooks/useAuth';

// ── 박스형 탭 아이콘 (Lucide) ─────────────────────────────────
function TabIcon({
  Icon, focused, badge=0,
}: { Icon:any; focused:boolean; badge?:number }) {
  return (
    <View style={{ alignItems:'center', justifyContent:'center' }}>
      <View style={{
        width:34, height:28,
        borderRadius:9,
        backgroundColor: focused ? Colors.brand : 'transparent',
        alignItems:'center', justifyContent:'center',
	        ...(Platform.select<any>({
	          ios:     focused ? { shadowColor:Colors.brand, shadowOffset:{width:0,height:3}, shadowOpacity:.35, shadowRadius:8 } : {},
	          android: focused ? { elevation:4 } : {},
	        }) ?? {}),
      }}>
        <Icon
          size={16}
          color={focused ? '#fff' : Colors.ink3}
          strokeWidth={focused ? 2.2 : 1.7}
        />
      </View>
      {badge > 0 && (
        <View style={{
          position:'absolute', top:-4, right:-10,
          backgroundColor:Colors.red, borderRadius:99,
          minWidth:14, height:14,
          alignItems:'center', justifyContent:'center',
          paddingHorizontal:3, borderWidth:1.5, borderColor:'#fff',
        }}>
          <Text style={{ color:'#fff', fontSize:8, fontWeight:'800' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function StudentLayout() {
  const { unresolvedCount } = useWrongNote();
  const { switchLocalAdminMode, isLocalAdminSession } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   Colors.brand,
          tabBarInactiveTintColor: Colors.ink3,
          tabBarStyle: {
            borderTopWidth:  0.5,
            borderTopColor:  Colors.line,
            backgroundColor: Colors.white,
            paddingBottom:   Platform.OS === 'ios' ? 22 : 10,
            paddingTop:      8,
            height:          Platform.OS === 'ios' ? 72 : 62,
          },
          tabBarLabelStyle: {
            ...Typography.label3,
            marginTop: 2,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen name="index"
          options={{ title:'홈', tabBarIcon:({focused})=><TabIcon Icon={Home} focused={focused}/> }} />
        <Tabs.Screen name="learn/index"
          options={{ title:'학습', tabBarIcon:({focused})=><TabIcon Icon={BookOpen} focused={focused}/> }} />
        <Tabs.Screen name="ranking/index"
          options={{ title:'랭킹', tabBarIcon:({focused})=><TabIcon Icon={Trophy} focused={focused}/> }} />
        <Tabs.Screen name="missions/index"
          options={{ title:'미션', tabBarIcon:({focused})=><TabIcon Icon={Target} focused={focused}/> }} />
        <Tabs.Screen name="coach/index"
          options={{ title:'코치', tabBarIcon:({focused})=><TabIcon Icon={MessageCircle} focused={focused}/> }} />
        <Tabs.Screen name="wrong-notes/index"
          options={{ title:'오답',
            tabBarIcon:({focused})=><TabIcon Icon={BarChart2} focused={focused} badge={unresolvedCount}/>,
            href: null,
          }} />
        <Tabs.Screen name="profile/index"       options={{ href:null }} />
        <Tabs.Screen name="mock-exam/index"     options={{ href:null }} />
        <Tabs.Screen name="wordbook/index"      options={{ href:null }} />
        <Tabs.Screen name="wordbook/review"     options={{ href:null }} />
        <Tabs.Screen name="review-center/index" options={{ href:null }} />
        <Tabs.Screen name="learn/[lessonId]"    options={{ href:null }} />
        <Tabs.Screen name="learn/content-step"  options={{ href:null }} />
        <Tabs.Screen name="learn/done"          options={{ href:null }} />
        <Tabs.Screen name="learn/session"       options={{ href:null }} />
        <Tabs.Screen name="learn/step"          options={{ href:null }} />
      </Tabs>
      {isLocalAdminSession && (
        <Pressable style={s.adminFloat} onPress={() => switchLocalAdminMode('admin')}>
          <Text style={[Typography.label3, { color:'#fff', fontWeight:'800' }]}>관리자</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  adminFloat: {
    position: 'absolute',
    top: 48,
    right: 14,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,.35)',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
});
