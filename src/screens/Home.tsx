import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  clearPendingSleepStart,
  db,
  setPendingSleepStart,
} from '../db';
import { dateKey, formatDateTime, formatTime, nowMinute } from '../lib/time';
import { sleepinessAwaitingEase } from '../lib/sleepiness';
import { RATINGS, SLEEPINESS_LABEL, type Rating, type SleepRecord } from '../types';
import { Sheet } from '../components/Sheet';
import { SleepForm } from '../components/SleepForm';
import { useToast } from '../components/Toast';
import './Home.css';

export function Home() {
  const toast = useToast();
  const pending = useLiveQuery(() => db.pending.get('sleepStart'));
  const latestDrowsy = useLiveQuery(() => db.sleepiness.orderBy('time').last());
  const latestSleep = useLiveQuery(() => db.sleeps.orderBy('end').last());
  // 「覚めてきた」を押せる眠気の記録(最新1件)
  const easing = sleepinessAwaitingEase(
    latestDrowsy,
    latestSleep ? latestSleep.end : null,
    pending ? pending.time : null,
  );

  // 起きた: タップ時点の end と start を保持
  const [wake, setWake] = useState<{ start: number | null; end: number } | null>(null);
  // 眠い: タップ時点の時刻
  const [drowsyTime, setDrowsyTime] = useState<number | null>(null);
  const savingRef = useRef(false);

  const onSleep = async () => {
    const t = nowMinute();
    await setPendingSleepStart(t);
    toast(`寝付き時刻の候補を保存しました(${formatTime(t)})`);
  };

  const onWake = () => {
    setWake({ start: pending ? pending.time : null, end: nowMinute() });
  };

  const submitSleep = async (rec: Omit<SleepRecord, 'id'>) => {
    await db.transaction('rw', db.sleeps, db.pending, async () => {
      await db.sleeps.add(rec);
      await db.pending.delete('sleepStart');
    });
    setWake(null);
    toast('睡眠を記録しました');
  };

  const onDrowsy = () => {
    savingRef.current = false;
    setDrowsyTime(nowMinute());
  };

  const saveDrowsy = async (level: Rating) => {
    if (drowsyTime === null || savingRef.current) return;
    savingRef.current = true;
    try {
      await db.sleepiness.add({ time: drowsyTime, level });
      setDrowsyTime(null);
      toast(`眠気を記録しました(${level})`);
    } finally {
      savingRef.current = false;
    }
  };

  const onEased = async () => {
    if (!easing || savingRef.current) return;
    savingRef.current = true;
    try {
      const t = Math.max(nowMinute(), easing.time);
      await db.sleepiness.update(easing.id!, { easedAt: t });
      toast(`眠気が覚めてきた時刻を記録しました(${formatTime(t)})`);
    } finally {
      savingRef.current = false;
    }
  };

  const cancelPending = async () => {
    if (window.confirm('寝た時刻(仮)を取り消しますか?')) {
      await clearPendingSleepStart();
    }
  };

  return (
    <div className="home">
      <h1 className="screen-title">睡眠日誌</h1>

      <div className="home-buttons">
        <button type="button" className="home-big home-sleep" onClick={onSleep}>
          寝る
        </button>
        <button type="button" className="home-big home-wake" onClick={onWake}>
          起きた
        </button>
        <button type="button" className="home-big home-drowsy" onClick={onDrowsy}>
          眠い
        </button>
      </div>

      {pending && (
        <div className="card home-pending">
          <span>寝た時刻(仮) {formatDateTime(pending.time)}</span>
          <button type="button" className="btn home-cancel" onClick={cancelPending}>
            取り消し
          </button>
        </div>
      )}

      {easing && (
        <div className="card home-easing">
          <span>
            眠気 {easing.level}(
            {dateKey(easing.time) === dateKey(Date.now())
              ? formatTime(easing.time)
              : formatDateTime(easing.time)}
            〜)
          </span>
          <button type="button" className="btn" onClick={onEased}>
            覚めてきた
          </button>
        </div>
      )}

      {wake && (
        <SleepForm
          title="起きた"
          initial={{ start: wake.start, end: wake.end, kind: null, alarm: null, refreshed: null }}
          onSubmit={submitSleep}
          onCancel={() => setWake(null)}
        />
      )}

      {drowsyTime !== null && (
        <Sheet title="眠い" onClose={() => setDrowsyTime(null)}>
          <p className="hint home-drowsy-time">{formatTime(drowsyTime)} の眠気</p>
          <div className="home-levels">
            {RATINGS.map((n) => (
              <button
                key={n}
                type="button"
                className="choice home-level"
                onClick={() => saveDrowsy(n)}
              >
                {n}
                <small>{SLEEPINESS_LABEL[n]}</small>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
