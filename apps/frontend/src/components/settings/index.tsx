'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'

import {
  Dialog,
  DialogContent,
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
      <DialogContent className="max-w-[min(900px,calc(100vw-2rem))] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <DialogTitle className="sr-only">设置</DialogTitle>
        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex h-[560px] max-h-[80vh] flex-row gap-0"
        >
          <TabsList className="h-full w-[176px] flex-col items-stretch justify-start gap-1 rounded-none border-r bg-transparent p-3">
            <TabsTrigger className="flex-none justify-start" value="models">
              模型
            </TabsTrigger>
            <TabsTrigger className="flex-none justify-start" value="general">
              通用
            </TabsTrigger>
          </TabsList>

          <TabsContent value="models" className="m-0 overflow-y-auto p-6">
            <ModelTab />
          </TabsContent>

          <TabsContent value="general" className="m-0 overflow-y-auto p-6">
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
