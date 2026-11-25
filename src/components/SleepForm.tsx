import { useState } from 'react';
import { RATINGS, SLEEP_KIND_LABEL } from '../types';
import type { Rating, SleepKind, SleepRecord } from '../types';
import { formatDuration, fromInputValue, toInputValue } from '../lib/time';
import { Sheet } from './Sheet';
import './forms.css';

export interface SleepDraft {
  start: number | null;
  end: number | null;
  kind: SleepKind | null;
  alarm: boolean | null;
  refreshed: Rating | null;
}

export interface SleepFormProps {
  title: string;
  initial: SleepDraft;
  onSubmit: (rec: Omit<SleepRecord, 'id'>) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void | Promise<void>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function SleepForm({ title, initial, onSubmit, onCancel, onDelete }: SleepFormProps) {
  const [startStr, setStartStr] = useState(initial.start != null ? toInputValue(initial.start) : '');
  const [endStr, setEndStr] = useState(initial.end != null ? toInputValue(initial.end) : '');
  const [kind, setKind] = useState<SleepKind | null>(initial.kind);
  const [alarm, setAlarm] = useState<boolean | null>(initial.alarm);
  const [refreshed, setRefreshed] = useState<Rating | null>(initial.refreshed);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = fromInputValue(startStr);
  const end = fromInputValue(endStr);
  const duration = start != null && end != null && end > start ? end - start : null;

  async function handleSave() {
    if (busy) return;
    if (start == null || end == null) {
      setError('寝付いた時刻と起きた時刻を入力してください');
      return;
    }
    if (end <= start) {
      setError('起きた時刻が寝付いた時刻より前になっています。日付を確認してください');
      return;
    }
    if (end - start > DAY_MS) {
      setError('睡眠が24時間を超えています。日付を確認してください');
      return;
    }
    if (kind == null || alarm == null || refreshed == null) {
      setError('種類・目覚まし・すっきり度を選んでください');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit({ start, end, kind, alarm, refreshed });
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
        <label className="field-label" htmlFor="sleep-start">寝付いた時刻</label>
        <input
          id="sleep-start"
          type="datetime-local"
          className="input"
          value={startStr}
          onChange={(e) => setStartStr(e.target.value)}
        />
        <p className="hint">推定でよい</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="sleep-end">起きた時刻</label>
        <input
          id="sleep-end"
          type="datetime-local"
          className="input"
          value={endStr}
          onChange={(e) => setEndStr(e.target.value)}
        />
      </div>

      {duration != null && <p className="hint">睡眠時間 {formatDuration(duration)}</p>}

      <div className="field">
        <span className="field-label">種類</span>
        <div className="choice-group">
          {(['night', 'nap'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className="choice"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {SLEEP_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">目覚まし</span>
        <div className="choice-group">
          <button type="button" className="choice" aria-pressed={alarm === true} onClick={() => setAlarm(true)}>
            使った
          </button>
          <button type="button" className="choice" aria-pressed={alarm === false} onClick={() => setAlarm(false)}>
            使わなかった
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">すっきり度</span>
        <div className="choice-group">
          {RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              className="choice"
              aria-pressed={refreshed === n}
              onClick={() => setRefreshed(n)}
            >
              {n}
              {n === 1 && <small>すっきりしない</small>}
              {n === 5 && <small>すっきり</small>}
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
