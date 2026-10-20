import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 Tailwind className 的工具函数
 * - clsx: 处理条件拼接
 * - twMerge: 处理冲突的 class（比如 px-2 和 px-4，只保留最后一个）
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
