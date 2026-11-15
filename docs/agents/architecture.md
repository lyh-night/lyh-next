# 架构原则

> 项目的整体架构、组件设计和状态管理规范。

---

## 一、架构原则

遵循分层架构：

```
UI → Feature → Service → Database / API
```

禁止：

```
UI → fetch()
```

---

## 二、Server Component 原则

默认使用 Server Component。

只有以下情况允许 `"use client"`：

- 表单
- 动画
- 浏览器 API
- 拖拽
- 图表

尽量减少 Client Component。

---

## 三、组件规范

组件要求：

- 单一职责
- 可组合
- 可复用

建议：

- 单个组件控制在 200 行以内
- 复杂逻辑拆 Hook
- 重复 UI 提取公共组件

---

## 四、状态管理

优先级：

1. Server State
2. URL State
3. Local State

尽量避免全局状态。

未经允许，不引入 Redux、MobX 等状态库。
