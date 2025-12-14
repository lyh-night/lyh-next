import { NextResponse } from 'next/server'
import prisma from '@/server/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json()

    // 验证输入
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码是必填项' }, { status: 400 })
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 })
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        message: '注册成功',
        user,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('注册错误:', error)
    return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 })
  }
}
