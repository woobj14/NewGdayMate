import { Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';

function AIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const w = 2;
  switch (name) {
    case 'home':    return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/><Polyline points="9,22 9,12 15,12 15,22" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    case 'content': return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/><Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    case 'users':   return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={w}/><Path d="M23 21v-2a4 4 0 00-3-3.87" stroke={color} strokeWidth={w} strokeLinecap="round"/><Path d="M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>;
    case 'stats':   return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Line x1="18" y1="20" x2="18" y2="10" stroke={color} strokeWidth={w} strokeLinecap="round"/><Line x1="12" y1="20" x2="12" y2="4" stroke={color} strokeWidth={w} strokeLinecap="round"/><Line x1="6" y1="20" x2="6" y2="14" stroke={color} strokeWidth={w} strokeLinecap="round"/></Svg>;
    case 'msg':     return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"/></Svg>;
    default: return null;
  }
}

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: Colors.green,
      tabBarInactiveTintColor: Colors.ink3,
      tabBarStyle: { borderTopWidth: 0.5, borderTopColor: Colors.line, backgroundColor: Colors.white, paddingBottom: 20, paddingTop: 8, height: 64 },
      tabBarLabelStyle: { ...Typography.label2, marginTop: 2 },
    }}>
      <Tabs.Screen name="index"    options={{ title: '홈',      tabBarIcon: ({ color }) => <AIcon name="home"    color={color} /> }} />
      <Tabs.Screen name="content/index"  options={{ title: '콘텐츠',  tabBarIcon: ({ color }) => <AIcon name="content" color={color} /> }} />
      <Tabs.Screen name="users/index"    options={{ title: '사용자',  tabBarIcon: ({ color }) => <AIcon name="users"   color={color} /> }} />
      <Tabs.Screen name="stats/index"    options={{ title: '통계',    tabBarIcon: ({ color }) => <AIcon name="stats"   color={color} /> }} />
      <Tabs.Screen name="requests/index" options={{ title: '요청함',  tabBarIcon: ({ color }) => <AIcon name="msg"     color={color} /> }} />
    </Tabs>
  );
}
