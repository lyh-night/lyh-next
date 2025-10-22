'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/classnames'

export default function Nav() {
  const pathname = usePathname()
  const nav_list = [
    { label: '首页', value: 'home' },
    { label: '工作流', value: 'workflow' },
  ]

  const activeTab = nav_list.find((item) => pathname.startsWith(`/${item.value}`))?.value || 'home'

  return (
    <div className="flex space-x-2">
      {nav_list.map((item) => (
        <Link
          key={item.value}
          href={`/${item.value}`}
          className={cn(
            'cursor-pointer rounded-xl pt-[5px] pr-[10px] pb-[5px] pl-[10px]',
            activeTab == item.value
              ? 'bg-[#fff] font-semibold text-[#155aef]'
              : 'font-medium hover:bg-[#eaebef]',
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
