'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadFile } from '../api'
import type { UploadEntry } from '../types'

/** 前端并发上传数：兼顾吞吐与服务端串行上传锁 */
const UPLOAD_CONCURRENCY = 3

export interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'cancelled'
  totalFiles: number
  doneFiles: number
  totalBytes: number
  doneBytes: number
  failed: UploadEntry[]
  currentPath?: string
  lastError?: string
}

export const EMPTY_UPLOAD_STATE: UploadState = {
  status: 'idle',
  totalFiles: 0,
  doneFiles: 0,
  totalBytes: 0,
  doneBytes: 0,
  failed: [],
}

/**
 * 逐文件上传控制器（并发 3，失败不阻塞其它文件）。
 * 上传按 path 覆盖同名文件，因此「重试失败项」天然幂等。
 */
export function useFileUpload() {
  const [state, setState] = useState<UploadState>(EMPTY_UPLOAD_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const failedRef = useRef<UploadEntry[]>([])

  // 页面卸载时中止进行中的上传，避免对已卸载组件写状态
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const run = useCallback(async (workspaceId: string, entries: UploadEntry[]) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    failedRef.current = []

    setState({
      status: 'uploading',
      totalFiles: entries.length,
      doneFiles: 0,
      totalBytes: entries.reduce((sum, entry) => sum + entry.file.size, 0),
      doneBytes: 0,
      failed: [],
    })

    let cursor = 0
    const worker = async (): Promise<void> => {
      while (!controller.signal.aborted) {
        const entry = entries[cursor]
        cursor += 1
        if (!entry) return

        setState((prev) => ({ ...prev, currentPath: entry.path }))
        try {
          await uploadFile(workspaceId, entry.path, entry.file, controller.signal)
          setState((prev) => ({
            ...prev,
            doneFiles: prev.doneFiles + 1,
            doneBytes: prev.doneBytes + entry.file.size,
          }))
        } catch (reason) {
          if (controller.signal.aborted) return
          failedRef.current = [...failedRef.current, entry]
          setState((prev) => ({
            ...prev,
            failed: failedRef.current,
            lastError: reason instanceof Error ? reason.message : '上传失败',
          }))
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, entries.length) }, () => worker()),
    )

    setState((prev) => ({
      ...prev,
      status: controller.signal.aborted ? 'cancelled' : 'done',
      currentPath: undefined,
      failed: failedRef.current,
    }))
  }, [])

  const retry = useCallback(
    async (workspaceId: string) => {
      const failed = failedRef.current
      if (failed.length > 0) await run(workspaceId, failed)
    },
    [run],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({ ...prev, status: 'cancelled' }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    failedRef.current = []
    setState(EMPTY_UPLOAD_STATE)
  }, [])

  return { state, run, retry, cancel, reset }
}
