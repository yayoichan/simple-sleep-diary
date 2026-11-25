import { useRef, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { backupFileName, createBackup, parseBackup, restoreBackup } from '../lib/backup';
import { buildCsv, csvFileName } from '../lib/csv';
import { downloadBlob } from '../lib/download';
import { useToast } from './Toast';
import './BackupPanel.css';

export function BackupPanel() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const sleepCount = useLiveQuery(() => db.sleeps.count(), []);
  const sleepinessCount = useLiveQuery(() => db.sleepiness.count(), []);

  async function handleSave() {
    setError(null);
    try {
      const data = await createBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, backupFileName());
      toast('バックアップを保存しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'バックアップの保存に失敗しました');
    }
  }

  async function handleCsv() {
    setError(null);
    try {
      const [sleeps, sleepiness] = await Promise.all([db.sleeps.toArray(), db.sleepiness.toArray()]);
      const blob = new Blob([buildCsv(sleeps, sleepiness)], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, csvFileName());
      toast('CSVを書き出しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSVの書き出しに失敗しました');
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const data = parseBackup(await file.text());
      const ok = window.confirm(
        `睡眠 ${data.sleeps.length}件・眠気 ${data.sleepiness.length}件 のバックアップで復元します。\n今の記録はすべて置き換えられます。よろしいですか？`,
      );
      if (ok) {
        await restoreBackup(data);
        toast('復元しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '復元に失敗しました');
    } finally {
      input.value = '';
    }
  }

  return (
    <section className="card backup-panel">
      <h2>書き出し・バックアップ</h2>
      <p className="hint">記録はこの端末の中だけに保存されています。</p>
      <p className="hint backup-count">
        睡眠 {sleepCount ?? 0}件・眠気 {sleepinessCount ?? 0}件
      </p>
      <button type="button" className="btn btn-block" onClick={handleCsv}>
        CSVで書き出す(全記録)
      </button>
      <button type="button" className="btn btn-block" onClick={handleSave}>
        バックアップを保存(JSON)
      </button>
      <button type="button" className="btn btn-block" onClick={() => fileInput.current?.click()}>
        バックアップから復元
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleFile}
      />
      {error && <p className="error">{error}</p>}
    </section>
  );
}
