# docs 目录结构

文档按用途分目录归档：`docs/agents/` 的索引入口在根 [AGENTS.md](../AGENTS.md) 的「文档索引」，`docs/features/` 与 `docs/research/` 由本文件索引。

## docs/agents/ — 开发规范与指南

与 AGENTS.md 配套、跨功能通用的规范，AI 与开发者修改任何代码前按需阅读：

| 文档                                                    | 内容                                           |
| ------------------------------------------------------- | ---------------------------------------------- |
| [tech-stack.md](agents/tech-stack.md)                   | 框架、UI、数据、认证、状态管理与工具库         |
| [directory-structure.md](agents/directory-structure.md) | 项目目录组织与各目录职责                       |
| [architecture.md](agents/architecture.md)               | 架构设计、Server Component、组件规范、状态管理 |
| [coding-conventions.md](agents/coding-conventions.md)   | TypeScript、样式、命名、接口、错误处理、性能   |
| [ai-guidelines.md](agents/ai-guidelines.md)             | AI 修改代码的规范、禁止事项、提交检查清单      |
| [commands.md](agents/commands.md)                       | 开发、构建、数据库和 Docker 部署命令           |

## docs/features/ — 功能与契约文档

每个功能 / 模块一份接口与设计文档；**后续开发的新功能文档统一放这里**（命名建议与模块目录同名，如 `chat.md` 对应 `apps/backend/src/chat` + `/chat` 页面）：

| 文档                                      | 内容                                                        |
| ----------------------------------------- | ----------------------------------------------------------- |
| [monorepo.md](features/monorepo.md)       | 包边界、迁移映射、配置改造与验收标准                        |
| [chat.md](features/chat.md)               | AI 对话：chat 模块、模型配置、多轮记忆、SSE 协议、重试链路  |
| [auth.md](features/auth.md)               | 登录认证：Nest 托管会话、cookie 规格、全局守卫              |
| [err-handing.md](features/err-handing.md) | 响应与错误处理：扁平信封、业务码表、过滤器与日志契约        |
| [files.md](features/files.md)             | 上传文件夹预览：工作区模型、只读接口、文本分页、树/预览前端 |
| [realtime.md](features/realtime.md)       | 实时通信：实时通道设计与协议约定                            |

## docs/research/ — 调研报告

| 文档                                                              | 内容                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [digital-human-platforms.md](research/digital-human-platforms.md) | 数字人平台调研：技术栈六层拆解、业务流程（克隆/离线合成/实时交互/直播）、开源生态与本项目集成建议                                             |
| [dsh-file-preview.md](research/dsh-file-preview.md)               | DSH 文件预览调研：资源地址与元数据、可分页读取、渲染器注册表与三种加载模式、HTML/PDF/表格/Office 实现、安全与性能边界、对 lyh-next 的映射建议 |

## 约定

- 根目录 `image.png` 为 README 截图，不是文档。
- 文档内互相引用使用仓库根相对路径（`docs/agents/xxx.md`、`docs/features/xxx.md`）。
- 新功能合并时只更新本 README 表格（功能文档不进 AGENTS.md，避免其随功能膨胀）。
