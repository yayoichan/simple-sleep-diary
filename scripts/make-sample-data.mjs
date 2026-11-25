// 開発用: 4週間分のサンプルデータをバックアップJSON形式で生成する。
// 使い方: npm run sample  または  node scripts/make-sample-data.mjs <出力パス>
import { writeFileSync } from 'node:fs';

const OFFSET = 9 * 3600 * 1000; // Asia/Tokyo 固定 +09:00
const MIN = 60000;
const HOUR = 3600000;
const DAY = 86400000;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260101);
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1)); // 両端含む
/** 5分刻みで [fromMin, toMin] 分(0時基準)から選ぶ */
const randStep5 = (fromMin, toMin) => randInt(fromMin / 5, toMin / 5) * 5;

const outPath = process.argv[2] ?? 'sample-data.json';

// 東京の今日 0:00 を epoch ms で
const tokyoNow = new Date(Date.now() + OFFSET);
const todayMidnight = Date.UTC(tokyoNow.getUTCFullYear(), tokyoNow.getUTCMonth(), tokyoNow.getUTCDate()) - OFFSET;

// 東京の日付 dayStart(0:00の epoch ms) の minutes 分後
const at = (dayStart, minutes) => dayStart + minutes * MIN;

const sleeps = [];
for (let i = 28; i >= 1; i--) {
  const dayStart = todayMidnight - i * DAY; // wake date D の 0:00(東京)
  const weekday = new Date(dayStart + OFFSET).getUTCDay();
  const free = weekday === 0 || weekday === 6;
  if (free) {
    sleeps.push({
      start: at(dayStart, randStep5(360, 480)),
      end: at(dayStart, randStep5(840, 960)),
      kind: 'night',
      alarm: false,
      refreshed: randInt(3, 5),
    });
  } else {
    sleeps.push({
      start: at(dayStart, randStep5(120, 240)),
      end: at(dayStart, 390),
      kind: 'night',
      alarm: true,
      refreshed: randInt(1, 3),
    });
  }
}

const sleepiness = [];
for (let i = 0; i < sleeps.length; i++) {
  const wake = sleeps[i].end;
  const limit = Math.min(wake + 16 * HOUR, i + 1 < sleeps.length ? sleeps[i + 1].start - 1 : Infinity);
  for (let h = 0; h <= 15; h++) {
    if (rand() >= 0.6) continue;
    const time = wake + h * HOUR + randStep5(0, 55) * MIN;
    if (time > limit) continue;
    const elapsedH = (time - wake) / HOUR;
    const level = elapsedH >= 1 && elapsedH <= 7 ? randInt(4, 5) : randInt(2, 3);
    sleepiness.push({ time, level });
  }
}

const data = {
  app: 'simple-sleep-diary',
  version: 1,
  exportedAt: new Date().toISOString(),
  sleeps,
  sleepiness,
};
writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`サンプルデータを作成しました: ${outPath}`);
console.log(`  睡眠 ${sleeps.length}件・眠気 ${sleepiness.length}件(直近28日分)`);
console.log('読み込み方: アプリの 記録一覧 → 書き出し・バックアップ → バックアップから復元 で、このファイルを選んでください。');
console.log('(今の記録はすべて置き換えられます)');
