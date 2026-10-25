'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from '@lyh-next/components'

import { createModel, updateModel } from './api'
import { PROVIDER_PRESETS, type ModelConfig, type ModelPayload } from './types'

/** 数字输入统一用字符串承载，空串表示「用上游默认」 */
function toNumber(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined
  return Number(value)
}

function buildSchema(isEdit: boolean) {
  return z.object({
    provider: z.string().max(40, '提供商不能超过 40 个字符').optional(),
    displayName: z.string().min(1, '请输入显示名称').max(60, '显示名称不能超过 60 个字符'),
    model: z.string().min(1, '请输入模型名称').max(120, '模型名称不能超过 120 个字符'),
    baseUrl: z
      .string()
      .min(1, '请输入 Base URL')
      .url('请输入合法的地址，例如 https://api.deepseek.com/v1')
      .max(500),
    // 编辑时留空表示保留原密钥；新建时必须填写
    apiKey: isEdit ? z.string().optional() : z.string().min(1, '请输入 API Key'),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    temperature: z
      .string()
      .optional()
      .refine(
        (value) => !value?.trim() || (Number(value) >= 0 && Number(value) <= 2),
        '温度需在 0 到 2 之间',
      ),
    maxTokens: z
      .string()
      .optional()
      .refine(
        (value) => !value?.trim() || (Number.isInteger(Number(value)) && Number(value) >= 1),
        '最大 token 需为不小于 1 的整数',
      ),
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

interface Props {
  initial?: ModelConfig
  onSaved: () => void
  onCancel: () => void
}

export default function ModelForm({ initial, onSaved, onCancel }: Props) {
  const isEdit = Boolean(initial)
  const schema = useMemo(() => buildSchema(isEdit), [isEdit])
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: initial?.provider ?? '',
      displayName: initial?.displayName ?? '',
      model: initial?.model ?? '',
      baseUrl: initial?.baseUrl ?? '',
      apiKey: '',
      isDefault: initial?.isDefault ?? false,
      isActive: initial?.isActive ?? true,
      temperature: initial?.temperature != null ? String(initial.temperature) : '',
      maxTokens: initial?.maxTokens != null ? String(initial.maxTokens) : '',
    },
  })

  async function onSubmit(values: FormValues) {
    const payload: ModelPayload = {
      displayName: values.displayName.trim(),
      model: values.model.trim(),
      baseUrl: values.baseUrl.trim(),
      provider: values.provider?.trim() || undefined,
      isDefault: values.isDefault,
      isActive: values.isActive,
      temperature: toNumber(values.temperature),
      maxTokens: toNumber(values.maxTokens),
    }

    if (values.apiKey?.trim()) payload.apiKey = values.apiKey.trim()

    setSaving(true)
    try {
      if (initial) {
        await updateModel(initial.id, payload)
        toast.success('模型已更新')
      } else {
        await createModel(payload)
        toast.success('模型已添加')
      }
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium">{isEdit ? '编辑模型' : '添加模型'}</h3>
            <p className="text-muted-foreground text-sm">
              配置第三方平台的 OpenAI 兼容接口，保存后即可在对话里选择。
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            返回列表
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {PROVIDER_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                form.setValue('provider', preset.label)
                form.setValue('baseUrl', preset.baseUrl)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>提供商</FormLabel>
                <FormControl>
                  <Input placeholder="如 OpenAI / DeepSeek" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>显示名称</FormLabel>
                <FormControl>
                  <Input placeholder="如 DeepSeek 对话" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>模型名称</FormLabel>
              <FormControl>
                <Input placeholder="如 deepseek-chat" {...field} />
              </FormControl>
              <FormDescription>调用第三方接口时作为 model 字段，需与平台文档一致。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="baseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Base URL</FormLabel>
              <FormControl>
                <Input placeholder="https://api.deepseek.com/v1" {...field} />
              </FormControl>
              <FormDescription>后端会在其后拼接 /chat/completions。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Key</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={isEdit ? `留空不修改（当前 ${initial?.apiKeyMasked}）` : 'sk-...'}
                  {...field}
                />
              </FormControl>
              <FormDescription>密钥只保存在后端数据库，接口不会返回明文。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="temperature"
            render={({ field }) => (
              <FormItem>
                <FormLabel>温度（可选）</FormLabel>
                <FormControl>
                  <Input placeholder="0 - 2，留空用上游默认" {...field} />
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
                <FormLabel>最大 token（可选）</FormLabel>
                <FormControl>
                  <Input placeholder="留空用上游默认" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-wrap gap-6">
          <FormField
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch
                  id="model-is-default"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <label htmlFor="model-is-default" className="cursor-pointer text-sm">
                  设为默认模型
                </label>
              </div>
            )}
          />
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch
                  id="model-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <label htmlFor="model-is-active" className="cursor-pointer text-sm">
                  启用
                </label>
              </div>
            )}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            取消
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
