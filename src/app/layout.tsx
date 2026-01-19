import type { Metadata } from 'next'
import '@/styles/index.css'
import NextAuthProvider from '@/provider/NextAuthProvider'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/shadcn/sonner'

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
          <NextAuthProvider>{children}</NextAuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
