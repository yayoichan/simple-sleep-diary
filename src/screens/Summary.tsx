import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dateKey } from '../lib/time';
import { BandChart } from '../components/summary/BandChart';
import { SleepinessChart } from '../components/summary/SleepinessChart';
import { SummaryTable } from '../components/summary/SummaryTable';
import './Summary.css';

export function Summary() {
  const sleeps = useLiveQuery(() => db.sleeps.toArray(), []);
  const sleepiness = useLiveQuery(() => db.sleepiness.toArray(), []);

  const loaded = sleeps !== undefined && sleepiness !== undefined;
  const [y, m, d] = dateKey(Date.now()).split('-');

  return (
    <div className="summary-screen">
      <div className="summary-title-row no-print">
        <h1 className="screen-title">まとめ</h1>
        <button type="button" className="btn no-print" onClick={() => window.print()}>
          印刷する
        </button>
      </div>
      <p className="hint no-print">ブラウザの印刷から PDF にできます</p>

      <div className="print-only summary-print-header">
        <p className="summary-print-title">睡眠日誌 まとめ</p>
        <p>
          出力日 {y}/{m}/{d}
        </p>
      </div>

      {loaded && (
        <>
          <section className="card summary-section">
            <h2 className="summary-heading">睡眠の帯グラフ</h2>
            <BandChart sleeps={sleeps} sleepiness={sleepiness} />
          </section>
          <section className="card summary-section">
            <h2 className="summary-heading">数字の要約(直近14日)</h2>
            <SummaryTable sleeps={sleeps} />
          </section>
          <section className="card summary-section">
            <h2 className="summary-heading">眠気のグラフ</h2>
            <SleepinessChart sleeps={sleeps} sleepiness={sleepiness} />
          </section>
        </>
      )}

      <p className="summary-note">この表示は記録からの目安です。治療の判断は主治医と相談してください。</p>
    </div>
  );
}
