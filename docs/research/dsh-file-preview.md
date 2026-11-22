# DSH 文件预览实现调研：从资源地址到渲染器矩阵

> 调研日期：2026-11-21。
> 对象：DeepSeek Harness 桌面端 macOS 打包产物 `app.asar`（相关包版本 `0.2.1-rc.2`）。
> 证据约定：**[文档]** = 包内 `README.zh.md`；**[源码]** = `app.asar` 内 `@deepseek-ai/dsh-*/lib/*.js`（解包阅读，文中包名省略 `@deepseek-ai/` 前缀）；**[推论]** = 由源码与文档交叉得出。
> 范围：右侧 Sidebar 的**文件预览**（文本/代码/Markdown/图片/PDF/HTML/表格/Office），以及围绕它的文件树、交付卡与 diff review；聊天附件（草稿栏、图片灯箱）只在 §8.5 作边界说明。
> 用途：为 lyh-next 后续做「会话产物预览」提供设计参照，映射建议见 §10。

---

## 1. TL;DR

1. **预览是右侧 Sidebar 的一类 tab，不是聊天内组件**。实现包 `ui-sidebar-documentpreview` 向 Sidebar 的 tab 注册表声明类型，再向 keyed slot 注册正文；文件树、交付卡、聊天里的文件链接都只是「打开某个资源地址」，预览本身不知道入口。
2. **一条预览链路由四层拼成**：资源地址（`dsh-resource://file/session/<sessionId>/<path>`）→ 元数据观察（`resources` 的 `file` 提供方 + `stat`/`changes`）→ 有界读取（`api-workspace-files` 的行分页与字节读取）→ 渲染器（按扩展名注册，可切换）。
3. **渲染器是一个开放注册表**：`ctx.documentPreviews.register({ id, extensions, binaryExtensions, priority, loading, wrap })`；选择顺序为「extension 档优先于 builtin → 最长后缀 → 注册顺序」，纯文本兜底由预览正文追加在候选末尾；多个候选时 header 出现下拉。
4. **只有三种加载模式**：`text-pages`（文本/代码/Markdown，按行分页增量渲染）、`bytes-complete`（PDF/图片/HTML/表格，一次取完整字节）、`renderer`（Office：Host 先转 PDF，再交给 PDF 渲染器，正文根本不碰原始字节）。
5. **文本分页 API 是"行窗口"而不是字节流**：`read(offset)` 以 1 起算行号，页上限默认 5000 行 / 2 MiB；前端读到滚动底部再取下一页；**后到的新版本页会让整篇从头重读**，避免混版本；行号导航会顺序加载到目标行。
6. **重依赖全部按需加载**：PDF 渲染（`client.pdf.js`，6.8 MB，内嵌 pdfjs-dist 6.3.289）、表格（`client.excel.js`，6.7 MB，FortuneSheet + ExcelJS + SheetJS + PapaParse）、frontmatter（`client.frontmatter-fields.js`，YAML）都是独立 chunk，主 `client.js` 仅约 280 KB。
7. **安全靠"只读 + 边界 + 沙箱"三件事**：预览层无编辑能力；读取只经 Session 授权的文件服务（且有大小/行数上限）；静态 HTML 走 DOMPurify + CSP `default-src 'none'`，可交互 HTML 走 `sandbox="allow-scripts"`（无 same-origin）；图片/SVG 只以 Blob URL 进 `<img>`，SVG 标记从不进入应用 DOM。
8. **生态复用同一套预览**：文件树（`ui-sidebar-files`）逐层列目录并 `openResource`；交付卡/改动文件卡（`ui-deliverables`）打开「本轮 diff review tab」或预览；聊天里的文件引用、行内代码路径也走 `openResource`；Markdown 相对图片走宿主鉴权路由 `/api/file`。
9. **对 lyh-next 可借鉴的是分层与边界，而不是插件体系**：把「地址 + 元数据 + 有界读取 + 渲染器注册表 + 安全上限」搬进现在的 Nest + Next 架构即可；分栏/浮窗/可扩展槽位这些 Sidebar 能力不必照抄。

---

## 2. 架构总览

```
┌───────────────────────────── 浏览器（Web / Electron 同一套 React 插件） ─────────────────────────────┐
│  右侧 Sidebar（ui-sidebar-right）                                                                   │
│    ├─ tab 类型注册表 ctx.sidebarRightTabs；导航 ctx.sidebarRight.openResource / openTab              │
│    ├─ 布局：停靠格 / 分栏 / 浮窗 / 全屏；每 Session 布局存 localStorage（dsh.sidebar-right.v1.<sid>） │
│    │                                                                                              │
│    ├─ tab：文件树（ui-sidebar-files）── list 目录 → openResource(file address)                        │
│    ├─ tab：文档预览（ui-sidebar-documentpreview）                                                    │
│    │    ├─ 渲染器注册表 documentPreviews（扩展名 → 渲染器元数据 + keyed slot 正文）                   │
│    │    ├─ 共享加载/视图 store（按 tab 分桶）：页/完整字节、版本、选择、滚动、换行、导航 revision       │
│    │    └─ 渲染器：纯文本 / 代码 / Markdown / 图片 / PDF / HTML / 表格 / Office                      │
│    ├─ tab：diff review（ui-deliverables，本轮改动文件的快照对比）                                     │
│    └─ tab：浏览器（ui-sidebar-browser，HTTP(S) 页面，非文件预览）                                     │
│                                                                                                    │
│  资源层（dsh-client-resources）：useResource<'file'>(address) → WorkspaceFileStat + 变更观察           │
│  Remote（dsh-client-connection）：WebSocket RPC；二进制经 multipart 返回 Uint8Array                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                             │
┌───────────────────────────────────────────── Host（Node 进程） ──────────────────────────────────────┐
│  api-workspace-files：stat / read（行分页）/ readBytes（字节窗口或完整）/ list / changes（stream）        │
│  api-session-controller：GET|HEAD /api/file（鉴权媒体路由，Markdown 图片等）                             │
│  office-to-pdf：LibreOffice kit（原生引擎优先，缺省 WASM）→ PDF 字节 + 缺失字体列表                      │
│  fs / fs-local：执行世界的读权限；sandbox-policy 定义 Session 工作区根                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**组件清单**

| 包                           | 角色                 | 关键事实                                                                                                                                                                                                                                            |
| ---------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-sidebar-right`           | 面板与 tab 框架      | `ctx.sidebarRightTabs.register`（类型）+ keyed `sidebar.right.pane.tab`（正文）两阶段注册；导航控制器 `openResource(address, { params, replaceTab, preferNewPane, revealIfOpened })`；Tab 域保存 per-tab abort signal、navigation revision、actions |
| `ui-sidebar-files`           | 文件树 tab           | 根为 `Session.cwd`；每层 `workspaceFiles.list(sid, absPath)`；目录优先 + 自然序；行点击 `openResource(fileAddressFor(...))`；`changes` 监听自动刷新                                                                                                 |
| `ui-sidebar-documentpreview` | 预览 tab（本文重点） | 注册表 + 8 个内置渲染器；3 种加载模式；header 控件（渲染器下拉、换行、自动刷新、重载）；空态/失败分型                                                                                                                                               |
| `ui-deliverables`            | 交付与改动文件       | 改动文件卡、present 交付卡、收尾正文里的行内代码文件链接；review tab 渲染本轮 diff（快照非当前文件）                                                                                                                                                |
| `api-workspace-files`        | Host 读取服务        | `stat`/`read`/`readBytes`/`list`/`changes`；上限与错误码；不提供写操作                                                                                                                                                                              |
| `api-session-controller`     | 鉴权媒体路由         | `/api/file?path=<absolute>`，`sandbox` CSP、`no-store`、`nosniff`；不按 MIME/路径额外限制，取决于 `ctx.fs`                                                                                                                                          |
| `office-to-pdf`              | Office → PDF         | 调用方传「已授权源标识 + 版本 + 延迟有界读取」，返回 PDF 字节、缺失字体、缓存键、generation                                                                                                                                                         |
| `util-workspace-path`        | 地址与路径           | `fileAddressFor`、`parseFileAddress`、`fileMediaUrl`、`relativizeToCwd`                                                                                                                                                                             |

