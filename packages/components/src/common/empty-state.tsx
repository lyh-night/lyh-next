import type { ComponentType, ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  /** 底部操作区（按钮等） */
  action?: ReactNode
  className?: string
}

/**
 * 通用空态：图标 + 标题 + 描述 + 操作。
 * 纯展示组件，不含业务数据与请求；业务特定的空态内容由调用方传入。
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={className ?? 'text-muted-foreground flex flex-col items-center gap-2'}>
      {Icon && <Icon className="text-muted-foreground/50 h-7 w-7" />}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description && <p className="text-xs">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
