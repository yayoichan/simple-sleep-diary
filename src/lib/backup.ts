import { db } from '../db';
import type { Rating, SleepinessRecord, SleepKind, SleepRecord } from '../types';
import { tokyoParts } from './time';

export interface BackupFile {
  app: 'simple-sleep-diary';
  version: 1;
  exportedAt: string; // ISO 8601
  sleeps: Omit<SleepRecord, 'id'>[];
  sleepiness: Omit<SleepinessRecord, 'id'>[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export async function createBackup(): Promise<BackupFile> {
  const [sleeps, sleepiness] = await Promise.all([db.sleeps.toArray(), db.sleepiness.toArray()]);
  return {
    app: 'simple-sleep-diary',
    version: 1,
    exportedAt: new Date().toISOString(),
    sleeps: sleeps.map((s) => ({
      start: s.start,
      end: s.end,
      kind: s.kind,
      alarm: s.alarm,
      refreshed: s.refreshed,
    })),
    sleepiness: sleepiness.map((s) =>
      s.easedAt != null ? { time: s.time, level: s.level, easedAt: s.easedAt } : { time: s.time, level: s.level },
    ),
  };
}

/** sleep-diary-backup-YYYYMMDD-HHmm.json(東京時間) */
export function backupFileName(now = Date.now()): string {
  const p = tokyoParts(now);
  return `sleep-diary-backup-${p.year}${pad2(p.month)}${pad2(p.day)}-${pad2(p.hour)}${pad2(p.minute)}.json`;
}

function fail(reason: string): never {
  throw new Error(`バックアップファイルの形式が正しくありません(${reason})`);
}

const isRating = (v: unknown): v is Rating =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    fail('JSONとして読めません');
  }
  if (!isObj(raw)) fail('データがオブジェクトではありません');
  if (raw.app !== 'simple-sleep-diary') fail('このアプリのバックアップではありません');
  if (raw.version !== 1) fail('未対応のバージョンです');
  if (!Array.isArray(raw.sleeps) || !Array.isArray(raw.sleepiness)) {
    fail('記録の一覧がありません');
  }

  const sleeps: BackupFile['sleeps'] = raw.sleeps.map((item: unknown, i: number) => {
    if (!isObj(item)) fail(`睡眠 ${i + 1}件目が不正です`);
    const { start, end, kind, alarm, refreshed } = item;
    if (!isFiniteNum(start) || !isFiniteNum(end)) fail(`睡眠 ${i + 1}件目の時刻が不正です`);
    if (end <= start) fail(`睡眠 ${i + 1}件目の終了が開始以前です`);
    if (kind !== 'night' && kind !== 'nap') fail(`睡眠 ${i + 1}件目の種類が不正です`);
    if (typeof alarm !== 'boolean') fail(`睡眠 ${i + 1}件目の目覚ましが不正です`);
    if (!isRating(refreshed)) fail(`睡眠 ${i + 1}件目のすっきり度が不正です`);
    return { start, end, kind: kind as SleepKind, alarm, refreshed };
  });

  const sleepiness: BackupFile['sleepiness'] = raw.sleepiness.map((item: unknown, i: number) => {
    if (!isObj(item)) fail(`眠気 ${i + 1}件目が不正です`);
    const { time, level, easedAt } = item;
    if (!isFiniteNum(time)) fail(`眠気 ${i + 1}件目の時刻が不正です`);
    if (!isRating(level)) fail(`眠気 ${i + 1}件目の強さが不正です`);
    // 覚めてきた時刻は後から追加した項目なので、無くてもよい
    if (easedAt === undefined || easedAt === null) return { time, level };
    if (!isFiniteNum(easedAt) || easedAt < time) fail(`眠気 ${i + 1}件目の覚めてきた時刻が不正です`);
    return { time, level, easedAt };
  });

  return {
    app: 'simple-sleep-diary',
    version: 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    sleeps,
    sleepiness,
  };
}

/** 全置き換え。pending テーブルには触らない。 */
export async function restoreBackup(data: BackupFile): Promise<void> {
  await db.transaction('rw', db.sleeps, db.sleepiness, async () => {
    await db.sleeps.clear();
    await db.sleepiness.clear();
    await db.sleeps.bulkAdd(data.sleeps.map((s) => ({ ...s })));
    await db.sleepiness.bulkAdd(data.sleepiness.map((s) => ({ ...s })));
  });
}
