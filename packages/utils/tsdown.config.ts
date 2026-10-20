import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'neutral',
  target: 'es2022',
  // 固定产物扩展名，避免 exports 与实际文件名漂移
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