---

## 3. 资源地址与元数据

### 3.1 地址语法

`dsh-resource://file/session/<sessionId>/<path>`，`path` 可为相对 Session 工作区根，也可为绝对路径；地址里的 `Session` 就是授权主体。

- `fileAddressFor(sessionId, cwd, path)`：绝对路径若在工作区根下，会剥成工作区相对路径；工作区外的绝对路径原样保留；相对路径直接透传。**[源码]** `util-workspace-path/lib/index.js`
- `absolute/<path>` 地址仍能解析，但没有授权 Session，读取以 `workspace-file/unknown-workspace` 失败，**不借用当前 Session**。
- Host 原样收到路径并负责解析与权限判断；Client 不需要知道 `cwd`。
- 地址里的 `.` / `..` 段保留在路由与内容身份中，由 Host 解析。
- 同一个地址 = 同一个内容身份：不同目录同名文件、同一路径在两个 Session 下，都是不同的 tab。

### 3.2 元数据与变更观察

`useResource<'file'>(address)` 返回 `WorkspaceFileStat`：

```ts
interface WorkspaceFileStat {
  absolutePath: string
  version: string // 由 Host 的 stat 生成，页面/字节响应都携带同一版本
  bytes?: number // Host 能报告时的整文件大小
}
```

`dsh-client-resources` 的 `file` 提供方（在 `api-workspace-files` 的 Client 半部注册）语义：

1. 先订阅 `changes(address)`，等到 `{ kind: 'ready' }` 后发首次 `stat`；
2. ready 之前与读取期间的变化先排队，ready 后按 Host 返回的 `absolutePath` 重新 `stat`；
3. 版本重复的变更忽略；stat 失败后仍跟随地址，后续目标变化可恢复；
4. 同一地址的所有消费者共享一条受监督的 `changes` 流，最后一个订阅者离开时释放；
5. 载体掉线重连后，新 ready 触发重新 `stat`；最后一份元数据在重新打开前仍可读。

这层把「文件是否变了」做成可观察值，预览的自动刷新、文件树自动刷新都是它的下游，而不是各自轮询。

---

## 4. 读取面（Host 服务）

### 4.1 方法

| 方法                                     | 返回                                                          | 语义                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `stat(path)`                             | `{ absolutePath, version, bytes? }`                           | 普通文件身份、版本与大小，不含内容                                                                    |
| `read(path, { offset?, limit? })`        | `{ absolutePath, version, bytes?, offset, text, lines, eof }` | UTF-8 文本的**行窗口**；`offset` 1 起算，默认 1；`limit` ≤ `maxLines`                                 |
| `readBytes(path, { range?, baseFile? })` | `{ absolutePath, version, bytes?, offset, data, eof }`        | 完整文件或有界字节窗口；`data` 是 `Uint8Array<ArrayBuffer>`                                           |
| `list(path)`                             | `{ path, entries, truncated }`                                | 目录的直接子项（文件、目录、other）                                                                   |
| `changes(path)`                          | stream: `{ kind:'ready' }` 后跟 `{ kind:'change', change }`   | 文件或目录直接子项的变化；`change` 为 `{ absolutePath, version }` 或 `{ absolutePath, absent: true }` |

配置默认值（Host 侧，均可由条目配置覆盖）：

| 字段           | 默认   | 含义                                                        |
| -------------- | ------ | ----------------------------------------------------------- |
| `maxBytes`     | 2 MiB  | 单页文本 / 单个字节窗口上限，超出以 `too-large` 失败        |
| `maxFileBytes` | 32 MiB | `readBytes` 不带 `range` 时的完整文件上限，超出失败、不截断 |
| `maxLines`     | 5000   | 页大小默认值与上限；更大的 `limit` 直接拒绝                 |
| `maxEntries`   | 2000   | 目录条目上限，其余丢弃并置 `truncated`                      |

### 4.2 文本分页细节

**[文档]** `api-workspace-files/README.zh.md` §分页 + **[源码]** `lib/index.js` 切页器：

