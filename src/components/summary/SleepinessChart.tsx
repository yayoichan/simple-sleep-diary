import { useMemo } from 'react';
import type { SleepinessRecord, SleepRecord } from '../../types';
import { MAX_ELAPSED_HOURS, sleepinessCurve } from '../../lib/stats';
import type { DayType, SleepinessPoint } from '../../lib/stats';
import './SleepinessChart.css';

const W = 360;
const H = 220;
const M = { left: 36, right: 12, top: 12, bottom: 44 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const Y_MIN = 1;
const Y_MAX = 5;

const xOf = (hours: number) => M.left + (hours / MAX_ELAPSED_HOURS) * PLOT_W;
const yOf = (level: number) => {
  const v = Math.min(Y_MAX, Math.max(Y_MIN, level));
  return M.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
};

const X_TICKS = Array.from({ length: MAX_ELAPSED_HOURS / 2 + 1 }, (_, i) => i * 2);
const Y_TICKS = [1, 2, 3, 4, 5];

/** 隣り合う区間(hour の差が 1)だけをつないだ折れ線の点列 */
function segments(points: SleepinessPoint[]): SleepinessPoint[][] {
  const out: SleepinessPoint[][] = [];
  let cur: SleepinessPoint[] = [];
  for (const p of points) {
    if (cur.length > 0 && p.hour - cur[cur.length - 1].hour !== 1) {
      out.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function Series({ type, points }: { type: DayType; points: SleepinessPoint[] }) {
  const isFree = type === 'free';
  const pos = (p: SleepinessPoint) => ({ x: xOf(p.hour + 0.5), y: yOf(p.mean) });
  return (
    <g className={`sleepiness-series sleepiness-series--${type}`}>
      {segments(points)
        .filter((seg) => seg.length > 1)
        .map((seg) => (
          <polyline
            key={seg[0].hour}
            className="sleepiness-line"
            points={seg
              .map((p) => {
                const { x, y } = pos(p);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ')}
          />
        ))}
      {points.map((p) => {
        const { x, y } = pos(p);
        return (
          <g key={p.hour}>
            {isFree ? (
              <rect className="sleepiness-marker" x={x - 3} y={y - 3} width={6} height={6} />
            ) : (
              <circle className="sleepiness-marker" cx={x} cy={y} r={3.3} />
            )}
            <text
              className="sleepiness-count"
              x={x}
              y={isFree ? y + 12 : y - 6}
              textAnchor="middle"
            >
              {p.count}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function SleepinessChart(props: { sleeps: SleepRecord[]; sleepiness: SleepinessRecord[] }) {
  const { sleeps, sleepiness } = props;
  const curve = useMemo(() => sleepinessCurve(sleeps, sleepiness), [sleeps, sleepiness]);

  if (curve.workday.length === 0 && curve.free.length === 0) {
    return <p className="hint">眠気の記録がまだありません</p>;
  }

  return (
    <div className="sleepiness-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="起きてからの時間ごとの眠気の平均。平日と自由な日の2本の線"
      >
        {Y_TICKS.map((v) => (
          <g key={v}>
            <line className="sleepiness-grid" x1={M.left} x2={W - M.right} y1={yOf(v)} y2={yOf(v)} />
            <text className="sleepiness-axis-text" x={M.left - 6} y={yOf(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {X_TICKS.map((h) => (
          <g key={h}>
            <line
              className="sleepiness-tick"
              x1={xOf(h)}
              x2={xOf(h)}
              y1={M.top + PLOT_H}
              y2={M.top + PLOT_H + 4}
            />
            <text
              className="sleepiness-axis-text"
              x={xOf(h)}
              y={M.top + PLOT_H + 15}
              textAnchor="middle"
            >
              {h}
            </text>
          </g>
        ))}
        <line
          className="sleepiness-axis"
          x1={M.left}
          x2={W - M.right}
          y1={M.top + PLOT_H}
          y2={M.top + PLOT_H}
        />
        <text
          className="sleepiness-axis-title"
          x={M.left + PLOT_W / 2}
          y={H - 6}
          textAnchor="middle"
        >
          起きてからの時間(時間)
        </text>
        <text
          className="sleepiness-axis-title"
          transform={`translate(10 ${M.top + PLOT_H / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          眠気
        </text>
        <Series type="workday" points={curve.workday} />
        <Series type="free" points={curve.free} />
      </svg>

      <ul className="sleepiness-legend">
        <li>
          <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
            <line className="sleepiness-line sleepiness-legend-workday" x1="2" x2="26" y1="5" y2="5" />
            <circle className="sleepiness-marker sleepiness-legend-workday" cx="14" cy="5" r="3" />
          </svg>
          平日(目覚ましあり)
        </li>
        <li>
          <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
            <line className="sleepiness-line sleepiness-legend-free" x1="2" x2="26" y1="5" y2="5" />
            <rect className="sleepiness-marker sleepiness-legend-free" x="11" y="2" width="6" height="6" />
          </svg>
          自由な日(目覚ましなし)
        </li>
      </ul>
      <p className="sleepiness-note">眠気 1=少し眠い、5=起きていられない。点の横の数字は記録件数</p>
    </div>
  );
}
