import type { Metadata } from 'next'
import '@/styles/globals.css'
import NextAuthProvider from '@/provider/NextAuthProvider'

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
    <html lang="en">
      <body>
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  )
}