- `offset` 是 **1 起算的首行**；`limit` 为该页最多行数，不得超过 `maxLines`。
- 页的 `text` 以 `\n` 连接，**最后一行后不带终止符**；`lines` 是页内行数，用于区分「一个空行」与「越过文件末尾的空页」。
- `eof` 在该页含文件最后一行时为 `true`；offset 越过末尾返回空页且 `eof=true`。
- Host **只读到该页之后的第一个字符为止**，所以再大的文件每页请求也只占一页内存。
- 每页携带 `version` 与整文件 `bytes`；前端据此发现版本切换。
- 文本页拒绝无效 UTF-8 与 NUL 字节（`not-text`），字节读取不做该检查。

### 4.3 字节与二进制

- `readBytes({})` 在 `maxFileBytes` 内读完整文件；`{ range: { offset?, length? } }` 是 0 起算字节窗口，窗口超过 `maxBytes` 以 `too-large` 失败而不是截成小窗口。
- 传输经 Connection 的 **multipart 响应**：JSON 元数据 + 原始字节，生成的 Client 直接得到 `Uint8Array<ArrayBuffer>`，无 base64 解码。
- `baseFile` 让相对路径以「另一个文件所在目录」为基准解析（Markdown 相对图片、HTML 相对脚本/样式都用到），允许基准或目标在工作区外。
- 读取只做普通文件检查；目录列举与目录监听才强制工作区包含；失败码：`workspace-file/not-found`、`too-large`、`not-text`、`not-regular-file`、`not-directory`、`outside-workspace`、`unknown-workspace`、`unsupported-address`。

### 4.4 鉴权媒体路由 `/api/file`

**[源码]** `api-session-controller/lib/index.js`（`media-references.js` 区域）：

```ts
GET|HEAD /api/file?path=<absolute>
```

- 连接服务先鉴权，然后交给 `ctx.fs` 解析与读取；
- 只接受绝对路径，标题头固定 `Cache-Control: private, no-store`、`X-Content-Type-Options: nosniff`、
  `Content-Security-Policy: sandbox; default-src 'none'`；
- 大小上限取 `attachments.imageLimits.maxImageBytes`；超出 `413`；
- 路径与 MIME 不额外限制访问（权限由组合文件系统负责），因此它是一条**媒体读取**通道，不是工作区受限读取。

它的主要消费者是 Markdown 里的图片：`fileMediaUrl(base, path)` 生成 `api/file?path=...` URL，绝对路径由文件元数据给出，相对路径等 `absolutePath` 到位后再解析。

---

## 5. 渲染器注册表

### 5.1 注册形状

**[源码]** `ui-sidebar-documentpreview/lib/client.js`（`lib/types/client/document/registry.js`）：

```ts
ctx.documentPreviews.register({
  id: string,                  // 唯一，重复注册抛错
  extensions: string[],        // 不带点、大小写归一；未知扩展名由纯文本渲染器接住
  binaryExtensions?: string[], // 必须是 extensions 的子集；这些后缀不提供“纯文本”选项
  priority?: 'extension' | 'builtin',   // 默认 extension；只决定排序档
  title: () => string,
  loading: 'text-pages' | 'bytes-complete' | 'renderer',
  wrap?: boolean,              // 决定 header 是否显示换行开关
})
```

元数据注册与正文注册分开：正文以同一个 `id` 注册到 keyed、Session 作用域的 slot `sidebar.right.tab.document`，接收 `resourceAddress`、`content`、`wrap`、`scrollportRef`、`addResource`、`setResources` 与标准 `useTabInfo`/`useResource`。注册表保留所有匹配备选，因此下拉切换不依赖"最后注册"。

### 5.2 选择算法

```text
candidates(path):
  matched = 注册表中后缀命中 filename 的渲染器
优选顺序：extension 档 > builtin 档
        → 命中后缀更长者（支持 tar.gz 这类复合后缀）
        → 注册顺序更早者
owner 追加纯文本兜底的条件：
  matched 非空且声明了 binaryExtensions → 只保留 matched，不提供纯文本
  matched 为空且后缀在 UNVIEWABLE_BINARY_EXTENSIONS 中 → 空态，不发起读取
  其余（text 兼容）→ 追加纯文本渲染器作为最后一个候选
selected = 用户上次选择（仍可用时） ?? candidates[0]
```

**[源码]** `TextPreview`（`lib/client.js:595` 起）正是这段逻辑；`UNVIEWABLE_BINARY_EXTENSIONS` 覆盖视频、音频、压缩包、Office、可执行文件、字体等"字节永远不是可读文本"的类型。

细节：

- `canOpen(address)` 只接受 Session 作用域地址；裸 `absolute` 地址不由预览接管。
- 整个地址就是内容身份，不同目录同名文件是两个 tab；tab 标题用解码后的 basename，并按扩展名放 `FileTypeIcon`。
- 多候选时 header 显示渲染器下拉；只有一个候选时不显示控件。
- 未知扩展名落到纯文本；纯文本选项只对文本兼容源显示。
- 已知二进制容器后缀若无渲染器，显示文件类型图标 + "不支持预览"说明，**不会发起读取**（因此不会因读取大二进制而卡顿）。

### 5.3 内置渲染器矩阵

| 渲染器         | extensions                                        | loading          | wrap    | 依赖/说明                                                     |
| -------------- | ------------------------------------------------- | ---------------- | ------- | ------------------------------------------------------------- |
| 纯文本（兜底） | `[]`                                              | `text-pages`     | `true`  | 共享文本分页读取；等宽字体                                    |
| 代码           | `CODE_HIGHLIGHT_EXTENSIONS`（ui-primitives）      | `text-pages`     | `true`  | 共享 `CodeBlock`（`languageForPath`、行号、复制、增量流式）   |
| Markdown       | `md`、`markdown`                                  | `text-pages`     | `false` | 共享 Markdown 渲染器；frontmatter 懒加载；相对图片解析        |
| 图片           | `png` `jpg` `jpeg` `gif` `webp` `bmp` `ico` `svg` | `bytes-complete` | `false` | Blob URL + `<img>`；SVG 不进 DOM；缩放 25%–400%               |
| PDF            | `pdf`                                             | `bytes-complete` | `false` | 懒加载 `client.pdf.js`；pdfjs-dist 6.3.289；页虚拟化 + 文本层 |
| HTML           | `html` `htm`                                      | `bytes-complete` | `false` | 静态 CSP 模式 / 可交互 Blob 沙箱两套                          |
| 表格           | `xlsx` `xls` `csv` `tsv`                          | `bytes-complete` | `false` | 懒加载 `client.excel.js`；Worker 内解析                       |
| Office         | `doc` `docx` `ppt` `pptx`                         | `renderer`       | `false` | Host `office-to-pdf` 转 PDF 后嵌套复用 PDF 正文               |

