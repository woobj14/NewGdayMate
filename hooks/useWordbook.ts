import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { addDays, isAfter, startOfDay } from 'date-fns';
import { db, refs } from '../lib/firebase';
import { useAppStore } from '../stores/useAppStore';
import { saveCache, loadCache, KEYS } from '../lib/offlineCache';

export interface WordbookEntry {
  id:          string;
  word:        string;
  phonetic:    string;
  pos:         string;
  ko:          string;
  def:         string;
  syn:         string;
  easeFactor:  number;
  interval:    number;
  repetitions: number;
  nextReview:  Date;
  status:      '모름' | '햇갈림' | '외움';
  contentId:   string;
  unitId:      string;
  addedAt:     Date;
}

export type Rating = 0 | 1 | 2 | 3;

function normalizeWordKey(word: string, contentId: string) {
  return `${contentId || 'global'}__${word.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function toEntry(id: string, data: any): WordbookEntry {
  return {
    id,
    word:        data.word ?? '',
    phonetic:    data.phonetic ?? '',
    pos:         data.pos ?? '',
    ko:          data.ko ?? '',
    def:         data.def ?? '',
    syn:         data.syn ?? '',
    easeFactor:  data.easeFactor ?? 2.5,
    interval:    data.interval ?? 1,
    repetitions: data.repetitions ?? 0,
    nextReview:  data.nextReview?.toDate?.() ?? new Date(data.nextReview ?? Date.now()),
    status:      data.status ?? '모름',
    contentId:   data.contentId ?? '',
    unitId:      data.unitId ?? '',
    addedAt:     data.addedAt?.toDate?.() ?? new Date(data.addedAt ?? Date.now()),
  };
}

function calcSM2(ef: number, interval: number, reps: number, rating: Rating) {
  let newEf = ef;
  let newIvl = interval;
  let newReps = reps;

  if (rating >= 2) {
    newIvl = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ef);
    newReps = reps + 1;
  } else {
    newIvl = 1;
    newReps = 0;
  }

  newEf = Math.max(1.3, ef + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));

  const status: WordbookEntry['status'] =
    rating >= 3 ? '외움' : rating >= 2 ? '햇갈림' : '모름';

  return {
    easeFactor: newEf,
    interval: newIvl,
    repetitions: newReps,
    nextReview: addDays(new Date(), newIvl),
    status,
  };
}

export function useWordbook() {
  const { user } = useAppStore();
  const [words, setWords] = useState<WordbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isLocalOnlySession = user?.uid === 'local-admin';

  useEffect(() => {
    let unsub: (() => void) | undefined;

    async function bootstrap() {
      if (!user) {
        setWords([]);
        setLoading(false);
        return;
      }

      const cachedWords = await loadCache<WordbookEntry[]>(
        KEYS.wordbook(user.uid),
        30 * 24 * 60 * 60 * 1000
      );

      if (cachedWords) {
        setWords(cachedWords.map(entry => ({
          ...entry,
          nextReview: new Date(entry.nextReview),
          addedAt: new Date(entry.addedAt),
        })));
      } else {
        setWords([]);
      }

      if (isLocalOnlySession) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'users', user.uid, 'wordbook'),
        orderBy('addedAt', 'desc')
      );

      unsub = onSnapshot(q, snap => {
        const nextWords = snap.docs.map(d => toEntry(d.id, d.data()));
        setWords(nextWords);
        saveCache(KEYS.wordbook(user.uid), nextWords);
        setLoading(false);
      }, () => {
        setLoading(false);
      });
    }

    setLoading(true);
    bootstrap();

    return () => {
      unsub?.();
    };
  }, [user, isLocalOnlySession]);

  const addWord = useCallback(async (params: {
    word: string; phonetic: string; pos: string;
    ko: string; def: string; syn: string;
    contentId: string; unitId: string;
  }) => {
    if (!user) return 'duplicate';

    const nextId = normalizeWordKey(params.word, params.contentId);
    const exists = words.some(word =>
      word.id === nextId ||
      (word.word.toLowerCase() === params.word.toLowerCase() &&
        (word.contentId || '') === (params.contentId || ''))
    );
    if (exists) return 'duplicate';

    const optimisticEntry: WordbookEntry = {
      id: nextId,
      ...params,
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      nextReview: addDays(new Date(), 1),
      status: '모름',
      addedAt: new Date(),
    };

    const optimisticWords = [optimisticEntry, ...words];
    setWords(optimisticWords);
    await saveCache(KEYS.wordbook(user.uid), optimisticWords);

    if (isLocalOnlySession) return 'added';

    try {
      await setDoc(refs.wordbook(user.uid, nextId), {
        ...params,
        easeFactor: 2.5,
        interval: 1,
        repetitions: 0,
        nextReview: addDays(new Date(), 1),
        status: '모름',
        addedAt: serverTimestamp(),
      }, { merge: true });
      return 'added';
    } catch (error) {
      setWords(words);
      await saveCache(KEYS.wordbook(user.uid), words);
      throw error;
    }
  }, [user, words, isLocalOnlySession]);

  const rateWord = useCallback(async (wordId: string, rating: Rating) => {
    if (!user) return;
    const entry = words.find(word => word.id === wordId);
    if (!entry) return;

    const updated = calcSM2(entry.easeFactor, entry.interval, entry.repetitions, rating);
    const nextWords = words.map(word => (
      word.id === wordId ? { ...word, ...updated } : word
    ));

    setWords(nextWords);
    await saveCache(KEYS.wordbook(user.uid), nextWords);

    if (isLocalOnlySession) return;

    await updateDoc(
      doc(db, 'users', user.uid, 'wordbook', wordId),
      { ...updated, nextReview: updated.nextReview }
    );
  }, [user, words, isLocalOnlySession]);

  const removeWord = useCallback(async (wordId: string) => {
    if (!user) return;

    const nextWords = words.filter(word => word.id !== wordId);
    setWords(nextWords);
    await saveCache(KEYS.wordbook(user.uid), nextWords);

    if (isLocalOnlySession) return;

    await deleteDoc(doc(db, 'users', user.uid, 'wordbook', wordId));
  }, [user, words, isLocalOnlySession]);

  const dueWords = words.filter(word =>
    word.status !== '외움' || isAfter(new Date(), startOfDay(word.nextReview))
  );

  const masteredWords = words.filter(word => word.status === '외움');

  return {
    words,
    loading,
    dueWords,
    masteredWords,
    addWord,
    rateWord,
    removeWord,
  };
}
