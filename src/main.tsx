import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// 端末のストレージ整理で IndexedDB が消されにくくする(対応ブラウザのみ)
if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