（Markdown 的 `wrap` 为 `false`：它固定按文档排版；纯文本/代码由 header 的换行开关控制。）

### 5.4 三种 loading 的语义

| loading          | owner 做什么                                                                             | 正文拿到什么                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `text-pages`     | 首次挂载读第 1 页；滚到底/点「加载更多」读下一页；`eof` 结束                             | `{ kind:'text', text, pages, eof }`：**累计前缀**，不是单页文档                            |
| `bytes-complete` | 一次 `readBytes`，受 `maxFileBytes` 限制                                                 | `{ kind:'bytes', data }`：`Uint8Array`                                                     |
| `renderer`       | 只调用 `prepareRenderer(tabId, signal, rendererId, version)`；正文在**读任何字节前**挂载 | `{ kind:'renderer', revision, loaded, failed, reload }`，由正文自己的 Remote face 负责加载 |

`renderer` 模式把「读什么、怎么读」交给具体渲染器，共享 store 不保存 Office 的 PDF 字节或字体元数据；这也是 Office 能带自己的缓存与 generation 的原因。

---

## 6. 三种加载模式的实现

### 6.1 text-pages：分页文本与增量渲染

**[源码]** `lib/client.js` 的 store/face（约 1260–1400 行）：

- store 按 tab 分桶：`pages`（`offset → { text, lines }`）、`eof`、`version`、`observedVersion`、`loading`、`failure`、`wrap`、`scrollTop`、`revision`。
- 首读 `read(path, { offset: 1 }, signal)`；`loadedPages` 把页按 offset 排序拼成累计前缀，Markdown/代码按**整段前缀**渲染，而不是把每页当独立文档。
- 读下一页：正文滚动到距底 1px 内自动 `loadNext()`，同时保留「加载更多」按钮（键盘/屏幕阅读器路径）。
- **版本护栏**：若后续页返回的 `version` 与已显示版本不同，前端 `restart` 丢弃所有页并从第 1 页重读，避免半新半旧。
- 失败：没有内容时满屏显示失败空态（文件类型图标 + 说明 + 对应出路）；已有内容时在内容下方显示失败行 + 重试，**不清空已显示文本**。
- 读取与重载可被新的选择或 tab 关闭中止：`AbortController` 按 tab 保存，`generation` 计数丢弃过期响应。
- 行号导航（`navigation.params.line`）：
  - 纯文本/代码有源码行锚点；Markdown 没有；
  - 若目标行 > 已加载末行且未 EOF，则继续 `readPage(loadedThrough + 1)` 直到覆盖目标行，再滚动到该行并记录 `navigation.navigated`；
  - 字节模式渲染器不消费源码行导航；无锚点的渲染器会让导航保持 pending，切到纯文本/代码后执行。
- 滚动位置按 tab 保存，正文卸载/切 tab 后恢复。

代码正文用共享 `CodeBlock`（`ui-primitives`）：

- `languageForPath(file.path)` 推断语言；
- `lineNumbers: true`，复制文本不含行号；
- `streaming: !content.eof`，分页追加时保持同一代码块，不重建 Shiki 高亮上下文；
- 代码坐在预览分栏自己的背景上（不套会话卡片底色），复制条与内部滚动区相邻。

### 6.2 bytes-complete：完整字节

- `loadAll` 用 `AbortSignal.any([tab.signal, ownController.signal])` 发一次 `readBytes(sessionId, path, {}, signal)`；
- 成功 `actions.complete(tabId, file)`：`eof=true`、`version` 记录、`loading=false`；
- 失败保留已有内容（通常没有），置 `failure`；
- 模式切换（换渲染器、重载）会 abort 旧请求、`generation++`、`actions.reset`；
- 字节只存在临时视图状态，**绝不进入持久布局或 Session JSONL**；
- PDF 与表格渲染器在传给 Worker 前会**复制**保留的字节（`bytes.slice()` 或传输副本），保证 Preview 缓冲区仍可用。

### 6.3 renderer：Office 的"先转 PDF 再预览"

Office 是唯一用 `renderer` 模式的渲染器（`lib/client.js:6060` 起）：

1. 注册时 `extensions = doc/docx/ppt/pptx`，`binaryExtensions` 同集合，`loading: 'renderer'`；正文挂载后自己请求转换，**共享 store 只拿到 revision/loaded/failed/reload**。
2. 转换走 Host `office-to-pdf`：`ctx.officeToPdf.convert()` 接收授权源标识、版本、可选字节数、**延迟的有界读取**、扩展名、调度优先级；**源版本变化会拒绝转换**。
3. Remote 方法 `officeToPdf.render(sessionId, path, priority)`：先用 `workspaceFiles` 重新授权 + 检查源版本，再在转换预留容量内 `fs.readBytes`；返回 PDF 字节、缺失字体、缓存键、generation（multipart 传输）。
4. 客户端 `OfficePreviewCache`（读取前再校验一次 generation 与授权）：
   - 身份 = `(generation, session, absolutePath, sourceVersion)`；
   - 默认缓存 8 个 PDF / 64 MiB，未完成 8、读取方 32；
   - 同一 source 共享进行中的转换；取消一个读取方不会终止共享转换，直到最后一个读取方离开；
   - 失败与超限 PDF 不保留；PDF 从不持久化；
   - 渲染器替换会重新查 generation；重试期间再次替换显示"任务较多"。
5. 正文把转换结果作为嵌套 PDF slot 渲染，复用 PDF 的加载、缩放、文本选择与取消；转换中的状态是居中 `StateDot` + "文档渲染中..."。
6. 缺失字体：文档工具栏刷新按钮前显示黄色三角警告，点击打开字体列表；刷新会关闭旧列表，不保留已读状态。
7. 错误分型：`unavailable`（Host 未启用服务，显示配置引导）、`invalid`（损坏/加密/扩展名不符）、`tooLarge`、`failed`、`timeout`、`busy`、`changed`（读取时源变了）。

Host 侧参数：`maxConcurrentConversions=2`、`timeoutMs=60000`、`maxInputBytes=50 MiB`、`maxOutputBytes=100 MiB`、`maxImageResolution=192`；原生有对应 LibreOffice kit 时用原生引擎，否则 WASM；不查找系统 LibreOffice、不在运行期下载引擎。

