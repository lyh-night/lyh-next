'use client'

import { BaseNode } from '../_base/node'
import type { NodeProps } from '../../types'

export default function StartNode({ data }: NodeProps) {
  return <BaseNode data={data}></BaseNode>
}
