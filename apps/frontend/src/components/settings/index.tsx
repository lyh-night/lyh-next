'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Cpu, SlidersHorizontal, X } from 'lucide-react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@lyh-next/components'

import ModelTab from './model-tab'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsDialog({ open, onOpenChange }: Props) {
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState('models')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(900px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[900px]"
      >
        {/* 头部：可见标题 + 自排布关闭按钮，不再悬浮在内容区右上角 */}
        <div className="flex h-14 flex-none items-center justify-between border-b px-6">
          <div className="space-y-1">
            <DialogTitle className="text-base font-semibold leading-none">设置</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs leading-none">
              管理模型配置与界面偏好
            </DialogDescription>
          </div>

          <DialogClose className="focus-visible:ring-ring/50 rounded-xs flex size-8 items-center justify-center opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-[3px]">
            <X className="size-4" />
            <span className="sr-only">关闭</span>
          </DialogClose>
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex h-[520px] max-h-[calc(80vh-3.5rem)] flex-row gap-0"
        >
          <TabsList className="flex h-full w-[172px] flex-none flex-col items-stretch justify-start gap-0.5 rounded-none border-r bg-transparent p-2">
            {/* 覆盖基础样式的 h-[calc(100%-1px)]（为水平 tab 设计）：否则竖排时每个 trigger 占满整列，第二个被 overflow-hidden 裁掉 */}
            <TabsTrigger
              className="data-[state=inactive]:hover:bg-accent/50 text-muted-foreground hover:text-foreground h-auto flex-none justify-start gap-2.5 rounded-md px-3 py-2 font-normal transition-colors data-[state=active]:font-medium"
              value="models"
            >
              <Cpu />
              模型
            </TabsTrigger>
            <TabsTrigger
              className="data-[state=inactive]:hover:bg-accent/50 text-muted-foreground hover:text-foreground h-auto flex-none justify-start gap-2.5 rounded-md px-3 py-2 font-normal transition-colors data-[state=active]:font-medium"
              value="general"
            >
              <SlidersHorizontal />
              通用
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="m-0 flex-1 overflow-y-auto p-6">
            <ModelTab />
          </TabsContent>

          <TabsContent value="general" className="m-0 flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium">通用</h3>
                <p className="text-muted-foreground text-sm">界面外观等基础设置。</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">深色模式</p>
                  <p className="text-muted-foreground text-sm">切换后立即生效并记住选择。</p>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  aria-label="切换深色模式"
                />
              </div>

              <div className="text-muted-foreground text-sm">版本：Lyh Next 0.0.0</div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
