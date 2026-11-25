import { describe, it, expect } from 'vitest';
import type { SleepinessRecord, SleepKind, SleepRecord } from '../types';
import {
  circularMeanMinutes,
  elapsedSinceWake,
  formatClockMinutes,
  minutesOfDay,
  recentSummary,
  sleepinessCurve,
  splitSleepByDay,
  summarizeDays,
  tokyoMidnight,
} from './stats';

/** 東京時間の日時 → epoch ms(実行環境のタイムゾーンに依存しない) */
const jst = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600_000;

const HOUR = 3600_000;

const sleep = (
  start: number,
  end: number,
  opts: { kind?: SleepKind; alarm?: boolean } = {},
): SleepRecord => ({
  start,
  end,
  kind: opts.kind ?? 'night',
  alarm: opts.alarm ?? false,
  refreshed: 3,
});

const sleepy = (time: number, level: 1 | 2 | 3 | 4 | 5 = 3): SleepinessRecord => ({ time, level });

const hm = (h: number, m = 0) => h * 60 + m;

/** 円周上の距離(分) */
const circDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
};

describe('circularMeanMinutes(時刻の円周平均)', () => {
  it('23:30 と 0:30 の平均は 0:00', () => {
    const r = circularMeanMinutes([hm(23, 30), hm(0, 30)]);
    expect(r).not.toBeNull();
    expect(formatClockMinutes(r!)).toBe('0:00');
    expect(circDist(r!, 0)).toBeLessThan(1e-6);
  });

  it('22:00 と 2:00 の平均は 0:00', () => {
    const r = circularMeanMinutes([hm(22), hm(2)]);
    expect(formatClockMinutes(r!)).toBe('0:00');
    expect(circDist(r!, 0)).toBeLessThan(1e-6);
  });

  it('1:00 と 3:00 の平均は 2:00(120分)', () => {
    const r = circularMeanMinutes([hm(1), hm(3)]);
    expect(r).toBeCloseTo(120, 6);
    expect(formatClockMinutes(r!)).toBe('2:00');
  });

  it('23:00, 1:00, 0:00 の平均は 0:00', () => {
    const r = circularMeanMinutes([hm(23), hm(1), hm(0)]);
    expect(formatClockMinutes(r!)).toBe('0:00');
    expect(circDist(r!, 0)).toBeLessThan(1e-6);
  });

  it('値が1つならその値を返す', () => {
    expect(circularMeanMinutes([hm(7, 45)])).toBeCloseTo(465, 6);
  });

  it('空配列は null', () => {
    expect(circularMeanMinutes([])).toBeNull();
  });

  it('ちょうど反対(0:00 と 12:00)は方向が定まらず null', () => {
    expect(circularMeanMinutes([0, 720])).toBeNull();
  });

  it('結果は常に 0 以上 1440 未満', () => {
    const inputs = [
      [hm(23, 59), hm(23, 59)],
      [hm(23, 59), hm(0, 1)],
      [0],
      [1439.9999],
      [hm(12), hm(13), hm(11)],
      [hm(6), hm(23), hm(22), hm(4)],
    ];
    for (const v of inputs) {
      const r = circularMeanMinutes(v);
      expect(r).not.toBeNull();
      expect(r!).toBeGreaterThanOrEqual(0);
      expect(r!).toBeLessThan(1440);
    }
  });
});

describe('formatClockMinutes', () => {
  it('0 は 0:00', () => expect(formatClockMinutes(0)).toBe('0:00'));
  it('1439.6 は四捨五入して 0:00 に回り込む', () => expect(formatClockMinutes(1439.6)).toBe('0:00'));
  it('125 は 2:05', () => expect(formatClockMinutes(125)).toBe('2:05'));
  it('1410 は 23:30', () => expect(formatClockMinutes(1410)).toBe('23:30'));
});

