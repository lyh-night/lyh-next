import Header from '@/components/header/index'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto overflow-x-hidden">
      <Header />
      <div className="shrink grow overflow-y-auto">{children}</div>
    </div>
  )
}
