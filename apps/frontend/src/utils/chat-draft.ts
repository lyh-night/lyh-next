/** 草稿在 localStorage 中的键前缀，完整键为 `chat:draft:<draftKey>` */
const DRAFT_KEY_PREFIX = 'chat:draft:'

/** 读取某会话的草稿（无草稿/存储不可用时返回空串） */
export function readChatDraft(key: string): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY_PREFIX + key) ?? ''
  } catch {
    return ''
  }
}

/** 写入/清空某会话的草稿（空串即删除） */
export function writeChatDraft(key: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(DRAFT_KEY_PREFIX + key, value)
    else window.localStorage.removeItem(DRAFT_KEY_PREFIX + key)
  } catch {
    // 存储不可用（隐私模式等）时静默
  }
}
