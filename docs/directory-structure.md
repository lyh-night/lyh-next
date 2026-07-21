# 目录结构

> 详细说明项目的目录组织和各目录职责。

---

## 目录总览

```
src/
  app/
    api/
    auth/
    components/
    home/
    workflow/
  components/
  provider/
  server/
  styles/
  utils/
  generated/
  middleware.ts
prisma/
public/
docs/
Dockerfile
docker-compose.yml
```

---

## 各目录职责

### src/app

页面入口，仅负责：

- 页面布局
- 页面组合
- 数据获取

禁止放置复杂业务逻辑。

---

### src/app/components

App Router 业务页面内使用的组件，例如 workflow、header、ThemeSwitch。

要求：

- 仅服务于 app 内页面组合
- 业务范围应清晰
- 可复用到全局时再迁移到 `src/components`

---

### src/app/api

Route Handler 入口。

要求：

- 保持请求处理清晰
- 复杂业务逻辑下沉到 server / service 层
- 不在 route 文件中堆叠大量业务代码

---

### src/components

公共组件。

要求：

- 可复用
- 无业务耦合
- 不直接请求接口

---

### src/provider

Provider 组件，例如：

- NextAuthProvider（NextAuth 上下文）

---

### src/server

服务器端逻辑：

- auth.ts（认证配置）
- prisma.ts（数据库客户端）

---

### src/utils

公共工具函数。

---

### src/styles

全局样式文件。

要求：

- 统一维护全局 CSS、变量和 shadcn 相关样式
- 组件级样式优先使用 Tailwind class

---

### src/generated

Prisma 生成的代码（自动生成，勿手动修改）。

---

### prisma

数据库 Schema 定义。

---

### public

静态资源（图片、图标等）。

---

### Dockerfile / docker-compose.yml

Docker 部署配置。

要求：

- 应用镜像使用 Next.js standalone output
- Compose 中应用容器连接数据库时使用 `APP_DATABASE_URL` 覆盖默认连接
