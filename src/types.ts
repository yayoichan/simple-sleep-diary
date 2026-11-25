/** 1〜5 の評価(すっきり度・眠気の強さ) */
export type Rating = 1 | 2 | 3 | 4 | 5;

export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

/** 睡眠の種類 */
export type SleepKind = 'night' | 'nap';

export const SLEEP_KIND_LABEL: Record<SleepKind, string> = {
  night: '夜の睡眠',
  nap: '昼寝',
};

/**
 * 睡眠の記録。
 * 時刻はすべて epoch ミリ秒(UTC 基準の絶対時刻)で保存し、表示時に Asia/Tokyo に変換する。
 * 0時をまたぐ睡眠は start と end の日付が違うだけで、特別扱いはしない。
 */
export interface SleepRecord {
  id?: number;
  /** 寝付いた時刻(推定でよい) */
  start: number;
  /** 起きた時刻 */
  end: number;
  kind: SleepKind;
  /** 目覚ましを使ったか(false の日を「自由な日」とみなす) */
  alarm: boolean;
  /** すっきり度 1〜5 */
  refreshed: Rating;
}

/** 眠気の記録 */
export interface SleepinessRecord {
  id?: number;
  /** 記録した時刻 */
  time: number;
  /** 眠気の強さ 1〜5(1=はっきり、5=起きていられない) */
  level: Rating;
}

export const SLEEPINESS_LABEL: Record<Rating, string> = {
  1: 'はっきり',
  2: 'ややはっきり',
  3: 'ふつう',
  4: '眠い',
  5: '起きていられない',
};

/** 「寝る」ボタンで仮保存した寝付き時刻の候補(1件だけ) */
export interface PendingSleep {
  key: 'sleepStart';
  time: number;
}
