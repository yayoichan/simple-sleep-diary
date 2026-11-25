import type { SleepinessRecord } from '../types';

/**
 * ホームに「覚めてきた」ボタンを出す対象の眠気記録を返す。なければ null。
 *
 * 対象は最新の眠気記録1件だけで、次のときは出さない。
 * - すでに覚めてきた時刻が記録されている
 * - 眠気が 1(はっきり)で、覚めるものがない
 * - その後に睡眠が記録されている、または「寝る」を押している(眠気は睡眠で終わった)
 */
export function sleepinessAwaitingEase(
  latest: SleepinessRecord | undefined,
  latestSleepEnd: number | null,
  pendingSleepStart: number | null,
): SleepinessRecord | null {
  if (!latest || latest.easedAt != null) return null;
  if (latest.level === 1) return null;
  if (latestSleepEnd != null && latestSleepEnd > latest.time) return null;
  if (pendingSleepStart != null && pendingSleepStart >= latest.time) return null;
  return latest;
}
