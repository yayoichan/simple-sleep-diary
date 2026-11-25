import { useMemo } from 'react';
import type { SleepinessRecord, SleepRecord } from '../../types';
import { buildBandRows, MINUTES_PER_DAY } from '../../lib/stats';
import './BandChart.css';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const W = 360;
const LABEL_W = 56;
const PLOT_X = LABEL_W;
const PLOT_W = W - LABEL_W - 8;
const TOP = 16;
const ROW_H = 14;
const BOTTOM_AXIS = 16;
const BOTTOM_AXIS_MIN_ROWS = 12;
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const LABEL_HOURS = [0, 6, 12, 18, 24];

const xOf = (min: number) => PLOT_X + (Math.min(Math.max(min, 0), MINUTES_PER_DAY) / MINUTES_PER_DAY) * PLOT_W;

function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${wd})`;
}

export function BandChart({ sleeps, sleepiness }: { sleeps: SleepRecord[]; sleepiness: SleepinessRecord[] }) {
  const rows = useMemo(() => buildBandRows(sleeps, sleepiness), [sleeps, sleepiness]);

  if (rows.length === 0) return <p className="hint">まだ記録がありません</p>;

  const plotH = rows.length * ROW_H;
  const showBottom = rows.length >= BOTTOM_AXIS_MIN_ROWS;
  const height = TOP + plotH + (showBottom ? BOTTOM_AXIS : 4);

  const axis = (y: number) =>
    LABEL_HOURS.map((h) => (
      <text key={h} className="band-axis-text" x={xOf(h * 60)} y={y} textAnchor="middle">
        {h}
      </text>
    ));

  return (
    <div className="band-chart">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label="睡眠の帯グラフ(1行1日、横軸は0時から24時)"
      >
        {rows.map((row, i) => {
          const y = TOP + i * ROW_H;
          return (
            <g key={row.date}>
              {row.type === 'free' && (
                <rect className="band-free-row" x={PLOT_X} y={y} width={PLOT_W} height={ROW_H} />
              )}
              <text className="band-axis-text band-date" x={LABEL_W - 4} y={y + ROW_H / 2 + 3} textAnchor="end">
                {dateLabel(row.date)}
              </text>
            </g>
          );
        })}
        {HOURS.map((h) => (
          <line key={h} className="band-grid" x1={xOf(h * 60)} x2={xOf(h * 60)} y1={TOP} y2={TOP + plotH} />
        ))}
        {rows.map((row, i) => (
          <line
            key={row.date}
            className="band-grid band-sep"
            x1={PLOT_X}
            x2={PLOT_X + PLOT_W}
            y1={TOP + (i + 1) * ROW_H}
            y2={TOP + (i + 1) * ROW_H}
          />
        ))}
        {rows.map((row, i) => {
          const y = TOP + i * ROW_H;
          return (
            <g key={row.date}>
              {row.segments.map((s, j) => (
                <rect
                  key={j}
                  className="band-sleep"
                  x={xOf(s.fromMin)}
                  y={y + 2}
                  width={Math.max(xOf(s.toMin) - xOf(s.fromMin), 0.5)}
                  height={ROW_H - 4}
                />
              ))}
              {row.sleepyMarks.map((m, j) => {
                const cx = xOf(m.min);
                return (
                  <polygon
                    key={j}
                    className="band-sleepy"
                    points={`${cx - 3.2},${y + 2.5} ${cx + 3.2},${y + 2.5} ${cx},${y + ROW_H - 2.5}`}
                  />
                );
              })}
            </g>
          );
        })}
        {axis(TOP - 5)}
        {showBottom && axis(TOP + plotH + 11)}
      </svg>
      <div className="band-legend">
        <span className="band-legend-item">
          <i className="band-swatch band-swatch-sleep" />
          睡眠
        </span>
        <span className="band-legend-item">
          <i className="band-swatch band-swatch-sleepy" />
          眠気4以上
        </span>
        <span className="band-legend-item">
          <i className="band-swatch band-swatch-free" />
          自由な日(目覚ましなし)
        </span>
      </div>
    </div>
  );
}
