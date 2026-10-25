'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lyh-next/components'

import { deleteModel, listModelConfigs, updateModel } from './api'
import ModelForm from './model-form'
import type { ModelConfig, ModelPayload } from './types'

export default function ModelTab() {
  const [items, setItems] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const [removing, setRemoving] = useState<ModelConfig | null>(null)
  const [removingPending, setRemovingPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listModelConfigs()
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setView('form')
  }

  function openEdit(model: ModelConfig) {
    setEditing(model)
    setView('form')
  }

  function backToList() {
    setView('list')
    setEditing(null)
  }

  async function handleSaved() {
    backToList()
    await load()
  }

  async function patch(model: ModelConfig, payload: Partial<ModelPayload>) {
    try {
      await updateModel(model.id, payload)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试')
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setRemovingPending(true)
    try {
      await deleteModel(removing.id)
      toast.success('模型已删除')
      setRemoving(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败，请稍后重试')
    } finally {
      setRemovingPending(false)
    }
  }

  if (view === 'form') {
    return <ModelForm initial={editing ?? undefined} onSaved={handleSaved} onCancel={backToList} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-medium">模型</h3>
          <p className="text-muted-foreground text-sm">
            配置第三方平台（OpenAI 兼容接口），对话时按这里的设置调用。
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          添加模型
        </Button>
      </div>

      {loading && <p className="text-muted-foreground text-sm">加载中…</p>}

      {!loading && error && (
        <div className="flex items-center gap-3">
          <p className="text-destructive text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            重试
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">还没有配置模型</p>
          <p className="text-muted-foreground mt-1 text-sm">
            添加一个模型后，就可以在对话里选择它了。
          </p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            添加模型
          </Button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>模型</TableHead>
              <TableHead>Base URL</TableHead>
              <TableHead>密钥</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((model) => (
              <TableRow key={model.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.displayName}</span>
                    {model.isDefault && (
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">
                        默认
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {model.provider || '未填写提供商'}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{model.model}</TableCell>
                <TableCell className="text-muted-foreground max-w-[180px] truncate text-xs">
                  {model.baseUrl}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {model.apiKeyMasked}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={model.isActive}
                      onCheckedChange={(checked) => void patch(model, { isActive: checked })}
                      aria-label={model.isActive ? '停用模型' : '启用模型'}
                    />
                    {!model.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void patch(model, { isDefault: true })}
                      >
                        设为默认
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(model)}>
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoving(model)}
                    >
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除模型</DialogTitle>
            <DialogDescription>
              确定删除「{removing?.displayName}」吗？删除后历史对话仍保留，但该模型不能再被调用。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={removingPending}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRemove()}
              disabled={removingPending}
            >
              {removingPending ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
