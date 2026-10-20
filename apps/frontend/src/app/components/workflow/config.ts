// 工作流

export type node_type_interface = {
  label: string
  value: string
  children?: Array<node_type_interface>
}

export const node_type_list: Array<node_type_interface> = [
  { label: 'LLM', value: 'llm' },
  { label: '知识检索', value: 'knowledge-retrieval' },
  { label: '直接回复', value: 'answer' },
  { label: 'Agent', value: 'agent' },
  {
    label: '问题理解',
    value: '',
    children: [{ label: '问题分类器', value: 'question-classifier' }],
  },
  {
    label: '逻辑',
    value: 'logic',
    children: [
      { label: '条件分支', value: 'if-else' },
      { label: '迭代', value: 'iteration' },
      { label: '循环', value: 'loop' },
    ],
  },
  {
    label: '转换',
    value: 'switch',
    children: [
      { label: '代码执行', value: 'code' },
      { label: '模板转换', value: 'template-transform' },
      { label: '变量聚合器', value: 'variable-aggregator' },
      { label: '文档提取器', value: 'document-extractor' },
      { label: '变量赋值', value: 'assigner' },
      { label: '参数提取器', value: 'parameter-extractor' },
    ],
  },
  {
    label: '工具',
    value: 'tool',
    children: [
      { label: 'HTTP请求', value: 'http-request' },
      { label: '列表操作', value: 'list-operator' },
    ],
  },
]

export const node_type_obj: Record<string, string> = {
  start: '开始',
  end: '结束',
  answer: '直接回复',
  llm: 'LLM',
  'knowledge-retrieval': '知识检索',
  'question-classifier': '问题分类器',
  'if-else': '条件分支',
  code: '代码执行',
  'template-transform': '模板转换',
  'http-request': 'HTTP 请求',
  'variable-assigner': '变量赋值器',
  'variable-aggregator': '变量聚合器',
  assigner: '变量赋值',
  'iteration-start': '迭代开始',
  iteration: '迭代',
  'parameter-extractor': '参数提取器',
  'document-extractor': '文档提取器',
  'list-operator': '列表操作',
  agent: 'Agent',
  'loop-start': '循环开始',
  loop: '循环',
  'loop-end': '退出循环',
  'knowledge-index': '知识库',
  datasource: '数据源',
}

export const node_type_desc_obj: Record<string, string> = {
  start: '定义一个 workflow 流程启动的初始参数',
  end: '定义一个 workflow 流程的结束和结果类型',
  answer: '定义一个聊天对话的回复内容',
  llm: '调用大语言模型回答问题或者对自然语言进行处理',
  'knowledge-retrieval': '允许你从知识库中查询与用户问题相关的文本内容',
  'question-classifier': '定义用户问题的分类条件，LLM 能够根据分类描述定义对话的进展方式',
  'if-else': '允许你根据 if/else 条件将 workflow 拆分成两个分支',
  code: '执行一段 Python 或 NodeJS 代码实现自定义逻辑',
  'template-transform': '使用 Jinja 模板语法将数据转换为字符串',
  'http-request': '允许通过 HTTP 协议发送服务器请求',
  'variable-assigner': '将多路分支的变量聚合为一个变量，以实现下游节点统一配置。',
  assigner: '变量赋值节点用于向可写入变量（例如会话变量）进行变量赋值。',
  'variable-aggregator': '将多路分支的变量聚合为一个变量，以实现下游节点统一配置。',
  iteration: '对列表对象执行多次步骤直至输出所有结果。',
  loop: '循环执行一段逻辑直到满足结束条件或者到达循环次数上限。',
  'loop-end': '相当于“break”此节点没有配置项，当循环体内运行到此节点后循环终止。',
  'parameter-extractor':
    '利用 LLM 从自然语言内推理提取出结构化参数，用于后置的工具调用或 HTTP 请求。',
  'document-extractor': '用于将用户上传的文档解析为 LLM 便于理解的文本内容。',
  'list-operator': '用于过滤或排序数组内容。',
  agent: '调用大型语言模型回答问题或处理自然语言',
  'knowledge-index': '知识库节点',
  datasource: '数据源节点',
}

export const node_icon_bgc_enum: Record<string, string> = {
  start: '#3c6cf6',
  end: '#3c6cf6',
  // answer: '直接回复',
  llm: '#6572eb',
  'knowledge-retrieval': '#53b071',
  'question-classifier': '#53b071',
  'if-else': '#4eacd0',
  code: '#4c8ef3',
  'template-transform': '#4c8ef3',
  'http-request': '#805dee',
  // 'variable-assigner': '变量赋值器',
  'variable-aggregator': '#4c8ef3',
  assigner: '#4c8ef3',
  // 'iteration-start': '迭代开始',
  iteration: '#4eacd0',
  'parameter-extractor': '#4c8ef3',
  'document-extractor': '#53b071',
  'list-operator': '#4eabd0',
  agent: '#6572eb',
  // 'loop-start': '循环开始',
  loop: '#4eabd0',
  // 'loop-end': '退出循环',
  // 'knowledge-index': '知识库',
  // datasource: '数据源',
}
