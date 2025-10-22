import type { FC, PropsWithChildren, ReactNode } from 'react'

export type ToolTipContentProps = {
  title?: ReactNode
  action?: ReactNode
} & PropsWithChildren

export const ToolTipContent: FC<ToolTipContentProps> = ({ title, action, children }) => {
  return (
    <div className="w-[180px]">
      {title && <div className="mb-1.5">{title}</div>}
      <div className="mb-1.5">{children}</div>
      {action && <div className="cursor-pointer">{action}</div>}
    </div>
  )
}
