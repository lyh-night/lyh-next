'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFileBlob, fetchTextPage } from '../api'
import { FILE_LIMITS, previewKindFor, type PreviewKind } from '../constants'

/**
 * 单个文件的预览数据源：
 * - 文本/代码/Markdown：按行分页累加，滚到底再取下一页；
 * - 图片/PDF：一次取完整字节并转 Blob URL；
 * - 明确不可预览的二进制：不发起任何读取。
 */
export function useFilePreview(workspaceId: string | null, path: string | null) {
  const kind: PreviewKind | null = path ? previewKindFor(path) : null

  const [text, setText] = useState('')
  const [eof, setEof] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [byteSize, setByteSize] = useState<number | null>(null)
  const [nonce, setNonce] = useState(0)

  const generation = useRef(0)
  const loadedThrough = useRef(0)
  const eofRef = useRef(false)
  const loadingRef = useRef(false)

  const loadPage = useCallback(
    async (offset: number) => {
      if (!workspaceId || !path || loadingRef.current) return
      if (offset > 1 && eofRef.current) return

      loadingRef.current = true
      setLoading(true)
      const current = generation.current

      try {
        const page = await fetchTextPage(workspaceId, path, offset, FILE_LIMITS.pageLines)
        if (generation.current !== current) return

        setText((previous) => {
          if (offset === 1) return page.text
          return previous ? `${previous}\n${page.text}` : page.text
        })
        loadedThrough.current = page.lines > 0 ? offset + page.lines - 1 : offset
        eofRef.current = page.eof
        setEof(page.eof)
        setByteSize(page.size)
        setError(null)
      } catch (reason) {
        if (generation.current !== current) return
        setError(reason instanceof Error ? reason.message : '文本读取失败')
      } finally {
        if (generation.current === current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [workspaceId, path],
  )

  useEffect(() => {
    generation.current += 1
    const current = generation.current

    setText('')
    setEof(false)
    setError(null)
    setLoading(false)
    setObjectUrl(null)
    setByteSize(null)
    loadedThrough.current = 0
    eofRef.current = false
    loadingRef.current = false

    if (!workspaceId || !path || !kind || kind === 'unsupported') return

    if (kind === 'image' || kind === 'pdf') {
      const controller = new AbortController()
      loadingRef.current = true
      setLoading(true)

      fetchFileBlob(workspaceId, path, controller.signal)
        .then((blob) => {
          if (generation.current !== current) return
          setByteSize(blob.size)
          setObjectUrl(URL.createObjectURL(blob))
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || generation.current !== current) return
          setError(reason instanceof Error ? reason.message : '文件读取失败')
        })
        .finally(() => {
          if (generation.current !== current) return
          loadingRef.current = false
          setLoading(false)
        })

      return () => {
        controller.abort()
      }
    }

    void loadPage(1)
  }, [workspaceId, path, kind, nonce, loadPage])

  // Blob URL 的释放：URL 变化或组件卸载时执行
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  const loadMore = useCallback(() => {
    if (loadingRef.current || eofRef.current || loadedThrough.current === 0) return
    void loadPage(loadedThrough.current + 1)
  }, [loadPage])

  return {
    kind,
    text,
    eof,
    loading,
    error,
    objectUrl,
    size: byteSize,
    reload,
    loadMore,
  }
}
