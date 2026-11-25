import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  SLEEPINESS_LABEL,
  SLEEP_KIND_LABEL,
  type SleepRecord,
  type SleepinessRecord,
} from '../types';
import { dateKey, formatDateKey, formatDateTime, formatDuration, formatTime, nowMinute } from '../lib/time';
import { SleepForm } from '../components/SleepForm';
import { SleepinessForm } from '../components/SleepinessForm';
import { useToast } from '../components/Toast';
import './RecordList.css';

type OpenForm =
  | { type: 'none' }
  | { type: 'sleep-add' }
  | { type: 'sleep-edit'; record: SleepRecord }
  | { type: 'sleepiness-add' }
  | { type: 'sleepiness-edit'; record: SleepinessRecord };

type Item =
  | { kind: 'sleep'; at: number; record: SleepRecord }
  | { kind: 'sleepiness'; at: number; record: SleepinessRecord };

export function RecordList() {
  const sleeps = useLiveQuery(() => db.sleeps.toArray(), []);
  const sleepiness = useLiveQuery(() => db.sleepiness.toArray(), []);
  const toast = useToast();
  const [open, setOpen] = useState<OpenForm>({ type: 'none' });

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (key: string, item: Item) => {
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    };
    for (const r of sleeps ?? []) push(dateKey(r.end), { kind: 'sleep', at: r.start, record: r });
    for (const r of sleepiness ?? []) push(dateKey(r.time), { kind: 'sleepiness', at: r.time, record: r });
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([key, items]) => ({ key, items: items.sort((a, b) => a.at - b.at) }));
  }, [sleeps, sleepiness]);

  const close = () => setOpen({ type: 'none' });
  const loading = sleeps === undefined || sleepiness === undefined;

  return (
    <section>
      <h1 className="screen-title">記録一覧</h1>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setOpen({ type: 'sleep-add' })}>
          ＋ 睡眠を追加
        </button>
        <button type="button" className="btn" onClick={() => setOpen({ type: 'sleepiness-add' })}>
          ＋ 眠気を追加
        </button>
      </div>

      {!loading && groups.length === 0 && <p className="hint record-empty">まだ記録がありません</p>}

      {groups.map((g) => (
        <div key={g.key} className="record-group">
          <h2 className="record-date">{formatDateKey(g.key)}</h2>
          <div className="record-items">
            {g.items.map((item) =>
              item.kind === 'sleep' ? (
                <button
                  key={`s${item.record.id}`}
                  type="button"
                  className="record-row"
                  onClick={() => setOpen({ type: 'sleep-edit', record: item.record })}
                >
                  <span className="record-main">
                    <span className="record-kind">{SLEEP_KIND_LABEL[item.record.kind]}</span>
                    <span className="record-range">
                      {dateKey(item.record.start) === g.key
                        ? formatTime(item.record.start)
                        : formatDateTime(item.record.start)}{' '}
                      → {formatTime(item.record.end)}
                    </span>
                  </span>
                  <span className="record-sub">
                    {formatDuration(item.record.end - item.record.start)}・目覚まし{' '}
                    {item.record.alarm ? 'あり' : 'なし'}・すっきり度 {item.record.refreshed}
                  </span>
                </button>
              ) : (
                <button
                  key={`n${item.record.id}`}
                  type="button"
                  className="record-row"
                  onClick={() => setOpen({ type: 'sleepiness-edit', record: item.record })}
                >
                  <span className="record-main">
                    <span className="record-range">
                      {formatTime(item.record.time)} 眠気 {item.record.level}
                    </span>
                    <span className="record-sub">{SLEEPINESS_LABEL[item.record.level]}</span>
                  </span>
                  {item.record.easedAt != null && (
                    <span className="record-sub">
                      {dateKey(item.record.easedAt) === g.key
                        ? formatTime(item.record.easedAt)
                        : formatDateTime(item.record.easedAt)}{' '}
                      に覚めてきた({formatDuration(item.record.easedAt - item.record.time)}後)
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        </div>
      ))}

      {open.type === 'sleep-add' && (
        <SleepForm
          title="睡眠を追加"
          initial={{ start: null, end: null, kind: null, alarm: null, refreshed: null }}
          onCancel={close}
          onSubmit={async (rec) => {
            await db.sleeps.add(rec);
            toast('追加しました');
            close();
          }}
        />
      )}
      {open.type === 'sleep-edit' && (
        <SleepForm
          title="睡眠を編集"
          initial={{
            start: open.record.start,
            end: open.record.end,
            kind: open.record.kind,
            alarm: open.record.alarm,
            refreshed: open.record.refreshed,
          }}
          onCancel={close}
          onSubmit={async (rec) => {
            await db.sleeps.update(open.record.id!, rec);
            toast('保存しました');
            close();
          }}
          onDelete={async () => {
            await db.sleeps.delete(open.record.id!);
            toast('削除しました');
            close();
          }}
        />
      )}
      {open.type === 'sleepiness-add' && (
        <SleepinessForm
          title="眠気を追加"
          initial={{ time: nowMinute(), level: null, easedAt: null }}
          onCancel={close}
          onSubmit={async (rec) => {
            await db.sleepiness.add(rec);
            toast('追加しました');
            close();
          }}
        />
      )}
      {open.type === 'sleepiness-edit' && (
        <SleepinessForm
          title="眠気を編集"
          initial={{
            time: open.record.time,
            level: open.record.level,
            easedAt: open.record.easedAt ?? null,
          }}
          onCancel={close}
          onSubmit={async (rec) => {
            // 覚めてきた時刻を消した場合も反映されるよう、丸ごと置き換える
            await db.sleepiness.put({ ...rec, id: open.record.id! });
            toast('保存しました');
            close();
          }}
          onDelete={async () => {
            await db.sleepiness.delete(open.record.id!);
            toast('削除しました');
            close();
          }}
        />
      )}
    </section>
  );
}
