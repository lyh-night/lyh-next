# 上传文件夹预览（files）

> 需求与实现说明：新增与 `/chat` 同级的 `/files` 页面。进入后先上传一个文件夹，
> 上传完成左侧显示文件树、右侧按类型预览文件内容；工作区临时保留 24 小时。

---

## 一、背景与目标

聊天页目前只处理文本消息，没有上传与文件预览能力。这里做一个独立的「文件预览」页面：

- 选择或拖拽**整个文件夹**上传，保留目录结构；
- 左侧文件树、右侧预览，点击文件即切换；
- 文本 / 代码 / Markdown / 图片 / PDF 五类渲染器；
- 文件不进入数据库，不参与对话上下文；预览只读，但可删除已上传的文件/目录；
- 上传后凭 `workspaceId` 刷新可恢复，24 小时后自动清理。

边界：

- 预览只读；支持删除单个文件/目录或整个工作区，不提供编辑、保存、重命名、搜索、下载管理；
- 不做 Office / Excel / HTML 预览（Office 需要 LibreOffice，本版不引入）；
- 不做多文件夹管理页：一次上传对应一个工作区，换文件夹即新建；
- 不接入 AI：文件仅供人看，后续若要让模型读取，需要在工作区上再设计工具调用。

---

## 二、术语与数据

| 名词                      | 含义                                                       |
| ------------------------- | ---------------------------------------------------------- |
| 工作区（`FileWorkspace`） | 一次「上传文件夹」的容器，一条数据库记录 + 一个磁盘目录    |
| 相对路径                  | 文件相对工作区根的路径，统一用 `/` 分隔，如 `src/index.ts` |
| 目录树                    | 后端递归扫描磁盘得到的扁平条目列表，前端组装成树           |
| 文本页                    | 按行切分的一页内容（`offset` 1 起算），用于大文件增量渲染  |

### 2.1 数据模型

`apps/backend/prisma/files.prisma`：

```prisma
model FileWorkspace {
  id         String   @id @default(cuid())
  userId     String
  name       String   @default("上传的文件夹")
  fileCount  Int      @default(0)
  totalBytes Int      @default(0)
  createdAt  DateTime @default(now())
  expiresAt  DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
}
```

文件内容不进数据库，落盘到：

```text
$FILES_STORAGE_DIR/<userId>/<workspaceId>/<相对路径>
```

`FILES_STORAGE_DIR` 默认 `storage/files`（相对后端进程 cwd）。Docker Compose 已挂载
`backend_storage:/app/apps/backend/storage`，容器重建后未过期的文件仍在。

### 2.2 上限

| 项           | 值                                 |
| ------------ | ---------------------------------- |
| 工作区有效期 | 24 小时                            |
| 单个文件     | 20 MiB                             |
| 工作区总量   | 200 MiB                            |
| 文件数       | 500                                |
| 每用户工作区 | 10 个（同时保留）                  |
| 目录树条目   | 2000（超出置 `truncated: true`）   |
| 文本页       | 默认 1000 行，上限 2000 行 / 2 MiB |

前端在开始上传前做同样的预校验（数量、单文件、总量），服务端仍是最终裁决方。

---

## 三、接口契约

统一前缀 `/api/files/workspaces`，全部需要登录；每个接口都校验工作区归属
（`FileWorkspace.userId === 当前用户`）。JSON 响应走扁平信封，`/bytes` 例外。

| 方法     | 路径                             | 说明                                          |
| -------- | -------------------------------- | --------------------------------------------- |
| `POST`   | `/`                              | 创建工作区（上传前调用）                      |
| `GET`    | `/:id`                           | 工作区元信息                                  |
| `DELETE` | `/:id`                           | 删除工作区（数据库记录 + 磁盘目录）           |
| `DELETE` | `/:id/entry?path=`               | 删除单个文件或目录（目录递归删除）            |
| `POST`   | `/:id/upload`                    | 上传单个文件（multipart：`file` + `path`）    |
| `GET`    | `/:id/tree`                      | 扁平目录树（目录优先，最多 2000 项）          |
| `GET`    | `/:id/stat?path=`                | 文件元信息（大小、更新时间）                  |
| `GET`    | `/:id/read?path=&offset=&limit=` | 按行分页读取 UTF-8 文本                       |
| `GET`    | `/:id/bytes?path=`               | 原始字节（图片 / PDF 预览，`StreamableFile`） |

