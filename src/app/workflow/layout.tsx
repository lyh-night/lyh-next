import Header from '@/app/components/header/index'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-screen w-screen flex-col overflow-x-hidden overflow-y-auto">
      <Header />
      <div className="shrink grow overflow-y-auto">{children}</div>
    </div>
  )
}
