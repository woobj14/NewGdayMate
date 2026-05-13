import { useState, useCallback } from 'react';
import { updateDoc } from 'firebase/firestore';
import { refs } from '../lib/firebase';
import { streamCoachResponse } from '../lib/gemini';
import { useAppStore } from '../stores/useAppStore';
import { WrongAnswer } from '../stores/useAppStore';

export function useCoach() {
  const {
    user, selectedCoach,
    chatHistory, addChatMessage, clearChat,
    currentWrong,
  } = useAppStore();

  const [streaming, setStreaming]         = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError]                 = useState<string | null>(null);

  const ask = useCallback(async (question: string) => {
    if (!user || streaming) return;
    setStreaming(true);
    setStreamingText('');
    setError(null);

    // 사용자 메시지 저장
    addChatMessage({ role: 'user', content: question, ts: Date.now() });

    // Gemini history 포맷 변환
    const history = chatHistory
      .slice(0, -1) // 방금 추가한 메시지 제외 (sendMessageStream에서 전달)
      .map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.content }] as [{ text: string }],
      }));

    const studentCtx = [
      `이름: ${user.displayName}`,
      `학년: ${user.grade ?? '중3'}`,
      `계정 유형: ${user.accountType}`,
      `학습 코스: ${user.scoreBand ?? '80s'}`,
      `최근 모의고사: ${typeof user.latestMockScore === 'number' ? `${user.latestMockScore}점` : '없음'}`,
    ].join(', ');
    const wrongCtx   = currentWrong
      ? `문제: ${currentWrong.question}\n내 답: ${currentWrong.myAnswer}\n정답: ${currentWrong.correctAnswer}\n지문: ${currentWrong.passageSnippet}`
      : '';

    await streamCoachResponse({
      coach: selectedCoach,
      question,
      history,
      studentCtx,
      wrongCtx,
      onChunk: (text) => setStreamingText(text),
      onDone: async (full) => {
        // 코치 응답 저장
        addChatMessage({ role: 'model', content: full, ts: Date.now() });
        setStreamingText('');
        setStreaming(false);
        setError(null);

        // 오답 해결 감지
        const resolved = ['이해됐어', '알겠어', '이해했어', '맞아요', '완벽해'];
        if (currentWrong && resolved.some(k => question.includes(k))) {
          await updateDoc(refs.wrongNote(user.uid, currentWrong.id), {
            status: 'resolved',
          });
        }
      },
      onError: (err) => {
        setError(err.message);
        setStreamingText('');
        setStreaming(false);
      },
    });
  }, [user, streaming, selectedCoach, chatHistory, currentWrong]);

  return { ask, streaming, streamingText, error, clearChat };
}
