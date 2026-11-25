import { describe, expect, it } from 'vitest';
import type { SleepinessRecord } from '../types';
import { sleepinessAwaitingEase } from './sleepiness';
import { buildCsv } from './csv';
import { parseBackup } from './backup';

/** 東京時間の 'YYYY-MM-DDTHH:mm' → epoch ms */
const jst = (s: string) => Date.parse(`${s}:00+09:00`);

describe('覚めてきたボタンの対象', () => {
  const rec: SleepinessRecord = { id: 1, time: jst('2026-11-20T14:00'), level: 4 };

  it('最新の眠気で、まだ覚めていなければ対象', () => {
    expect(sleepinessAwaitingEase(rec, jst('2026-11-20T07:00'), null)).toBe(rec);
  });

  it('記録が無ければ null', () => {
    expect(sleepinessAwaitingEase(undefined, null, null)).toBeNull();
  });

  it('覚めてきた時刻が記録済みなら null', () => {
    expect(sleepinessAwaitingEase({ ...rec, easedAt: jst('2026-11-20T15:00') }, null, null)).toBeNull();
  });

  it('眠気1(はっきり)なら null', () => {
    expect(sleepinessAwaitingEase({ ...rec, level: 1 }, null, null)).toBeNull();
  });

  it('その後に睡眠を記録していれば null', () => {
    expect(sleepinessAwaitingEase(rec, jst('2026-11-20T15:30'), null)).toBeNull();
  });

  it('その後に「寝る」を押していれば null', () => {
    expect(sleepinessAwaitingEase(rec, null, jst('2026-11-20T23:00'))).toBeNull();
  });

  it('「寝る」がその眠気より前なら対象のまま', () => {
    expect(sleepinessAwaitingEase(rec, null, jst('2026-11-20T13:00'))).toBe(rec);
  });
});

describe('CSV の覚めてきた時刻', () => {
  it('眠気の行の「終了」に入る。未記録なら空', () => {
    const csv = buildCsv(
      [],
      [
        { time: jst('2026-11-20T14:00'), level: 4, easedAt: jst('2026-11-20T15:20') },
        { time: jst('2026-11-20T18:00'), level: 3 },
      ],
    );
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[1]).toBe('眠気,2026-11-20,2026-11-20 14:00,2026-11-20 15:20,,,,,4');
    expect(lines[2]).toBe('眠気,2026-11-20,2026-11-20 18:00,,,,,,3');
  });
});

describe('バックアップの覚めてきた時刻', () => {
  const file = (sleepiness: unknown[]) =>
    JSON.stringify({ app: 'simple-sleep-diary', version: 1, exportedAt: '', sleeps: [], sleepiness });

  it('ある記録は読み込まれ、無い記録(以前のバックアップ)もそのまま読める', () => {
    const data = parseBackup(
      file([
        { time: 1000, level: 4, easedAt: 5000 },
        { time: 2000, level: 3 },
      ]),
    );
    expect(data.sleepiness).toEqual([
      { time: 1000, level: 4, easedAt: 5000 },
      { time: 2000, level: 3 },
    ]);
  });

  it('眠気の時刻より前なら不正', () => {
    expect(() => parseBackup(file([{ time: 5000, level: 4, easedAt: 1000 }]))).toThrow('覚めてきた時刻');
  });

  it('数値でなければ不正', () => {
    expect(() => parseBackup(file([{ time: 1000, level: 4, easedAt: '15:00' }]))).toThrow('覚めてきた時刻');
  });
});