describe('東京時間の時刻・日付', () => {
  it('minutesOfDay は東京の 0:00 からの分', () => {
    expect(minutesOfDay(jst(2026, 11, 25, 0, 30))).toBe(30);
    expect(minutesOfDay(jst(2026, 11, 25, 23, 59))).toBe(1439);
    expect(minutesOfDay(jst(2026, 11, 25, 7, 0))).toBe(420);
  });

  it('tokyoMidnight は東京のその日の 0:00', () => {
    expect(tokyoMidnight(jst(2026, 11, 25, 0, 30))).toBe(jst(2026, 11, 25));
    expect(tokyoMidnight(jst(2026, 11, 25, 23, 59))).toBe(jst(2026, 11, 25));
    expect(tokyoMidnight(jst(2026, 11, 25))).toBe(jst(2026, 11, 25));
  });
});

describe('elapsedSinceWake(起きてからの経過時間)', () => {
  const night = sleep(jst(2026, 11, 24, 23, 30), jst(2026, 11, 25, 7, 0));

  it('0時をまたぐ夜の睡眠の起床(7:00)から 10:00 まで 3 時間', () => {
    const r = elapsedSinceWake(jst(2026, 11, 25, 10), [night]);
    expect(r).not.toBeNull();
    expect(r!.hours).toBeCloseTo(3, 9);
  });

  it('昼寝は起床の基準にしない', () => {
    const nap = sleep(jst(2026, 11, 25, 12), jst(2026, 11, 25, 13), { kind: 'nap' });
    const r = elapsedSinceWake(jst(2026, 11, 25, 14), [night, nap]);
    expect(r!.hours).toBeCloseTo(7, 9);
  });

  it('夜の睡眠がなければ null(昼寝だけでも null)', () => {
    expect(elapsedSinceWake(jst(2026, 11, 25, 10), [])).toBeNull();
    const nap = sleep(jst(2026, 11, 25, 8), jst(2026, 11, 25, 9), { kind: 'nap' });
    expect(elapsedSinceWake(jst(2026, 11, 25, 10), [nap])).toBeNull();
  });

  it('16 時間を超えると null', () => {
    expect(elapsedSinceWake(jst(2026, 11, 25, 23, 1), [night])).toBeNull();
  });

  it('ちょうど 16 時間は null ではなく 16', () => {
    const r = elapsedSinceWake(jst(2026, 11, 25, 23), [night]);
    expect(r).not.toBeNull();
    expect(r!.hours).toBe(16);
  });

  it('目覚ましありなら workday、なしなら free', () => {
    const t = jst(2026, 11, 25, 9);
    expect(elapsedSinceWake(t, [{ ...night, alarm: true }])!.type).toBe('workday');
    expect(elapsedSinceWake(t, [{ ...night, alarm: false }])!.type).toBe('free');
  });

  it('time より後に終わる睡眠は使わない', () => {
    const later = sleep(jst(2026, 11, 25, 20), jst(2026, 11, 26, 5));
    const r = elapsedSinceWake(jst(2026, 11, 25, 10), [later, night]);
    expect(r!.hours).toBeCloseTo(3, 9);
    expect(elapsedSinceWake(jst(2026, 11, 25, 10), [later])).toBeNull();
  });

  it('終了時刻がちょうど time の睡眠は使う(経過 0 時間)', () => {
    const r = elapsedSinceWake(jst(2026, 11, 25, 7), [night]);
    expect(r!.hours).toBe(0);
  });

  it('複数の夜があれば直近の起床を使う', () => {
    const prev = sleep(jst(2026, 11, 23, 23), jst(2026, 11, 24, 6), { alarm: true });
    const r = elapsedSinceWake(jst(2026, 11, 25, 10), [night, prev]);
    expect(r!.hours).toBeCloseTo(3, 9);
    expect(r!.type).toBe('free');
  });
});

