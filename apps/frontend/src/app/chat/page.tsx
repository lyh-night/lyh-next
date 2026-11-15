import { Suspense } from 'react'
import Header from '@/components/header/index'
import ChatWorkspace from '@/components/chat'

export default function ChatPage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Header />
      {/* useSearchParams 需要 Suspense 边界 */}
      <Suspense fallback={null}>
        <ChatWorkspace />
      </Suspense>
    </div>
  )
}