---

## 7. 各渲染器细节

### 7.1 Markdown

- 共享 Markdown 渲染器（`ui-primitives`）+ GFM；增量渲染累计前缀。
- **frontmatter**：文档开头 `---` 到 `---`/`...` 的 YAML 在正文上方显示为键值列表；字符串值显示解析后文本（含折叠/多行），其他标量/列表/映射/别名保留原始 YAML；无效 YAML 或非映射原样显示整块；未闭合块按 Markdown 渲染。YAML 解析器在独立 chunk `client.frontmatter-fields.js`，仅在文档含 frontmatter 时加载；源文件不被修改。
- **相对图片**：
  - `markdownImageUrl(baseURI, documentPath, destination)`：HTTP(S) 图片保留原 URL；本地图片要求应用基址为 HTTP(S)（或 `dsh-app://app/`），用 `fileMediaUrl` 生成鉴权 `/api/file?path=` URL；
  - 相对路径等 Host 返回 `absolutePath` 后再解析；URL 转义只解码一次；查询参数与 `#` 片段不计入文件名；
  - 加载失败的图片显示 alt 文本；图片文件不加入自动刷新依赖。
- 不做裸 HTML 直出（Markdown 源里的 HTML 由 Markdown 渲染器处理，预览层不额外放行）。

### 7.2 代码

- 扩展名集合来自 `ui-primitives` 的 `CODE_HIGHLIGHT_EXTENSIONS`；语言由 `languageForPath` 推断。
- 与纯文本共用分页读取与累计前缀；`streaming: !eof` 让 Shiki 高亮在追加页时继续。
- 行号默认开；复制不包含行号；长行按 header 的换行开关折行。
- 行号导航直接滚动内部源码视口（`scrollToLine`），不经过 Markdown。

### 7.3 HTML（两套模式）

由插件装配层给正文注入 `interactivePreview`（Web 与桌面都取"代码工作工具"开关，`ctx.configForms.developerTools.enabled`）。

**静态模式（默认）** **[源码]** `createBasicHtmlDocument`：

```ts
const clean = DOMPurify.sanitize(decodeText(data), {
  WHOLE_DOCUMENT: true,
  FORBID_TAGS: ['noscript', 'base', 'link', 'meta', 'iframe', 'frame', 'object', 'embed', ...],
  FORBID_ATTR: ['href', 'xlink:href'],
})
// 再插入并前置 CSP
default-src 'none'; script-src 'none'; style-src 'unsafe-inline';
img-src data:; font-src data:; media-src data:; connect-src 'none';
frame-src 'none'; form-action 'none'; base-uri 'none'
```

- 放进 `sandbox=""` 的 iframe（空值即最严格限制，配合 `srcDoc`）；
- 行内样式与 data 图片可显示；脚本、外部资源、连接、表单、嵌套框全禁；
- 所有 `href`/`xlink:href`、刷新指令、声明式 Shadow DOM 在重新解析前移除；
- 不读取关联文件。

**可交互模式（仅开发工具开启）**：

- 完整 HTML 打成 Blob，iframe `sandbox="allow-scripts"`（**不含** `allow-same-origin`）；
- 渲染器通过注入的 Remote 回调收集**直接声明**的相对 `.js` 经典脚本与 `.css` 样式表：
  - 单个资源 ≤ 4 MiB、总计 ≤ 32 MiB、最多 64 个；
  - Host 用 `readBytes(sessionId, relativePath, { baseFile: file.path })` 解析关联路径并返回原生字节；
  - `<base href>` 交给浏览器解析依赖；HTTPS 资源由浏览器处理；
  - 本地模块 `import`、CSS `url()`/`@import`、动态 `fetch` 不支持 Host 文件桥；
  - 任一资源失败/非法 UTF-8/超限 → 整个预览失败，不发布部分资源包。
- iframe 名称 `dsh-sidebar-html-<tab-id>`，供桌面快捷键路由关联目标；这种关联**不授予**预览访问父文档的权限。
- 切换模式会卸载旧框架并中止待处理关联读取；静态模式会释放依赖资源订阅，但根文件继续监听。
- 替换/卸载文档会撤销 Blob URL。

### 7.4 图片

- 扩展名：PNG/JPEG/GIF/WebP/BMP/ICO/SVG；字节型后缀（除 SVG）声明为 binary，因此不提供纯文本。
- `<img>` + Blob URL（12px 内边距、圆角）：默认适应宽度，但**不放大**小于面板的图；100% 时按固有 CSS 像素。
- 共享缩放控件：适应宽度 / 25% / 50% / 100% / 150% / 200%，精细指针设备上控件在底部 72px 内滑入；缩放不替换 `<img>` 与 Blob URL，因此动图继续播放。
- 位图放大后可能变虚，SVG 继续矢量渲染。
- **SVG 标记绝不进入应用 DOM 或 iframe**，因此其中脚本无法执行、无法访问父页面；替换/卸载撤销 Blob URL。

### 7.5 PDF

- 仅在 PDF 预览挂载时加载 `client.pdf.js`（6.8 MB，pdfjs-dist 6.3.289、Worker 源码、内嵌支持数据都不进启动 `client.js`）。
- 纵向页面序列，页间距与四周留白 12px；适应宽度默认；页在接近视口时惰性渲染，未渲染页以 3:4 占位块保持滚动位置；视口附近页在最终缩放 × DPR 下重绘。
- 每页位图上限 16,777,216 像素；超出（超大页/高 DPR）可能低于设备分辨率。
- 文本层用 PDF.js 官方 `TextLayerBuilder`：可选区、复制文本规范化、半透明蓝色选区；纯图片 PDF 无可选文本。
- 缩放：适应宽度 / 25%–400% 固定档；100% = 96 DPI 页面尺寸；控件与图片共用；Chromium 触控板捏合映射到 Ctrl+滚轮路径，手势期间控件显示比例，静止后比例在正文重挂载后保留。
- 页面释放时取消画布与文字层渲染；页滚动恢复不保证（字节视图重挂载可能回顶部）。
- PDF chunk 加载失败后，React 会缓存被拒绝的 lazy import，需刷新页面；普通 PDF 打开/渲染失败仍可重试。

