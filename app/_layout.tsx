import { Stack }      from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useAuth }     from '../hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
});

// FCM 알림 핸들러
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export default function RootLayout() {
  // Auth 상태 구독 + 라우팅 일원화
  useAuth({ route: true });

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="onboarding/splash"       />
          <Stack.Screen name="onboarding/role"         />
          <Stack.Screen name="onboarding/academy-code" />
          <Stack.Screen name="onboarding/profile"      />
          <Stack.Screen name="(student)"               />
          <Stack.Screen name="(teacher)"               />
          <Stack.Screen name="(admin)"                 />
        </Stack>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
