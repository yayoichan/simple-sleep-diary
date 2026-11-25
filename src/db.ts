import Dexie, { type EntityTable } from 'dexie';
import type { PendingSleep, SleepinessRecord, SleepRecord } from './types';

/** 端末内(IndexedDB)だけに保存する。外部送信はしない。 */
class SleepDiaryDB extends Dexie {
  sleeps!: EntityTable<SleepRecord, 'id'>;
  sleepiness!: EntityTable<SleepinessRecord, 'id'>;
  pending!: EntityTable<PendingSleep, 'key'>;

  constructor() {
    super('simple-sleep-diary');
    this.version(1).stores({
      sleeps: '++id, start, end',
      sleepiness: '++id, time',
      pending: 'key',
    });
  }
}

export const db = new SleepDiaryDB();

// ---- 「寝る」で仮保存した寝付き時刻 ----

export async function getPendingSleepStart(): Promise<number | null> {
  const row = await db.pending.get('sleepStart');
  return row ? row.time : null;
}

export async function setPendingSleepStart(time: number): Promise<void> {
  await db.pending.put({ key: 'sleepStart', time });
}

export async function clearPendingSleepStart(): Promise<void> {
  await db.pending.delete('sleepStart');
}