### 7.6 表格（xlsx / xls / csv / tsv）

- 懒 chunk `client.excel.js`：FortuneSheet（`@fortune-sheet/core` + `react`）+ ExcelJS 4.4.0（XLSX）+ SheetJS CE 0.20.3（XLS）+ PapaParse 5.7.0（CSV/TSV）。
- 每次解析一个独立可释放的 **Worker**，传输保留字节的副本；替换/卸载/失败/超时都终止 Worker。
- 上限：`maxBytes=16 MiB`、`maxCells=250000`（所有工作表矩形区域合计，含空单元格）、`timeoutMs=15000`；超限或超时 → 表格预览失败（不静默降级）。
- 浏览器内直接打开，**不调用 Office 转换服务**；只读：工作表标签、单元格选择、复制、只读公式栏；无编辑、无重算、无导出。
- 保真边界：XLSX 保留字体/纯色填充/边框/数字格式/富文本/合并/行列尺寸/隐藏行列/冻结标题；XLS 只保留已保存值/公式/数字格式/合并及可用的行列元数据；公式结果显示缓存值，缺失结果为空并提示可能不完整。
- **移除 DrawingML**：解析前从内存副本移除 `xl/drawings/*` 部件并忽略工作表的绘图引用，原文件不动；若实际检测到图表/图片/形状/条件格式，表格上方提示"未展示，建议用系统应用打开"。未检测到则无提示。
- CSV/TSV 默认表格查看器，也可选择纯文本；CSV 还提供带语法高亮的 Code 预览。首行仍作数据；值保持字面字符串（前导零、日期、布尔、类公式文本不转换）；支持引号内分隔符、转义引号、多行字段、空字段、不等长行；引号格式错误使表格预览失败，不静默丢数据；文本文件支持 UTF-8 或带 BOM 的 UTF-16，非法编码显示转换提示。
- 表格视图填满面板并随尺寸自适应；标签溢出可横向手势/左右按钮滚动；冻结标题固定但无分隔线/拖拽条；隐藏选区统计栏；表格控件在明暗主题下都保持浅底深字。
- ExcelJS 打补丁（`patches/exceljs@4.4.0.patch`）：关系解析、Strict OOXML 映射、UTF-16 部件、CDATA、大小写等价歧义等；升级依赖需保留补丁入口与回归测试。

### 7.7 Office

见 §6.3；与 PDF 共用缩放、文本选择、取消与加载状态；转换产物在客户端缓存，不进 Session 持久化。

---

## 8. 入口与 Sidebar 集成

### 8.1 tab 系统

- 两阶段注册：类型用 `ctx.sidebarRightTabs.register({ id, kind, patterns, priority, canOpen?, title, guide?, keepMounted? })` 声明；正文用 keyed slot `sidebar.right.pane.tab` 以同一 `id` 注册。
- 资源类型的 `patterns` 是针对 `dsh-resource://` 地址的 glob：含 `:` 匹配整个地址（`dsh-resource://file/**`），不含则匹配 URI 路径任意深度且忽略大小写（`*.md`）。
- 优先级档 `extension` / `builtin` / `fallback`；`canOpen` 可否决一次命中；`kind` 最多一份 builtin + 一份 extension。
- tab 是"每 Session 一棵停靠树"：分栏、浮窗、全屏切换不重挂载内容树；布局、tab 身份、选中项、分栏比例、浮窗矩形以 JSON 存 `dsh.sidebar-right.v1.<sessionId>`（localStorage），刷新时先恢复布局再渲染正文。
- Tab 域按 `(Session, tabId)` 保存 occurrence、导航 revision、abort signal 与绑定动作；`keepMounted: true` 的正文在切 tab/切 Session/收起/停靠切换间保留，未访问的正文不提前挂载。
- `close(tabId)`、`focus(tabId)`、`split`、`float`、`dock`、`toggleExpanded`、`toggleFullscreen` 都由控制器提供；每个动作只记录一条历史，布局由 dockkit 的纯函数计算。

### 8.2 导航

```ts
ctx.sidebarRight.openResource(address, {
  params: { line }, // 预览声明 { line?: number }
  revealIfOpened: true,
  replaceTab,
  preferNewPane,
})
```

- 已展示同一 `(kind, contentId)` 的 tab 会被聚焦，不限分栏；`revealIfOpened: false` 时不聚焦；页 tab 始终只在目标分栏内去重。
- 新 tab 落到 `replaceTab` 所在格 → `paneId` → 活跃停靠格；随后面板展开（用户看不到的内容不算打开）。
- 导航到达正文：`navigation.params`、`navigation.revision` 递增，不进布局历史；每个 revision 只响应一次，重挂载恢复阅读位置而不是再跳一次。
- 未注册的 kind、无人认领的地址、`dsh-resource://` 之外的地址都会抛错（接线错误）。

### 8.3 文件树

- 根 = `useSessions().byId[sessionId].cwd`；每层以绝对路径为键；首次展开时 `workspaceFiles.list(sessionId, absolutePath)`。
- 行序：目录优先，其后自然序、不分大小写的名称；dotfiles 照常显示；`other` 类型灰显不可点，完整呈现目录内容。
- 行点击：`fileAddressFor(sessionId, root, entry.absolutePath)` → `openResource`，**落在该 tab 自己所在的 pane**。
- 每个打开目录持有自己的 `changes` 监听；折叠关闭节点及其不可见后代；自动刷新默认开；截断层以标记收尾；失败层按错误码显示一行。
- 状态按 tab 分桶（root、levels、expanded、autoRefresh、scrollTop），切走再切回树带已加载层重新挂载并恢复滚动位置。
- 限制：只有列目录，没有搜索/过滤/拖拽/重命名/右键/当前文件高亮；只有一个根。

### 8.4 交付卡与 diff review

`ui-deliverables` 是预览的"发现层"：

