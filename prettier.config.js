export default {
  plugins: ['prettier-plugin-tailwindcss'],
  // monorepo 下显式指定 Tailwind 入口，避免插件在根目录找不到样式文件而回退默认排序
  tailwindStylesheet: './apps/frontend/src/styles/index.css',
  semi: false, // 不要分号
  singleQuote: true, // 单引号
  trailingComma: 'all', // 尾随逗号
  tabWidth: 2,
  printWidth: 100,
}
