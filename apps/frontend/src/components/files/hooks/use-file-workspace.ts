'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createWorkspace, fetchWorkspace, removeWorkspace } from '../api'
import type { WorkspaceMeta } from '../types'

/** 当前文件工作区：URL 里的 ?ws 优先，创建/删除后同步本地状态 */
export function useFileWorkspace(initialId: string | null) {
  const [workspace, setWorkspace] = useState<WorkspaceMeta | null>(null)
  const [restoring, setRestoring] = useState(Boolean(initialId))
  const [error, setError] = useState<string | null>(null)
  /** 主动离开的工作区：URL 尚未同步前不要因旧 id 再拉一次 */
  const dismissedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!initialId || dismissedRef.current === initialId || workspace?.id === initialId) {
      setRestoring(false)
      return
    }

    let active = true
    setRestoring(true)
    setError(null)
    fetchWorkspace(initialId)
      .then((meta) => {
        if (active) setWorkspace(meta)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '文件夹加载失败')
      })
      .finally(() => {
        if (active) setRestoring(false)
      })

    return () => {
      active = false
    }
  }, [initialId, workspace?.id])

  const create = useCallback(async (name?: string) => {
    const meta = await createWorkspace(name)
    setWorkspace(meta)
    setError(null)
    return meta
  }, [])

  const refresh = useCallback(async (id: string) => {
    const meta = await fetchWorkspace(id)
    setWorkspace(meta)
  }, [])

  const remove = useCallback(async (id: string) => {
    await removeWorkspace(id)
    dismissedRef.current = id
    setWorkspace(null)
    setError(null)
  }, [])

  /** 换一个文件夹：只清本地状态，旧工作区由后端 TTL 清理 */
  const forget = useCallback(() => {
    dismissedRef.current = workspace?.id ?? dismissedRef.current
    setWorkspace(null)
    setError(null)
  }, [workspace?.id])

  return { workspace, restoring, error, create, refresh, remove, forget }
}
