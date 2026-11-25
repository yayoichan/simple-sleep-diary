/**
 * まとめ画面の計算(純粋関数のみ。DB や React には依存しない)。
 *
 * 用語
 * - 日付はすべて Asia/Tokyo の 'YYYY-MM-DD'。
 * - 睡眠はその「起きた日」(end の日付)に属する。
 * - その日の「主な睡眠」= その日に起きた夜の睡眠のうち最も長いもの。
 * - 主な睡眠で目覚ましを使った日 = 平日(workday)、使わなかった日 = 自由な日(free)。
 *   その日に起きた夜の睡眠がない日は種類なし(null)。
 */
import type { SleepinessRecord, SleepKind, SleepRecord } from '../types';
import { dateKey } from './time';

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const MINUTES_PER_DAY = 24 * 60;
const TOKYO_OFFSET_MS = 9 * HOUR_MS;

/** 自由な日がこの日数未満なら「データ不足」 */
export const MIN_FREE_DAYS = 2;
/** 眠気グラフの横軸の上限(起きてからの時間) */
export const MAX_ELAPSED_HOURS = 16;
/** 帯グラフで印を付ける眠気の下限 */
export const SLEEPY_MARK_LEVEL = 4;

export type DayType = 'workday' | 'free';

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  workday: '平日',
  free: '自由な日',
};

export const dayTypeOfSleep = (sleep: SleepRecord): DayType => (sleep.alarm ? 'workday' : 'free');

// ---------------------------------------------------------------
// 時刻・日付
// ---------------------------------------------------------------