- **改动文件卡**：已完成轮次末尾列出本轮改动文件与增删行数（Host 记录），悬浮 500ms 出单列改动浮层；点击在 Sidebar 打开本轮 `changes-review` tab 并选中该文件；单文件时标题就是文件名。
- **交付卡**：`present` 工具声明的文件，卡片点击打开预览；原生"用默认应用打开"由 `ui-open-in-app` 提供（桌面存在时），不会创建文件副本。
- **行内代码链接**：收尾正文中的行内代码按精确路径/记录参数/唯一 basename 解析到产出或交付文件，点击打开预览；有歧义保持不可点击，不做后缀或当前目录猜测。
- **review tab**：`changes-review` 地址携带 Session、宣告序号、轮号；读取认证路由拿到摘要与每个文件的 diff，按 hunk 渲染双列/单栏，行号与增删底色；5000 行处停止绘制；对比是**本轮快照**，不是当前文件。
- 这一层与文档预览共用 `openResource`、`PathLabel`、open-in-app 动作，但不共享渲染器注册表。

### 8.5 其他入口

- 会话里的文件链接、工具行的行号引用：`openResource(fileAddress, { params: { line } })`。
- 聊天附件（`ui-attachment`）：composer 草稿附件栏、拖放遮罩、消息图片画廊与原图灯箱，属于**附件呈现**，与 Sidebar 文件预览不是同一条链路；图片灯箱不复用预览渲染器。
- 浏览器 tab（`ui-sidebar-browser`）：HTTP(S) 页面，不是本地文件；聊天链接偏好可选"应用内侧边栏"打开。

---

## 9. 安全、性能与限制

### 9.1 安全模型

| 维度     | 做法                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 能力     | 预览只读；没有编辑、搜索或写回接口；目录地址以 `not-regular-file` 失败                                                                                                           |
| 授权     | 地址携带 Session；Host 通过该 Session 的文件系统解析与鉴权；`absolute` 地址报 `unknown-workspace`                                                                                |
| 路径边界 | 读取用 `lstat` 拒绝非普通文件与末端符号链接（含指回工作区的链接）；目录列举/监听强制工作区包含；文本拒绝非法 UTF-8 与 NUL                                                        |
| 大小边界 | 页 2 MiB / 5000 行、完整文件 32 MiB、目录 2000 项、表格 16 MiB / 25 万格 / 15s、Office 50 MiB 入 / 100 MiB 出 / 60s、HTML 单资源 4 MiB / 总 32 MiB / 64 个、PDF 每页 1677 万像素 |
| HTML     | 静态：DOMPurify + CSP 全禁；可交互：`sandbox="allow-scripts"` 且无 `allow-same-origin`，脚本不能访问父应用源与文件读取接口                                                       |
| 图片/SVG | Blob URL + `<img>`；SVG 不进应用 DOM/iframe；替换/卸载撤销 URL                                                                                                                   |
| 媒体路由 | `/api/file`：先鉴权；`no-store`、`nosniff`、`Content-Security-Policy: sandbox`；绝对路径、大小上限                                                                               |
| 持久化   | 字节只存在临时视图状态，不进布局或 Session JSONL；Office PDF 从不持久化；本地文件内容不复制副本（原生打开除外）                                                                  |
| 模型面   | 预览不注册工具、提示词或会话事件；用户看到的内容不进入模型请求                                                                                                                   |

### 9.2 性能设计

- **启动体积**：主 `client.js` ~280 KB；PDF/Excel/frontmatter 各按需 chunk（6.8 MB / 6.7 MB / 204 KB）；PDF chunk 仅在 PDF 预览挂载时加载。
- **内存**：行分页让 Host 单次请求只读一页；完整字节上限 32 MiB；Worker 解析前复制副本；PDF 每页位图有上限。
- **渲染**：文本行块 memo 化；PDF 页虚拟化；表格视图随面板尺寸自适应而不重载工作表；滚动位置按 tab 保存。
- **观察**：自动刷新依赖共享的 `changes` 流而不是轮询；每个文件一个受监督流，订阅者共享。
- **缓存**：Office 客户端按 generation/路径/版本 LRU；失败与超限不缓存；连接重置清空字节并取消待完成读取。

### 9.3 已知限制（原文要点）

- 预览而非编辑；不提供编辑或共享搜索；目录地址以 `not-regular-file` 失败。
- Office 不启动原生 Office 编辑器、不下载引擎；二进制 `.doc`/`.ppt` 不返回缺失字体诊断；保真度由 LibreOffice kit 负责。
- 文本顺序分页，定位深处行需先加载之前各页；PDF/HTML/图片必须取得上限内完整字节。
- PDF 栅格分配有上限；超大页/高 DPR 下高倍缩放可能低于设备分辨率。
- 字节视图重新挂载/重载可能回到顶部（PDF/HTML/图片）；HTML iframe 滚动属于其不透明上下文。
- 本地 HTML 依赖集合有限（只打包直接引用的经典脚本与 CSS）；浏览器解析的资源仍受源/网络规则限制。
- 滚动写入未节流（每次滚动事件都写 store；行块 memo 化避免重渲染风暴）。
- PDF chunk 加载失败后需刷新页面（React 缓存被拒绝的 lazy import）。

---

## 10. 与本项目（lyh-next）的映射建议

### 10.1 现状

- 对话页只有文本消息；无附件上传、无文件树、无产物预览。
- 后端为 Nest + Prisma + Postgres；前端 Next App Router + shadcn；无插件/槽位体系，无 WebSocket RPC（SSE 已有 `stream.ts` 分层）。
- 已有能力可复用：`utils/api.ts` 的 axios 信封、`/api` 前缀、`Conversation`/`ChatMessage` 数据模型、Markdown 渲染（含 Shiki 代码块）。

### 10.2 若要做"会话产物预览"，最小闭环

**后端**（新增 `apps/backend/src/files` 模块，只读）：

