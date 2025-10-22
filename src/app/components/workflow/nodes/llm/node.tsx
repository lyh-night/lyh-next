'use client'

import { BaseNode } from '../_base/node'
import type { NodeProps } from '../../types'

export default function LlmNode({ data }: NodeProps) {
  return <BaseNode data={data}></BaseNode>
}
