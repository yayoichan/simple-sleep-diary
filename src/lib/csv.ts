import type { SleepinessRecord, SleepRecord } from '../types';
import { SLEEP_KIND_LABEL } from '../types';
import { dateKey, tokyoParts } from './time';

const pad2 = (n: number) => String(n).padStart(2, '0');

const HEADER = ['記録', '日付', '開始', '終了', '睡眠時間(分)', '種類', '目覚まし', 'すっきり度', '眠気'];

function dateTime(ms: number): string {
  const p = tokyoParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

function field(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 全記録を1つのCSVに(BOM付き・CRLF・時系列順) */
export function buildCsv(sleeps: SleepRecord[], sleepiness: SleepinessRecord[]): string {
  const rows: { at: number; cols: (string | number)[] }[] = [];
  for (const s of sleeps) {
    rows.push({
      at: s.start,
      cols: [
        '睡眠',
        dateKey(s.end),
        dateTime(s.start),
        dateTime(s.end),
        Math.round((s.end - s.start) / 60000),
        SLEEP_KIND_LABEL[s.kind],
        s.alarm ? '使った' : '使わなかった',
        s.refreshed,
        '',
      ],
    });
  }
  for (const s of sleepiness) {
    rows.push({
      at: s.time,
      // 眠気の「終了」は、その眠気が覚めてきた時刻(未記録なら空)
      cols: [
        '眠気',
        dateKey(s.time),
        dateTime(s.time),
        s.easedAt != null ? dateTime(s.easedAt) : '',
        '',
        '',
        '',
        '',
        s.level,
      ],
    });
  }
  rows.sort((a, b) => a.at - b.at);
  const lines = [HEADER, ...rows.map((r) => r.cols)].map((cols) => cols.map(field).join(','));
  // 先頭の BOM は Excel で日本語を正しく開くため
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** sleep-diary-YYYYMMDD-HHmm.csv(東京時間) */
export function csvFileName(now = Date.now()): string {
  const p = tokyoParts(now);
  return `sleep-diary-${p.year}${pad2(p.month)}${pad2(p.day)}-${pad2(p.hour)}${pad2(p.minute)}.csv`;
}
