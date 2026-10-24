import NextAuth from 'next-auth'
import { type DefaultSession, type Session } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string
      hasAccess: boolean
      location?: string
      role: string
      isAdmin: boolean
    } & DefaultSession['user']
  }
  interface User {
    hasAccess: boolean
    role: string
  }
}

// 认证数据由后端提供：NextAuth 只负责会话（JWT），不再直连数据库
const backendUrl =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface BackendAuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
  hasAccess: boolean
  role: string
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  // 自托管 / Docker 部署时没有 Vercel 的可信 Host 推断，需显式信任
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.hasAccess = user.hasAccess
        token.name = user.name
        token.image = user.image
        token.picture = user.image
        token.location = (user as Session['user']).location
        token.role = user.role
        token.isAdmin = user.role === 'ADMIN'
      }
      if (trigger === 'update' && (session as Session)?.user) {
        token.name = (session as Session).user.name
        token.image = (session as Session).user.image
        token.picture = (session as Session).user.image
        token.location = (session as Session).user.location
        token.role = (session as Session).user.role
        token.isAdmin = (session as Session).user.role === 'ADMIN'
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.hasAccess = token.hasAccess as boolean
      session.user.location = token.location as string
      session.user.role = token.role as string
      session.user.isAdmin = token.role === 'ADMIN'
      return session
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const response = await fetch(`${backendUrl}/api/auth/verify-credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            cache: 'no-store',
          })

          if (!response.ok) {
            return null
          }

          const user = (await response.json()) as BackendAuthUser

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            hasAccess: user.hasAccess,
            role: user.role,
          }
        } catch {
          // 后端不可用时按登录失败处理，避免把网络异常抛给 NextAuth
          return null
        }
      },
    }),
  ],
})
