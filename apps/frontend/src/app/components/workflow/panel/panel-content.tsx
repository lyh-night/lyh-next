'use client'

import { useWorkflowStore } from '../store/index'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@lyh-next/components'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const llmFormSchema = z.object({
  model: z.string().min(1, '请选择模型'),
  prompt: z.string().min(1, '请输入提示词'),
  temperature: z.string(),
  maxTokens: z.string(),
})

const startFormSchema = z.object({
  description: z.string().optional(),
})

const endFormSchema = z.object({
  outputType: z.string().min(1, '请选择输出类型'),
  description: z.string().optional(),
})

function LLMConfig() {
  const form = useForm<z.infer<typeof llmFormSchema>>({
    resolver: zodResolver(llmFormSchema),
    defaultValues: {
      model: 'gpt-4o',
      prompt: '',
      temperature: '0.7',
      maxTokens: '2048',
    },
  })

  return (
    <Form {...form}>
      <form className="space-y-4 px-[16px] pb-[16px]">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>模型</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>提示词</FormLabel>
              <FormControl>
                <Textarea placeholder="输入提示词模板..." className="min-h-[120px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>温度</FormLabel>
                <FormControl>
                  <Input placeholder="0.7" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxTokens"
            render={({ field }) => (
              <FormItem>
                <FormLabel>最大 Token</FormLabel>
                <FormControl>
                  <Input placeholder="2048" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  )
}

function StartConfig() {
  const form = useForm<z.infer<typeof startFormSchema>>({
    resolver: zodResolver(startFormSchema),
    defaultValues: {
      description: '',
    },
  })

  return (
    <Form {...form}>
      <form className="space-y-4 px-[16px] pb-[16px]">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>流程描述</FormLabel>
              <FormControl>
                <Textarea placeholder="描述此工作流的用途..." className="min-h-[80px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

function EndConfig() {
  const form = useForm<z.infer<typeof endFormSchema>>({
    resolver: zodResolver(endFormSchema),
    defaultValues: {
      outputType: 'text',
      description: '',
    },
  })

  return (
    <Form {...form}>
      <form className="space-y-4 px-[16px] pb-[16px]">
        <FormField
          control={form.control}
          name="outputType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>输出类型</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择输出类型" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="text">文本</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="image">图片</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>输出描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="描述输出内容的格式和用途..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

function GenericConfig({ nodeType }: { nodeType: string }) {
  return (
    <div className="px-[16px] pb-[16px]">
      <div className="text-text-secondary text-sm">
        <p className="mb-2">节点类型: {nodeType}</p>
        <p>配置面板开发中...</p>
      </div>
    </div>
  )
}

export function PanelContent() {
  const nodes = useWorkflowStore((state) => state.nodes)
  const active_node = useWorkflowStore((state) => state.active_node)
  const current_node = nodes.find((item) => item.id === active_node)
  const nodeType = current_node?.data?.type || ''

  switch (nodeType) {
    case 'llm':
      return <LLMConfig />
    case 'start':
      return <StartConfig />
    case 'end':
      return <EndConfig />
    default:
      return <GenericConfig nodeType={nodeType} />
  }
}
