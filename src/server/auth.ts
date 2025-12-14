import prisma from '@/server/prisma'
import { PrismaAdapter } from '@auth/prisma-adapter'
import NextAuth from 'next-auth'
import { type DefaultSession, type Session } from 'next-auth'
import { type Adapter } from 'next-auth/adapters'
import CredentialsProvider from 'next-auth/providers/credentials'
import * as bcrypt from 'bcryptjs'

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

export const { auth, handlers, signIn, signOut } = NextAuth({
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
        const user = await prisma.user.findUnique({
          where: { id: token.id as string },
        })
        if (session) {
          token.name = (session as Session).user.name
          token.image = (session as Session).user.image
          token.picture = (session as Session).user.image
          token.location = (session as Session).user.location
          token.role = (session as Session).user.role
          token.isAdmin = (session as Session).user.role === 'ADMIN'
        }
        if (user) {
          token.hasAccess = user?.hasAccess ?? false
          token.role = user.role
          token.isAdmin = user.role === 'ADMIN'
        }
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
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const prismaUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, hasAccess: true, role: true },
        })
        if (prismaUser) {
          user.hasAccess = prismaUser.hasAccess
          user.role = prismaUser.role
        } else {
          user.hasAccess = false
          user.role = 'USER'
        }
      }
      return true
    },
  },
  adapter: PrismaAdapter(prisma) as Adapter,
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
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user || !user.password) {
          return null
        }
        const isPasswordValid = await bcrypt.compare(credentials.password as string, user.password)
        if (!isPasswordValid) {
          return null
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          hasAccess: user.hasAccess,
          role: user.role,
        }
      },
    }),
  ],
})