### 3.1 创建

```http
POST /api/files/workspaces
{ "name": "my-project" }
```

```json
{
  "code": 0,
  "message": "",
  "data": {
    "id": "clx...",
    "name": "my-project",
    "fileCount": 0,
    "totalBytes": 0,
    "createdAt": "2026-11-21T08:00:00.000Z",
    "expiresAt": "2026-11-22T08:00:00.000Z"
  }
}
```

### 3.2 上传

`multipart/form-data`：

- `file`：文件内容（multer 内存存储，单文件上限 20 MiB）；
- `path`：相对路径，如 `src/components/app.tsx`。

返回已写入文件的 `{ path, name, type: "file", size }`。同一路径重复上传是**覆盖**
（配额按差值更新），因此失败重试是幂等的。

### 3.3 目录树

```json
{
  "entries": [
    { "path": "src", "name": "src", "type": "directory" },
    { "path": "src/index.ts", "name": "index.ts", "type": "file", "size": 1024 }
  ],
  "truncated": false
}
```

后端按「目录优先 + 自然序」输出；前端仍会重新排序，避免依赖顺序。

### 3.4 文本分页

```http
GET /api/files/workspaces/:id/read?path=README.md&offset=1&limit=1000
```

```json
{
  "path": "README.md",
  "offset": 1,
  "lines": 42,
  "text": "# 标题\n...",
  "eof": true,
  "size": 2048
}
```

语义与 DSH 对齐：

- `offset` 1 起算；`text` 以 `\n` 连接、最后一页行尾不带终止符；
- 尾随换行不额外产生空行；空文件返回空页且 `eof: true`；
- 只读取当前页 + 一行前瞻，内存与文件大小无关；
- 非法 UTF-8 / NUL 直接判为非文本（`40005`）；
- 单页超过 2 MiB 抛「内容过大」（`40003`）。

### 3.5 字节

`GET /:id/bytes?path=` 直接返回文件流，设置：

```text
Content-Type: <按后缀推断，未知类型 application/octet-stream>
Content-Length: <size>
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
Content-Security-Policy: sandbox; default-src 'none'
Content-Disposition: inline|attachment
```

图片 / PDF 为 `inline`，其余为 `attachment`（前端不会用它打开 HTML）。前端用
`fetch` + `credentials: 'include'` 取 Blob（该路由不包 JSON 信封，失败时才返回信封 JSON）。

### 3.6 删除文件 / 目录

```http
DELETE /api/files/workspaces/:id/entry?path=root/sub
```

```json
{ "path": "root/sub", "type": "directory" }
```

- 文件直接删除；目录递归删除其中所有内容，不能通过该接口删除工作区根（空路径会被 `40002` 拒绝）；
- 删除后重新扫描工作区统计 `fileCount` / `totalBytes`，避免递归删除后计数漂移；
- 路径不存在或不是普通文件/目录返回 `40006`；
- 与上传共用工作区串行锁，避免删除和上传并发时配额计数相互覆盖。

### 3.7 错误码

| code    | 含义                                  |
| ------- | ------------------------------------- |
| `40001` | 工作区不存在或已过期                  |
| `40002` | 路径非法（绝对路径、盘符、`..`、NUL） |
| `40003` | 文件 / 单页超过大小上限               |
| `40004` | 文件数量或总大小超限                  |
| `40005` | 不是可预览的 UTF-8 文本（含二进制）   |
| `40006` | 文件不存在或不是普通文件              |

---

## 四、后端实现

模块：`apps/backend/src/files/`

