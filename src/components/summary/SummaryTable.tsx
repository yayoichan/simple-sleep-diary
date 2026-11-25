import { useMemo } from 'react';
import type { SleepRecord } from '../../types';
import {
  DAY_TYPE_LABEL,
  MIN_FREE_DAYS,
  formatClockMinutes,
  recentSummary,
  type PeriodStats,
} from '../../lib/stats';
import { dateKey, formatDuration } from '../../lib/time';

const DASH = '—';
const SHORT = 'データ不足';

/** '2026-11-12' -> '11/12' */
function shortDate(key: string): string {
  const [, m, d] = key.split('-').map(Number);
  return `${m}/${d}`;
}

type Row = { label: string; pick: (p: PeriodStats) => string };

const fmt = (v: number | null, f: (n: number) => string) => (v === null ? DASH : f(v));

const ROWS: Row[] = [
  { label: '平均の寝付き時刻', pick: (p) => fmt(p.meanSleepStartMin, formatClockMinutes) },
  { label: '平均の起床時刻', pick: (p) => fmt(p.meanWakeMin, formatClockMinutes) },
  { label: '平均の睡眠時間(昼寝込み)', pick: (p) => fmt(p.meanTotalSleepMs, formatDuration) },
];

export function SummaryTable({ sleeps }: { sleeps: SleepRecord[] }) {
  const s = useMemo(() => recentSummary(sleeps, dateKey(Date.now())), [sleeps]);
  const freeShort = s.free.days < MIN_FREE_DAYS;

  return (
    <div className="summary-table-wrap">
      <p className="summary-table-caption">
        {shortDate(s.from)}〜{shortDate(s.to)}
      </p>
      <p className="hint">平日=目覚ましを使った日、自由な日=使わなかった日</p>
      <table className="summary-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only-cell">項目</span>
            </th>
            <th scope="col">
              {DAY_TYPE_LABEL.workday}({s.workday.days}日)
            </th>
            <th scope="col">
              {DAY_TYPE_LABEL.free}({s.free.days}日)
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{s.workday.days === 0 ? DASH : r.pick(s.workday)}</td>
              <td>{freeShort ? SHORT : r.pick(s.free)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
