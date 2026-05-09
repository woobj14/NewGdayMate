// ═══════════════════════════════════════════════════════════════
// 🏗️ PI팀 (Platform & Infrastructure) 소유 파일
// 원칙: 보안 규칙 · 오프라인 우선 · FCM 관리 · 환경변수 · 비용 최적화
// 수정 전 CLAUDE.md 확인 필수 | 보안 규칙 변경 시 즉시 배포 필수
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, updateDoc } from 'firebase/firestore';
import { db, refs } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';

export type NotifType =
  | 'streak_alert'    // 오늘 안 하면 streak 끊김
  | 'new_assignment'  // 선생님이 새 자료 배포
  | 'level_up'        // 레벨업
  | 'badge_earned'    // 배지 획득
  | 'league_promoted' // 리그 승격
  | 'dday_countdown'  // 시험 D-day
  | 'rank_overtaken'  // 리더보드 추월
  | 'word_review';    // SM-2 단어 복습 알림

export function useFCM() {
  const { user } = useAppStore();
  const notifListener   = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications();

    // 알림 수신 핸들러 (포그라운드)
    notifListener.current = Notifications.addNotificationReceivedListener(notif => {
      console.log('📱 알림 수신:', notif.request.content.title);
    });

    // 알림 탭 핸들러
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleNotificationTap(data as Record<string, string>);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  async function registerForPushNotifications() {
    if (!Device.isDevice) return; // 에뮬레이터에서는 건너뜀
    if (!user) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'G\'day Mate',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5B50F0',
      });
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    });

    // FCM 토큰을 Firestore에 저장
    await updateDoc(refs.users(user.uid), {
      fcmToken: token.data,
      fcmUpdatedAt: new Date().toISOString(),
    });
  }

  function handleNotificationTap(data: Record<string, string>) {
    // TODO: expo-router로 해당 화면으로 이동
    switch (data.type as NotifType) {
      case 'streak_alert':    /* router.push('/(student)/')         */ break;
      case 'new_assignment':  /* router.push('/(student)/learn')    */ break;
      case 'level_up':        /* router.push('/(student)/profile')  */ break;
      case 'badge_earned':    /* router.push('/(student)/profile')  */ break;
      case 'rank_overtaken':  /* router.push('/(student)/profile')  */ break;
    }
  }

  // 로컬 푸시 전송 (테스트용)
  async function sendLocalNotif(type: NotifType, coachName = 'Betty') {
    if (Platform.OS === 'web') return;

    const MSGS: Record<NotifType, { title: string; body: string }> = {
      streak_alert:    { title:`${coachName}가 기다리고 있어! 🔥`, body:'오늘 학습 안 하면 streak 끊겨요!' },
      new_assignment:  { title:'새 자료가 등록됐어요 📚', body:'선생님이 새 학습 자료를 배포했어요.' },
      level_up:        { title:'레벨업! 🎉', body:'레벨이 올랐어요. 계속 화이팅!' },
      badge_earned:    { title:'배지 획득! ✨', body:'새 배지를 획득했어요.' },
      league_promoted: { title:'리그 승격! ⚡', body:'다이아 리그로 진출했어요!' },
      dday_countdown:  { title:'시험 D-3 ⚠️', body:'3일 남았어요. 오늘 집중 테스트 한 번 더!' },
      rank_overtaken:  { title:'순위가 바뀌었어요 📊', body:'1위 자리를 빼앗겼어요. 따라잡아봐요!' },
      word_review:     { title:`${coachName}가 단어 복습 시간이래요! 📖`, body:'오늘 복습할 단어가 기다리고 있어요.' },
    };
    await Notifications.scheduleNotificationAsync({
      content: { ...MSGS[type], data: { type } },
      trigger: null, // 즉시 발송
    });
  }

  /**
   * SM-2 단어 복습 알림 스케줄
   * dueCount: 오늘 복습할 단어 수
   * hour: 알림 시각 (기본 오후 7시)
   */
  async function scheduleWordReviewNotif(dueCount: number, hour = 19) {
    if (Platform.OS === 'web') return;
    if (dueCount === 0) return;

    // 기존 word_review 알림 모두 취소
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as any)?.type === 'word_review') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    // 오늘 오후 7시 (이미 지났으면 내일)
    const now    = new Date();
    const target = new Date();
    target.setHours(hour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '단어 복습 시간이에요! 📖',
        body:  `오늘 복습할 단어 ${dueCount}개가 기다려요. 잠깐이면 돼요!`,
        data:  { type: 'word_review' },
        sound: true,
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: target },
    });
  }

  return { sendLocalNotif, scheduleWordReviewNotif };
}
