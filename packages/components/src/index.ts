/**
 * @lyh-next/components 统一出口
 *
 * 消费方统一从包名导入：
 *   import { Button, Input, Tooltip } from '@lyh-next/components'
 * 样式（主题变量 / dark 变体 / Tailwind 主题映射）：
 *   import '@lyh-next/components/styles.css'
 *
 * 约定：同一功能的组件只保留 shadcn/ui 版本。
 */

export * from './shadcn/button'
export * from './shadcn/dialog'
export * from './shadcn/dropdown-menu'
export * from './shadcn/form'
export * from './shadcn/hover-card'
export * from './shadcn/input'
export * from './shadcn/label'
export * from './shadcn/pagination'
export * from './shadcn/popover'
export * from './shadcn/select'
export * from './shadcn/sonner'
export * from './shadcn/switch'
export * from './shadcn/table'
export * from './shadcn/textarea'
export * from './shadcn/tooltip'
