# Microi 吾码通用 App Profile

此 Profile 将吾码移动端 App 作为官方 `microi.uniapp` 的一个可选产品形态接入。默认 `xjy` 构建与既有 `standard` Profile 不变；不要把此 Profile 设为默认，也不要把客户租户写入平台源码。

## 构建与检查

```bash
npm install --no-package-lock
npm run check:architecture
npm run check:profiles
npm run check:microi
npm run build:h5:microi
npm run build:mp-weixin:microi
npm run build:app:microi
npm run build:mp-weixin:standard
npm run build:mp-weixin
```

`profiles/microi/profile.cjs` 默认连接公开演示平台；用户可以在 App 内按 HTTPS API 与 OsClient 连接自己的租户。租户品牌与主题来自相应平台配置，移动端可以单独选择颜色。App 身份、商店素材与隐私文案仅属于 `microi` Profile，不能用于 `xjy` 或 `standard` 包。

## 源码差异层

不与官方同名的通用平台模块、页面和组件直接进入 `src/`，供未来其他 Profile 复用。与官方现有页面或模块同名、但 App 交互不同的文件放在 `overrides/src/`。`run-profile.cjs` 只在 `microi` 构建子进程期间临时激活这些差异，结束后恢复原文件；`check:profiles` 会验证激活及恢复。

这是合并初期的隔离边界，不是第二套工程。后续将可共同复用的 UI 与行为从差异层逐步提炼为共享组件，但每次提炼都必须通过 xjy、standard、microi 三 Profile 回归。不要在两个 Profile 构建之间并行运行生成命令；当前生成器共用 `src/generated` 与临时源码路径。

本地版本曾在原生表单中执行字段配置的任意前端 V8，并硬编码某个客户的拜访字段与客户表。这些路径不符合官方平台层安全和多租户约束，合并时已移除；通用表单继续使用官方元数据协议、服务端事件及明确的租户表单扩展。若客户确需字段联动，应先设计可审核的服务端或白名单动作契约，而不是恢复前端动态代码执行。

## 验收边界

编译与静态测试不等于真机、租户权限或 App Store 验收。正式发行前仍需用普通角色对登录、菜单权限、动态列表/详情/表单、附件、消息、主题、退出登录做回读与重启检查，并完成 iOS/Android 真机及商店隐私审核。此 PR 不上传签名证书、描述文件或客户凭据。
