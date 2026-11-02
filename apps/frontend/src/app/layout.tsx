import type { Metadata } from 'next'
import '@/styles/index.css'
import SessionProvider from '@/provider/session-provider'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@lyh-next/components'

export const metadata: Metadata = {
  title: 'Lyh Next',
  description: 'lyh Next',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          enableColorScheme={false}
        >
          <SessionProvider>{children}</SessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
