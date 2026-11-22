import { Suspense } from 'react'
import Header from '@/components/header/index'
import FilesWorkspace from '@/components/files'

export default function FilesPage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Header />
      {/* useSearchParams 需要 Suspense 边界 */}
      <Suspense fallback={null}>
        <FilesWorkspace />
      </Suspense>
    </div>
  )
}