describe('splitSleepByDay(日付の境目での分割)', () => {
  it('0時をまたぐ睡眠は 2 つに分かれる', () => {
    const segs = splitSleepByDay(sleep(jst(2026, 11, 24, 23, 30), jst(2026, 11, 25, 7, 0)));
    expect(segs).toEqual([
      { date: '2026-11-24', fromMin: 1410, toMin: 1440, kind: 'night' },
      { date: '2026-11-25', fromMin: 0, toMin: 420, kind: 'night' },
    ]);
  });

  it('同じ日の睡眠は 1 つ', () => {
    const segs = splitSleepByDay(sleep(jst(2026, 11, 25, 13), jst(2026, 11, 25, 14, 30), { kind: 'nap' }));
    expect(segs).toEqual([{ date: '2026-11-25', fromMin: 780, toMin: 870, kind: 'nap' }]);
  });
});

describe('sleepinessCurve(眠気のグラフ)', () => {
  const night = sleep(jst(2026, 11, 24, 23), jst(2026, 11, 25, 7), { alarm: true });

  it('経過時間 [h, h+1) で区間に分け、平均と件数を出す', () => {
    const curve = sleepinessCurve(
      [night],
      [
        sleepy(jst(2026, 11, 25, 8, 0), 2), // 経過 1.0 → bin 1
        sleepy(jst(2026, 11, 25, 8, 59), 4), // 経過 1.98 → bin 1
        sleepy(jst(2026, 11, 25, 9, 0), 5), // 経過 2.0 → bin 2
        sleepy(jst(2026, 11, 25, 7, 30), 1), // 経過 0.5 → bin 0
      ],
    );
    expect(curve.workday).toEqual([
      { hour: 0, mean: 1, count: 1 },
      { hour: 1, mean: 3, count: 2 },
      { hour: 2, mean: 5, count: 1 },
    ]);
    expect(curve.free).toEqual([]);
  });

  it('ちょうど 16 時間は最後の区間(15)に入る', () => {
    const curve = sleepinessCurve([night], [sleepy(jst(2026, 11, 25, 23), 4)]);
    expect(curve.workday).toEqual([{ hour: 15, mean: 4, count: 1 }]);
  });

  it('平日と自由な日は別々に集計する', () => {
    const freeNight = sleep(jst(2026, 11, 25, 23), jst(2026, 11, 26, 8), { alarm: false });
    const curve = sleepinessCurve(
      [night, freeNight],
      [sleepy(jst(2026, 11, 25, 9), 2), sleepy(jst(2026, 11, 26, 9), 4)],
    );
    expect(curve.workday).toEqual([{ hour: 2, mean: 2, count: 1 }]);
    expect(curve.free).toEqual([{ hour: 1, mean: 4, count: 1 }]);
  });

  it('基準の起床がない記録は無視する', () => {
    const curve = sleepinessCurve(
      [night],
      [
        sleepy(jst(2026, 11, 24, 20), 5), // 起床より前
        sleepy(jst(2026, 11, 25, 23, 30), 5), // 16 時間超
      ],
    );
    expect(curve.workday).toEqual([]);
    expect(curve.free).toEqual([]);
  });
});

describe('summarizeDays(日ごとの要約)', () => {
  it('睡眠は起きた日に属する', () => {
    const days = summarizeDays([sleep(jst(2026, 11, 24, 23, 30), jst(2026, 11, 25, 7))]);
    expect([...days.keys()]).toEqual(['2026-11-25']);
  });

  it('主な睡眠はその日に起きた夜の睡眠のうち最長のもの', () => {
    const short = sleep(jst(2026, 11, 25, 2), jst(2026, 11, 25, 4), { alarm: true });
    const long = sleep(jst(2026, 11, 24, 23), jst(2026, 11, 25, 1), { alarm: false });
    const longer = sleep(jst(2026, 11, 25, 4, 30), jst(2026, 11, 25, 9), { alarm: true });
    const day = summarizeDays([short, long, longer]).get('2026-11-25')!;
    expect(day.mainSleep).toBe(longer);
    expect(day.type).toBe('workday');
  });

  it('昼寝は合計に足されるが、種類は決めない', () => {
    const nap = sleep(jst(2026, 11, 25, 13), jst(2026, 11, 25, 14), { kind: 'nap' });
    const day = summarizeDays([nap]).get('2026-11-25')!;
    expect(day.type).toBeNull();
    expect(day.mainSleep).toBeNull();
    expect(day.totalSleepMs).toBe(HOUR);
  });

  it('夜の睡眠と昼寝の合計時間', () => {
    const night = sleep(jst(2026, 11, 24, 23), jst(2026, 11, 25, 7), { alarm: false });
    const nap = sleep(jst(2026, 11, 25, 13), jst(2026, 11, 25, 14), { kind: 'nap' });
    const day = summarizeDays([night, nap]).get('2026-11-25')!;
    expect(day.type).toBe('free');
    expect(day.totalSleepMs).toBe(9 * HOUR);
  });
});

