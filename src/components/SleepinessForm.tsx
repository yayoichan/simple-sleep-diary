import { useState } from 'react';
import { RATINGS, SLEEPINESS_LABEL } from '../types';
import type { Rating, SleepinessRecord } from '../types';
import { fromInputValue, toInputValue } from '../lib/time';
import { Sheet } from './Sheet';
import './forms.css';

export interface SleepinessDraft {
  time: number | null;
  level: Rating | null;
}

export interface SleepinessFormProps {
  title: string;
  initial: SleepinessDraft;
  onSubmit: (rec: Omit<SleepinessRecord, 'id'>) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

export function SleepinessForm({ title, initial, onSubmit, onCancel, onDelete }: SleepinessFormProps) {
  const [timeStr, setTimeStr] = useState(initial.time != null ? toInputValue(initial.time) : '');
  const [level, setLevel] = useState<Rating | null>(initial.level);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (busy) return;
    const time = fromInputValue(timeStr);
    if (time == null) {
      setError('時刻を入力してください');
      return;
    }
    if (level == null) {
      setError('眠気の強さを選んでください');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit({ time, level });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy || !onDelete) return;
    if (!window.confirm('この記録を削除しますか？')) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onCancel}>
      <div className="field">
        <label className="field-label" htmlFor="sleepiness-time">時刻</label>
        <input
          id="sleepiness-time"
          type="datetime-local"
          className="input"
          value={timeStr}
          onChange={(e) => setTimeStr(e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field-label">眠気の強さ</span>
        <div className="choice-group">
          {RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              className="choice"
              aria-pressed={level === n}
              onClick={() => setLevel(n)}
            >
              {n}
              {(n === 1 || n === 5) && <small>{SLEEPINESS_LABEL[n]}</small>}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={handleSave}>
        保存
      </button>
      {onDelete && (
        <button
          type="button"
          className="btn btn-danger btn-block form-delete"
          disabled={busy}
          onClick={handleDelete}
        >
          削除
        </button>
      )}
    </Sheet>
  );
}