| 接口                                         | 语义                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/files/stat?path=`                  | 返回 `{ path, version, bytes }`；`version` 用 mtime+size 或内容 hash；路径限定项目根/会话产物根 |
| `GET /api/files/read?path=&offset=&limit=`   | 行窗口，`offset` 1 起算，`limit` 默认/上限 2000；`text` 以 `\n` 连接；返回 `eof`、`version`     |
| `GET /api/files/bytes?path=&offset=&length=` | `application/octet-stream`；上限按用途分（图片/PDF 建议 10–20 MiB）；超限返回业务码，不截断     |
| `GET /api/files/changes?path=`               | 可选：SSE 推送 `version` 变化，或前端聚焦时轮询 `stat`；先做轮询更省                            |

要点：

- 路径安全：接受相对/绝对路径后 `path.resolve` + `fs.realpath`，再校验仍在允许根内；拒绝 `..`、NUL、符号链接指到根外；只读普通文件。
- 大小与行数上限走信封错误（示例码 `40001` 文件过大、`40002` 非文本，按 `docs/features/err-handing.md` 码表落位），前端按 code 分支。
- 媒体响应显式 `Cache-Control: no-store`、`X-Content-Type-Options: nosniff`、`Content-Security-Policy: sandbox`（与 DSH 对齐）。

**前端**（`/chat` 右栏或可折叠面板）：

```text
components/files/
├─ index.tsx           # 面板：header（路径/渲染器/换行/重载）+ 正文
├─ file-tree.tsx       # 目录树（可选，第一阶段可先由外部链接只预览单文件）
├─ preview-registry.ts # 扩展名 → 渲染器（优先级、binary、wrap）
├─ renderers/          # text / code / markdown / image / pdf
└─ hooks/use-file-preview.ts   # 读取、分页、版本变化、滚动位置
```

- 资源地址用项目自己的形式（如 `file:<sessionId>/<relPath>`），预览面板只认地址，入口（聊天里的文件链接、交付卡）只负责 `openFile(address, { line })`。
- 先做 5 个渲染器：纯文本、代码（复用现有 Shiki/CodeBlock）、Markdown（复用现有渲染器 + 相对图片走新增的鉴权媒体路由）、图片、PDF（`pdfjs-dist` 动态 import + 页虚拟化）。HTML 先静态纯文本或 DOMPurify 静态模式；Office 无 LibreOffice 时不做，显示"请用本地应用打开"。
- 文本渲染沿用 DSH 的**累计前缀**而非整页重渲染；`eof` 是唯一的结束条件；版本变化时从头重读。
- 交互：渲染器下拉、换行、重载、滚动位置、行号定位、失败分型（不存在/非普通文件/过大/非文本/传输失败各自出路）。

**不要照搬的部分**：多 Session 停靠树、分栏/浮窗/全屏、Tab 域与 occurrence、localStorage 布局持久化、插件两阶段注册、`renderer` 模式、Office 缓存与字体诊断、WebSocket multipart 二进制传输（REST 即可）。

### 10.3 与 DSH 的差异对照

| 维度     | DSH                                    | lyh-next 建议                              |
| -------- | -------------------------------------- | ------------------------------------------ |
| 预览容器 | 右侧 Sidebar tab（可停靠、分栏、浮窗） | `/chat` 内可折叠右栏或独立路由，单面板     |
| 入口     | 文件树、交付卡、聊天链接、行内代码     | 聊天文件链接 + 产物卡（可后续加）          |
| 数据面   | WebSocket RPC + multipart 二进制       | REST + octet-stream；变更用轮询或 SSE      |
| 渲染器   | 插件注册表（可被第三方扩展覆盖）       | 前端静态注册表（数组常量）即可             |
| 重渲染器 | PDF/Excel/Office/HTML 全覆盖           | 先文本/代码/Markdown/图片/PDF              |
| 安全     | Session 授权 + 多级上限 + HTML 双模式  | 路径白名单 + 上限 + 媒体 CSP + HTML 静态化 |

---

## 11. 证据与来源

**解包方式**：`app.asar` 头部 pickle → JSON 文件表 → 按 `offset/size` 读取；关键包解包到 `/tmp/dshpreview/`（临时目录，未入库）。

| 主题                         | 包                           | 依据                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 预览注册表 / 选择 / 三种模式 | `ui-sidebar-documentpreview` | **[源码]** `lib/client.js`：registry（约 305–355）、suffix/matching（251–296）、store/face（1262–1400）、`TextPreview`（595 起）、各渲染器定义（text 560、markdown 1674、html 4500、image 5245、pdf 5369、code 5483、excel 6260、office 6060）、懒加载（1574/5281/6188）、HTML CSP（4243）、沙箱（4415） |
| 读取服务与上限               | `api-workspace-files`        | **[文档]** `README.zh.md`「分页」「二进制读取」「变更流」「配置」「失败」；**[源码]** `lib/index.js`、`lib/client/*`                                                                                                                                                                                     |
| 媒体路由                     | `api-session-controller`     | **[源码]** `lib/index.js`（`/api/file`，约 2420–2500）、`lib/types/media-references.js`                                                                                                                                                                                                                  |
| Office 转换                  | `office-to-pdf`              | **[文档]** `README.zh.md`「使用此包」「理解实现」                                                                                                                                                                                                                                                        |
| 文件地址与路径               | `util-workspace-path`        | **[源码]** `lib/index.js`（`fileAddressFor`、`parseFileAddress`、`fileMediaUrl`）                                                                                                                                                                                                                        |
| Sidebar tab 与导航           | `ui-sidebar-right`           | **[文档]** `README.zh.md`「呈现形态」「扩展席位」「`ctx.sidebarRight`」「Tab 域」                                                                                                                                                                                                                        |
| 文件树                       | `ui-sidebar-files`           | **[文档]** `README.zh.md`「注册了什么」「树」                                                                                                                                                                                                                                                            |
| 交付卡 / diff review         | `ui-deliverables`            | **[文档]** `README.zh.md`「显式交付」「改动文件卡片」「review tab」「行内代码链接」                                                                                                                                                                                                                      |
| 附件边界                     | `ui-attachment`              | **[文档]** `README.zh.md`「草稿附件」「消息图片与灯箱」                                                                                                                                                                                                                                                  |
| 包版本                       | 各包 `package.json`          | `0.2.1-rc.2`；预览包依赖 `pdfjs-dist@6.3.289`、`exceljs@4.4.0`、`xlsx@0.20.3`、`@fortune-sheet/core` 与 `@fortune-sheet/react@1.0.4`、`papaparse@5.7.0`、`dompurify@3.4.16`、`yaml@^2.9.0`、`fflate@^0.8.3`、`fast-xml-parser@5.11.1`                                                                    |

**局限**：调研基于打包产物（minified/bundled 源码，但保留了 `lib/types/**.js` 与 region 注释）与包内 README，未运行 DSH、未对渲染器逐像素比对；DSH 的完整源码与设计笔记（`.agents/notes`、`docs/subsystems`）不在 asar 内，部分决策依据只能从 README 引用转述。