```text
files.module.ts
files.controller.ts      # 路由与 multipart / StreamableFile
files.service.ts         # 工作区生命周期、路径校验、上传锁、文本分页、清理
files.constants.ts       # 上限、MIME、清理间隔
dto/                     # create / upload / path / read 查询校验
```

### 4.1 路径安全

所有入口只接受相对路径，`normalizeRelativePath` 拒绝：

- 绝对路径（`/...`）与 Windows 盘符（`C:...`）；
- 空路径、NUL、长度超过 1024；
- 任一段为 `.` / `..`。

随后 `resolve(root, relativePath)` 再校验结果仍在工作区根内。读取用 `lstat`，只允许普通
文件；目录树跳过符号链接。上传只写工作区内路径，目录由服务端创建。

### 4.2 上传与配额

- `FileInterceptor` 内存存储 + 20 MiB 限制，校验路径后由 service 落盘；
- 同一工作区用进程内串行锁（`withLock`）避免并发上传导致 `fileCount/totalBytes` 竞态；
- 覆盖同名文件时按差值更新总量，文件数不变；
- 超过任意配额抛 `40004`，不写盘。

### 4.3 文本分页读取

`readTextPage` 用 `createReadStream` + 流式 `TextDecoder`：

1. 逐块解码（`fatal: true`，跨块多字节字符安全）；
2. 按 `\n` 切行，跳过 `offset` 之前的行；
3. 收集本页最多 `limit` 行；
4. 窗口满后再遇到一行即判定 `eof: false` 并停止读取；
5. 流结束仍未越界则 `eof: true`。

单行无换行且超过 4 MiB 时提前失败，避免无限累积。

### 4.4 过期清理

`onModuleInit` 先清理一次，之后每 30 分钟扫描 `expiresAt < now` 的工作区（每次 50 个），
删除目录 + 记录。`requireWorkspace` 发现过期也会立即删除并返回 `40001`。

### 4.5 配置

`apps/backend/src/common/config/env.validation.ts` 新增：

```text
FILES_STORAGE_DIR=storage/files   # 可选，默认 storage/files
```

---

## 五、前端实现

路由：`apps/frontend/src/app/files/page.tsx`（`Header` + `FilesWorkspace`，与 `/chat` 同级）；
导航新增「文件」。未登录由 middleware + 全局守卫拦截。

组件按页面区域拆分：**上传阶段**（`upload/`）、**左侧文件树**（`sidebar/`）、**右侧预览**（`preview/`），
页级状态与 URL 同步留在 `index.tsx`，顶部工作区栏独立为 `workspace-bar.tsx`：

```text
apps/frontend/src/components/files/
├─ index.tsx            # 页 controller：状态机 + ?ws= 同步 + 删除入口
├─ workspace-bar.tsx    # 顶部：工作区信息、重试失败项、换文件夹
├─ upload/
│  ├─ upload-zone.tsx   # webkitdirectory 选择 + 拖拽目录递归 + 预校验
│  └─ upload-progress.tsx # 上传进度卡（文件数/字节/当前文件/取消）
├─ sidebar/
│  └─ file-tree.tsx     # 扁平列表 → 树，目录折叠、文件选择、单条删除
├─ preview/
│  ├─ preview-panel.tsx # 路径头、换行/重载、正文与分页加载
│  └─ code-view.tsx     # Shiki 高亮（复用对话 Markdown 的高亮单例）
├─ constants.ts         # 上限、扩展名分类、语言映射、字节格式化
├─ api.ts               # JSON 走 request；上传/字节用 fetch
├─ types.ts
└─ hooks/
   ├─ use-file-workspace.ts  # 创建/恢复/刷新/删除，?ws= 同步
   ├─ use-file-tree.ts       # 拉取目录树
   ├─ use-file-upload.ts     # 并发 3 上传、失败记录、取消、重试
   └─ use-file-preview.ts    # 文本分页 / Blob URL / 重载
```

### 5.1 页面状态机

