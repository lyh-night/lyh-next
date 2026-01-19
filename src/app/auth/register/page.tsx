'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ThemeSwitch from '@/app/components/ThemeSwitch'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/shadcn/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/shadcn/form'
import { Input } from '@/components/shadcn/input'

import { toast } from 'sonner'

const formSchema = z
  .object({
    email: z.string().email({
      message: '请输入有效的邮箱地址',
    }),
    password: z.string().min(6, {
      message: '密码必须至少包含 6 个字符',
    }),
    confirmPassword: z.string().min(6, {
      message: '确认密码必须至少包含 6 个字符',
    }),
    name: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

export default function RegisterPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          name: values.name || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || '注册失败')
      } else {
        toast.success('注册成功！正在跳转到登录页面...')
        // 2秒后跳转到登录页
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    } catch (err) {
      toast.error('注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-background-default-burn flex min-h-screen w-full justify-center p-6">
      <div className="bg-background-default-subtle flex w-full shrink-0 flex-col items-center rounded-2xl">
        <div className="flex w-full items-center justify-between p-6">
          <Image
            src="/logo.svg"
            className="block h-7 w-16 object-contain"
            alt="Lyh Next logo"
            width="32"
            height="15"
          />
          <ThemeSwitch />
        </div>
        <div className="flex w-full grow flex-col items-center justify-center px-6 md:px-[108px]">
          <div className="flex flex-col md:w-[400px]">
            <h2 className="text-text-primary text-3xl font-bold">注册 Lyh Next</h2>
            <p className="text-text-secondary my-2">
              👋 欢迎！创建新账户以开始使用。
              <Link href="/auth/login" className="text-text-primary font-medium hover:underline">
                已有账户？立即登录
              </Link>
            </p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱地址</FormLabel>
                      <FormControl>
                        <Input placeholder="输入邮箱地址" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <Input placeholder="输入密码" {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认密码</FormLabel>
                      <FormControl>
                        <Input placeholder="再次输入密码" {...field} type="password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>姓名（可选）</FormLabel>
                      <FormControl>
                        <Input placeholder="输入姓名" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button disabled={loading} className="w-full cursor-pointer" type="submit">
                  注册
                </Button>
              </form>
            </Form>

            <div className="text-text-secondary mt-2 block w-full">
              使用即代表您同意我们的 &nbsp;
              <Link
                className="text-text-primary font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://dify.ai/terms"
              >
                使用协议
              </Link>
              &nbsp;&&nbsp;
              <Link
                className="text-text-primary font-medium hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href="https://dify.ai/privacy"
              >
                隐私政策
              </Link>
            </div>
          </div>
        </div>
        <div className="text-text-secondary px-8 py-6">
          © {new Date().getFullYear()} LangGenius, Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}
