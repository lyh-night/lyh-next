# 目录结构

> 详细说明项目的目录组织和各目录职责。

---

## 目录总览

```
src/
  app/
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

### src/generated

Prisma 生成的代码（自动生成，勿手动修改）。

---

### prisma

数据库 Schema 定义。

---

### public

静态资源（图片、图标等）。