describe('recentSummary(直近 14 日の要約)', () => {
  const today = '2026-11-25';

  it('期間は today-13 〜 today で、14 日前は含まない', () => {
    const inside = sleep(jst(2026, 11, 11, 23), jst(2026, 11, 12, 7), { alarm: true }); // 11/12 起床
    const outside = sleep(jst(2026, 11, 10, 23), jst(2026, 11, 11, 7), { alarm: true }); // 11/11 起床
    const r = recentSummary([inside, outside], today);
    expect(r.from).toBe('2026-11-12');
    expect(r.to).toBe(today);
    expect(r.workday.days).toBe(1);
  });

  it('today より後の日は含まない', () => {
    const future = sleep(jst(2026, 11, 25, 23), jst(2026, 11, 26, 7), { alarm: true });
    expect(recentSummary([future], today).workday.days).toBe(0);
  });

  it('0時をまたぐ寝付き時刻の円周平均(自由な日 23:30 と 0:30 → 0:00)', () => {
    const a = sleep(jst(2026, 11, 24, 23, 30), jst(2026, 11, 25, 7), { alarm: false });
    const b = sleep(jst(2026, 11, 23, 0, 30), jst(2026, 11, 23, 8), { alarm: false });
    const r = recentSummary([a, b], today);
    expect(r.free.days).toBe(2);
    expect(formatClockMinutes(r.free.meanSleepStartMin!)).toBe('0:00');
    expect(formatClockMinutes(r.free.meanWakeMin!)).toBe('7:30');
    expect(r.free.meanTotalSleepMs).toBe(7.5 * HOUR);
  });

  it('平日と自由な日を分けて数える', () => {
    const w1 = sleep(jst(2026, 11, 24, 23), jst(2026, 11, 25, 6), { alarm: true });
    const w2 = sleep(jst(2026, 11, 23, 23), jst(2026, 11, 24, 6), { alarm: true });
    const f1 = sleep(jst(2026, 11, 22, 1), jst(2026, 11, 22, 9), { alarm: false });
    const r = recentSummary([w1, w2, f1], today);
    expect(r.workday.days).toBe(2);
    expect(r.free.days).toBe(1);
  });

  it('昼寝だけの日は数えないが、夜の日の睡眠時間には昼寝が足される', () => {
    const night = sleep(jst(2026, 11, 24, 23), jst(2026, 11, 25, 7), { alarm: false }); // 8h
    const nap = sleep(jst(2026, 11, 25, 13), jst(2026, 11, 25, 14), { kind: 'nap' }); // 1h
    const napOnly = sleep(jst(2026, 11, 20, 13), jst(2026, 11, 20, 14), { kind: 'nap' });
    const r = recentSummary([night, nap, napOnly], today);
    expect(r.free.days).toBe(1);
    expect(r.workday.days).toBe(0);
    expect(r.free.meanTotalSleepMs).toBe(9 * HOUR);
  });

  it('該当する日がなければ days は 0 で平均は null', () => {
    const r = recentSummary([], today);
    expect(r.workday).toEqual({ days: 0, meanSleepStartMin: null, meanWakeMin: null, meanTotalSleepMs: null });
    expect(r.free).toEqual({ days: 0, meanSleepStartMin: null, meanWakeMin: null, meanTotalSleepMs: null });
  });
});
