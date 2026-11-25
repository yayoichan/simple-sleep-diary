import { useState } from 'react';
import { Home } from './screens/Home';
import { RecordList } from './screens/RecordList';
import { Summary } from './screens/Summary';
import { BackupPanel } from './components/BackupPanel';
import { ToastProvider } from './components/Toast';

type Tab = 'home' | 'list' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'list', label: '記録一覧' },
  { id: 'summary', label: 'まとめ' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <ToastProvider>
      <main className="app">
        {tab === 'home' && <Home />}
        {tab === 'list' && (
          <>
            <RecordList />
            <BackupPanel />
          </>
        )}
        {tab === 'summary' && <Summary />}
      </main>
      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="tab"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => {
                setTab(t.id);
                window.scrollTo(0, 0);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </ToastProvider>
  );
}
