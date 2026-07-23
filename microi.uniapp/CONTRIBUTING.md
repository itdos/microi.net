# Microi 原生小程序协作指南

本项目同时维护 Microi 标准产品与默认集福鲤交付版。开始修改前必须阅读
`AGENTS.md`、`docs/architecture.md` 和 `README.md`。

## 开发入口

普通 CRUD 优先使用 `sys_menu + diy_table + diy_field + ViewSchema`，不要创建
硬编码页面。需要客户专属组合、扫码、定位、相机或复杂原生流程时，在
`src/tenants/<tenant>/` 增加扩展，并在对应 `profiles/<tenant>/pages.json`
注册路由。

```bash
npm run tenant:create -- demo 示例项目 demo https://api.example.com
npm run profile:run -- demo dev mp-weixin
npm run profile:run -- demo build mp-weixin
```

`src/generated/`、`src/pages.json` 和 `src/manifest.json` 是 Profile 生成物。
仓库默认生成物必须指向 `xjy`。发生合并冲突时，以 `profiles/` 与
`src/tenants/` 为事实源，然后执行：

```bash
npm run profile:sync -- xjy
```

## 合并要求

- 平台通用代码不能出现租户表名、字段名、素材、文案或路由。
- 不执行任意前端 V8；移动动作使用 ActionSchema，复杂逻辑进入 ApiEngine。
- 数据请求携带真实 `_SysMenuId`，后端继续执行最终权限校验。
- 新协议先兼容旧配置；后台新增字段必须自动进入小程序，不允许静默丢失。
- 不提交 `dist/`、截图、密码、Token 或非默认 Profile 生成物。
- 小提交、窄范围格式化；不要覆盖其他同事未完成的改动。

平台层改动至少执行：

```bash
npm run check:ui
npm run build:mp-weixin:standard
npm run check:mp-quality:standard
npm run build:mp-weixin
npm run check:mp-quality
```

集福鲤页面、交互或视觉改动还应执行 `npm run build:h5` 和
`npm run visual:xjy`。相机、定位、支付及会改变业务状态的流程仍需真机验收。
