import Header from '@/app/components/header/index'

export default function HomePage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto overflow-x-hidden">
      <Header />
      <div>home</div>
      <div className="shrink grow overflow-y-auto" />
    </div>
  )
}
