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

- 单个组件建议控制在 200 行以内：超出时先看职责是否混杂、能否独立复用，职责单一可适当放宽（不以行数硬卡）
- 复杂逻辑拆 Hook
- 重复 UI 提取公共组件

拆分落位规则（目录组织、组件粒度、交互/业务分离、纯函数与公共组件的去处）见
[coding-conventions.md §七](coding-conventions.md)，此处不重复展开。

---

## 四、状态管理

优先级：

1. Server State
2. URL State
3. Local State

尽量避免全局状态。

未经允许，不引入 Redux、MobX 等状态库。
