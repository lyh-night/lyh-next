import * as React from 'react'

import { cn } from '@lyh-next/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content shadow-xs flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base outline-none transition-[color,box-shadow] md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