```text
无工作区            → UploadZone（选择/拖拽）
创建工作区 + 上传中 → 进度卡（文件数、字节、当前文件、取消）
上传结束            → 左树 + 右预览；失败/取消时顶部提示与重试
?ws=<id> 恢复       → 读取元信息；过期/不存在则回上传引导并显示原因
```

工作区 id 写入 URL `?ws=`，刷新可恢复；「换一个文件夹」会删除当前工作区后回到上传引导。

### 5.2 上传

- `<input type="file" webkitdirectory multiple>`：取 `file.webkitRelativePath` 保留目录结构；
- 拖拽目录：`DataTransferItem.webkitGetAsEntry()` 递归 `readEntries`，取不到时退回扁平 `files`；
- 预校验文件数 / 单文件 / 总量，失败直接 toast，不创建空工作区；
- 逐文件 `POST /:id/upload`，并发 3；单文件失败记入 `failed`，不阻塞其它文件；
- 「重试失败的 N 个」只重传失败项（覆盖语义幂等）。

### 5.3 预览

| 类型             | 实现                                                   |
| ---------------- | ------------------------------------------------------ |
| 文本             | `read` 分页累加，滚动近底自动加载 + 「加载更多」按钮   |
| 代码             | 复用 `highlightCode`（Shiki），未就绪时先显示纯文本    |
| Markdown         | 复用对话的 `Markdown` 组件（GFM / KaTeX）              |
| 图片             | `bytes` → Blob URL → `<img>`（不放大超过原尺寸的图）   |
| PDF              | `bytes` → Blob URL → `<iframe>`，浏览器原生 PDF 查看器 |
| 不可预览的二进制 | 直接提示「该格式暂不支持预览」，不发起读取             |

分类规则：图片 / PDF / Markdown 后缀优先；已知二进制（音视频、压缩包、Office、可执行、字体）
显示不支持；其余按代码或纯文本兜底。

### 5.4 交互细节

- 目录树默认全部展开，目录优先、自然序；
- 每行悬浮/聚焦（移动端常显）显示删除按钮，二次确认后删除；目录删除会包含全部子项；
- 删除后刷新目录树与工作区元信息；若正在预览的文件被删除（或位于被删目录内），清空选中回到空态；
- 切换工作区清空选中，目录加载后自动选中第一个文件；
- 文本/代码支持换行开关与重载；图片/PDF 支持在新窗口打开；
- Blob URL 在文件切换/组件卸载时释放；
- 上传结束后刷新工作区元信息，保证头部文件数与总大小准确。

---

## 六、已知限制

- **预览只读**：仅支持删除文件/目录与整个工作区，无编辑、保存、搜索、重命名、批量下载；
- 单次上传对应一个工作区，没有历史列表；「换一个文件夹」会删除当前工作区；
- 工作区 24 小时过期，过期后页面提示 `40001`，需重新上传；
- 上传是逐文件请求，不支持断点续传；取消后已上传文件仍保留，可继续浏览；
- 预览 PDF 依赖浏览器内置查看器，没有页码控制、文本选择增强或页虚拟化；
- 图片只做适应宽度，没有缩放工具栏；
- 文本没有行号、语法级跳转；
- Markdown 中的相对图片/链接不解析（本版没有媒体路由，外链仍可用）；
- HTML、Office、Excel、CSV 表格不做专门渲染（HTML 按文本、Office 归入不可预览）；
- 目录树最多 2000 项，超出提示换小文件夹。

---

## 七、验证

```bash
pnpm --filter @lyh-next/backend typecheck
pnpm --filter @lyh-next/frontend typecheck
pnpm --filter @lyh-next/backend lint
pnpm --filter @lyh-next/frontend lint
```

数据库结构变更：

```bash
pnpm --filter @lyh-next/backend generate          # prisma generate
pnpm --filter @lyh-next/backend db:migrate        # 本地迁移（需要 Postgres）
```

> 迁移文件：`apps/backend/prisma/migrations/0002_file_workspace/migration.sql`；
> 部署时由 compose 的 `migrate` 服务执行 `prisma migrate deploy`。
