'use client'

import { RiSunLine, RiMoonLine } from '@remixicon/react'
import { useTheme } from 'next-themes'

export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="hover:bg-background-default-hover flex cursor-pointer items-center justify-center rounded-[6px] p-[6px]">
      {theme !== 'dark' && (
        <RiSunLine
          className="text-text-tertiary h-[16px] w-[16px]"
          onClick={() => setTheme('dark')}
        />
      )}
      {theme === 'dark' && (
        <RiMoonLine
          className="text-text-tertiary h-[16px] w-[16px]"
          onClick={() => setTheme('light')}
        />
      )}
    </div>
  )
}
