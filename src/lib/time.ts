/**
 * 時刻ユーティリティ(タイムゾーンは Asia/Tokyo 固定)。
 * 日本は夏時間がないので +09:00 の固定オフセットで変換する。
 * 保存値は常に epoch ミリ秒。
 */

const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

interface TokyoParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=日
}

export function tokyoParts(ms: number): TokyoParts {
  const d = new Date(ms + TOKYO_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

/** 現在時刻(秒以下を切り捨て) */
export function nowMinute(): number {
  return Math.floor(Date.now() / 60000) * 60000;
}

/** <input type="datetime-local"> 用の値 'YYYY-MM-DDTHH:mm'(東京時間) */
export function toInputValue(ms: number): string {
  const p = tokyoParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** 'YYYY-MM-DDTHH:mm'(東京時間)を epoch ミリ秒に。不正なら null */
export function fromInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(utc)) return null;
  return utc - TOKYO_OFFSET_MS;
}

/** 日付キー 'YYYY-MM-DD'(東京時間) */
export function dateKey(ms: number): string {
  const p = tokyoParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** 日付キーの表示 '11月25日(火)' */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}月${d}日(${WEEKDAYS[wd]})`;
}

/** '23:41' */
export function formatTime(ms: number): string {
  const p = tokyoParts(ms);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** '11/25 23:41' */
export function formatDateTime(ms: number): string {
  const p = tokyoParts(ms);
  return `${p.month}/${p.day} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** '7時間30分' */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min}分`;
  return min === 0 ? `${h}時間` : `${h}時間${min}分`;
}