/** 東京時間でその日の 0:00 の epoch ミリ秒 */
export function tokyoMidnight(ms: number): number {
  return ms - (((ms + TOKYO_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
}

/** 東京時間の時刻を 0:00 からの分(0 以上 1440 未満、小数あり)で */
export function minutesOfDay(ms: number): number {
  return (ms - tokyoMidnight(ms)) / MINUTE_MS;
}

/** 日付キーに n 日足す */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * DAY_MS;
  const dt = new Date(t);
  const pad2 = (v: number) => String(v).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** from から to まで(両端含む)の日付キー。from > to なら空 */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

/**
 * 時刻(0:00 からの分)の円周平均。23:30 と 0:30 の平均は 0:00 になる。
 * 空、または方向が定まらない(例: 0:00 と 12:00)ときは null。
 * 戻り値は 0 以上 1440 未満。
 */
export function circularMeanMinutes(values: number[]): number | null {
  if (values.length === 0) return null;
  let sin = 0;
  let cos = 0;
  for (const m of values) {
    const a = (m / MINUTES_PER_DAY) * 2 * Math.PI;
    sin += Math.sin(a);
    cos += Math.cos(a);
  }
  if (Math.hypot(sin, cos) / values.length < 1e-9) return null;
  let angle = Math.atan2(sin, cos);
  if (angle < 0) angle += 2 * Math.PI;
  const minutes = (angle / (2 * Math.PI)) * MINUTES_PER_DAY;
  // 浮動小数の誤差で 1440 ぎりぎりになったものは 0 とみなす
  return MINUTES_PER_DAY - minutes < 1e-6 ? 0 : minutes;
}

/** 0:00 からの分を 'H:MM' に(分は四捨五入。1440 は 0:00) */
export function formatClockMinutes(minutes: number): string {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// ---------------------------------------------------------------
// 日ごとの要約
// ---------------------------------------------------------------

export interface DaySummary {
  date: string;
  /** null = その日に起きた夜の睡眠がない */
  type: DayType | null;
  /** その日に起きた夜の睡眠のうち最長のもの */
  mainSleep: SleepRecord | null;
  /** その日に起きた睡眠(昼寝込み)の合計 */
  totalSleepMs: number;
}

/** 睡眠を起きた日ごとにまとめる(睡眠のある日だけ入る) */
export function summarizeDays(sleeps: SleepRecord[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();
  for (const s of sleeps) {
    const date = dateKey(s.end);
    let day = map.get(date);
    if (!day) {
      day = { date, type: null, mainSleep: null, totalSleepMs: 0 };
      map.set(date, day);
    }
    const dur = s.end - s.start;
    day.totalSleepMs += dur;
    if (s.kind === 'night' && (!day.mainSleep || dur > day.mainSleep.end - day.mainSleep.start)) {
      day.mainSleep = s;
      day.type = dayTypeOfSleep(s);
    }
  }
  return map;
}

// ---------------------------------------------------------------
// (1) 睡眠の帯グラフ
// ---------------------------------------------------------------

export interface BandSegment {
  date: string;
  /** その日の 0:00 からの分(0〜1440) */
  fromMin: number;
  toMin: number;
  kind: SleepKind;
}

/** 睡眠を日付の境目(東京 0:00)で分割する。0時をまたぐ睡眠は2行に分かれる */
export function splitSleepByDay(sleep: SleepRecord): BandSegment[] {
  const out: BandSegment[] = [];
  let cur = sleep.start;
  while (cur < sleep.end) {
    const dayStart = tokyoMidnight(cur);
    const segEnd = Math.min(sleep.end, dayStart + DAY_MS);
    out.push({
      date: dateKey(cur),
      fromMin: (cur - dayStart) / MINUTE_MS,
      toMin: (segEnd - dayStart) / MINUTE_MS,
      kind: sleep.kind,
    });
    cur = segEnd;
  }
  return out;
}

export interface BandRow {
  date: string;
  /** 行の色分け用。free の行は色を変える */
  type: DayType | null;
  segments: { fromMin: number; toMin: number; kind: SleepKind }[];
  /** 眠気 4 以上の印 */
  sleepyMarks: { min: number; level: number }[];
}

/**
 * 帯グラフの行(1行 = 1日)。記録のある最初の日から最後の日まで、古い日が先頭。
 * 記録がなければ空配列。
 */
export function buildBandRows(sleeps: SleepRecord[], sleepiness: SleepinessRecord[]): BandRow[] {
  const segments = sleeps.flatMap(splitSleepByDay);
  const marks = sleepiness
    .filter((r) => r.level >= SLEEPY_MARK_LEVEL)
    .map((r) => ({ date: dateKey(r.time), min: minutesOfDay(r.time), level: r.level }));

  const keys = [
    ...segments.map((s) => s.date),
    ...sleepiness.map((r) => dateKey(r.time)),
  ];
  if (keys.length === 0) return [];
  keys.sort();
  const days = summarizeDays(sleeps);

  return dateRange(keys[0], keys[keys.length - 1]).map((date) => ({
    date,
    type: days.get(date)?.type ?? null,
    segments: segments
      .filter((s) => s.date === date)
      .map(({ fromMin, toMin, kind }) => ({ fromMin, toMin, kind })),
    sleepyMarks: marks.filter((m) => m.date === date).map(({ min, level }) => ({ min, level })),
  }));
}

// ---------------------------------------------------------------
// (2) 数字の要約(直近14日)
// ---------------------------------------------------------------

export interface PeriodStats {
  /** 集計した日数 */
  days: number;
  /** 平均の寝付き時刻(0:00 からの分、円周平均) */
  meanSleepStartMin: number | null;
  /** 平均の起床時刻(0:00 からの分、円周平均) */
  meanWakeMin: number | null;
  /** 平均の睡眠時間(昼寝込み、ミリ秒) */
  meanTotalSleepMs: number | null;
}

export interface RecentSummary {
  from: string;
  to: string;
  workday: PeriodStats;
  free: PeriodStats;
}

/** today を含む直近 days 日(today-13 〜 today)の平日・自由な日の要約 */
export function recentSummary(sleeps: SleepRecord[], today: string, days = 14): RecentSummary {
  const from = addDays(today, -(days - 1));
  const summaries = [...summarizeDays(sleeps).values()].filter(
    (d) => d.date >= from && d.date <= today && d.type !== null && d.mainSleep !== null,
  );

  const stats = (type: DayType): PeriodStats => {
    const list = summaries.filter((d) => d.type === type);
    if (list.length === 0) {
      return { days: 0, meanSleepStartMin: null, meanWakeMin: null, meanTotalSleepMs: null };
    }
    return {
      days: list.length,
      meanSleepStartMin: circularMeanMinutes(list.map((d) => minutesOfDay(d.mainSleep!.start))),
      meanWakeMin: circularMeanMinutes(list.map((d) => minutesOfDay(d.mainSleep!.end))),
      meanTotalSleepMs: list.reduce((sum, d) => sum + d.totalSleepMs, 0) / list.length,
    };
  };

  return { from, to: today, workday: stats('workday'), free: stats('free') };
}

// ---------------------------------------------------------------
// (3) 眠気のグラフ
// ---------------------------------------------------------------

export interface WakeElapsed {
  /** 起きてからの時間(時間、小数あり)。0〜16 */
  hours: number;
  /** 基準にした起床が平日か自由な日か */
  type: DayType;
}

/**
 * time の直前に終わった夜の睡眠(=その日の起床)からの経過時間。
 * 昼寝は起床の基準にしない。該当する起床がない、または 16 時間を超えるときは null。
 */
export function elapsedSinceWake(time: number, sleeps: SleepRecord[]): WakeElapsed | null {
  let anchor: SleepRecord | null = null;
  for (const s of sleeps) {
    if (s.kind !== 'night' || s.end > time) continue;
    if (!anchor || s.end > anchor.end) anchor = s;
  }
  if (!anchor) return null;
  const hours = (time - anchor.end) / HOUR_MS;
  if (hours > MAX_ELAPSED_HOURS) return null;
  return { hours, type: dayTypeOfSleep(anchor) };
}

export interface SleepinessPoint {
  /** 区間の始まり(0〜15)。区間は [hour, hour+1)、16 ちょうどは 15 に入れる */
  hour: number;
  /** 眠気の平均 */
  mean: number;
  /** 記録件数 */
  count: number;
}

/** 起きてからの経過時間 1 時間ごとの眠気の平均(記録のある区間だけ、hour 昇順) */
export function sleepinessCurve(
  sleeps: SleepRecord[],
  sleepiness: SleepinessRecord[],
): Record<DayType, SleepinessPoint[]> {
  const bins: Record<DayType, { sum: number; count: number }[]> = {
    workday: Array.from({ length: MAX_ELAPSED_HOURS }, () => ({ sum: 0, count: 0 })),
    free: Array.from({ length: MAX_ELAPSED_HOURS }, () => ({ sum: 0, count: 0 })),
  };
  for (const r of sleepiness) {
    const e = elapsedSinceWake(r.time, sleeps);
    if (!e) continue;
    const bin = bins[e.type][Math.min(MAX_ELAPSED_HOURS - 1, Math.floor(e.hours))];
    bin.sum += r.level;
    bin.count += 1;
  }
  const toPoints = (list: { sum: number; count: number }[]): SleepinessPoint[] =>
    list.flatMap((b, hour) => (b.count > 0 ? [{ hour, mean: b.sum / b.count, count: b.count }] : []));
  return { workday: toPoints(bins.workday), free: toPoints(bins.free) };
}
