import { defineConfig } from 'vitest/config';

// 計算ロジック(純粋関数)の単体テスト用。PWA などのプラグインは読み込まない。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
