'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTree } from '../api'
import type { TreeEntry } from '../types'

/** 目录树读取：一次拉取扁平列表（后端上限 2000 项），由组件组装成树 */
export function useFileTree(workspaceId: string | null) {
  const [entries, setEntries] = useState<TreeEntry[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(Boolean(workspaceId))
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const reload = useCallback(
    async (idOverride?: string) => {
      const id = idOverride ?? workspaceId
      if (!id) {
        setEntries([])
        setTruncated(false)
        setLoading(false)
        setError(null)
        return
      }

      const current = (generation.current += 1)
      setLoading(true)
      setError(null)
      try {
        const response = await fetchTree(id)
        if (generation.current !== current) return
        setEntries(response.entries)
        setTruncated(response.truncated)
      } catch (reason) {
        if (generation.current !== current) return
        setError(reason instanceof Error ? reason.message : '目录读取失败')
      } finally {
        if (generation.current === current) setLoading(false)
      }
    },
    [workspaceId],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  return { entries, truncated, loading, error, reload }
}
