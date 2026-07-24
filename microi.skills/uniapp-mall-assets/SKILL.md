---
name: uniapp-mall-assets
description: Microi UniApp、H5、商城与 PC 页面中的上传图片、附件、FileServer、私有文件临时 URL 和富文本资源安全规范。
---

# Microi UniApp / 商城资源路径规范

本 Skill 只描述平台通用资源规则。不得写入客户名称、真实 `OsClient`、客户应用路径、客户接口 Key 或特定商城结算规则。

## 先识别资源类型

Microi 上传字段通常保存对象存储 Key 或相对路径，例如 `/demo/product/20260101/p1.jpg`。页面不能把相对路径直接交给 `<image>` / `<img>`，也不能一律拼接 API Base。

| 类型 | 处理方式 |
|---|---|
| 已允许的 `https://` 绝对地址 | 校验协议和允许域名后使用 |
| 公有对象存储相对路径 | 拼接当前租户 `FileServer` |
| `/file/...` 平台本地文件路由 | 拼接当前 API Base |
| 私有对象 | 后端鉴权后签发短期 URL，前端只使用临时 URL |
| `blob:` | 仅用于本页创建且能及时 `revokeObjectURL` 的预览 |
| `data:` | 仅允许经过大小和 MIME 校验的图片预览；禁止用于富文本任意 HTML |

`FileServer` 是对象存储/CDN 地址，不等同于 API 服务。租户切换时必须使用当前 `OsClient` 的运行期配置，禁止在源码中写死域名或租户目录。

## 统一资源解析函数

项目应在共享请求/资源模块中实现一个 `resolveAssetUrl`，所有页面复用同一逻辑：

```js
export function resolveAssetUrl(raw, {
  apiBase,
  fileServer,
  allowedHosts = []
}) {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^https:\/\//i.test(value)) {
    const host = new URL(value).hostname.toLowerCase();
    return allowedHosts.includes(host) ? value : '';
  }
  if (/^blob:/i.test(value)) return value;
  if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)) return value;
  if (value.startsWith('/file/')) return `${apiBase.replace(/\/$/, '')}${value}`;

  const relative = value.replace(/^\/+/, '');
  return `${fileServer.replace(/\/$/, '')}/${relative}`;
}
```

示例：

```vue
<script setup>
import { resolveAssetUrl } from '@/utils/assets.js';

function imageUrl(path) {
  return resolveAssetUrl(path, {
    apiBase: runtimeConfig.apiBase,
    fileServer: runtimeConfig.fileServer,
    allowedHosts: runtimeConfig.assetAllowedHosts
  });
}
</script>

<template>
  <image v-if="row.MainImg" :src="imageUrl(row.MainImg)" mode="aspectFill" />
</template>
```

不要让业务页面各自拼 `${API_BASE}/${path}` 或 `${FILE_SERVER}/${path}`；这会造成租户切换、私有桶、绝对 URL 和本地文件路由行为不一致。

## 私有文件

- 私有对象 Key 不能直接转换成可长期访问的公网地址。
- 前端通过受保护接口请求临时 URL；后端使用 `V8.Method.GetPrivateFileUrl({ FilePathName })` 或等价受控能力。
- 后端必须验证当前用户、`OsClient`、记录范围和字段绑定关系，不能只凭文件路径签名。
- 临时 URL 设置较短有效期，不写入数据库、不进入长期缓存、不记录完整签名参数。
- 下载响应使用安全的 `Content-Disposition`、MIME 白名单与文件名清洗。

## 富文本与 CSS 资源

- 富文本 HTML 先做标签、属性和协议白名单清洗，再改写允许的 `src` / `href`。
- 禁止 `javascript:`、任意 `data:text/html`、事件属性和未知 iframe。
- `background-image`、Markdown 图片、视频封面和头像与普通 `<image>` 使用同一资源解析策略。
- 商品详情等富文本可让图片自适应宽度，但文本容器仍需留出安全边距；不得在文件名或页面文案暴露成本、导入批次、内部目录或生成规则。

## 上传与预览边界

- 前端扩展名、大小提示只是体验校验；服务端仍须验证单文件大小、请求总量、租户配额、真实 MIME、魔数和文件名。
- 对象 Key 必须由服务端生成并包含租户隔离前缀，不能信任客户端提交的完整路径。
- SVG、HTML、脚本、压缩包和办公文档按风险策略处理；可执行内容不在同源页面直接渲染。
- 预览失败时显示受控占位，不回退到未经校验的原始 URL。

## 验收清单

- [ ] 公有对象、本地文件、私有对象、绝对 URL 的路径分支均有测试
- [ ] 切换两个 `OsClient` 后使用各自 `FileServer`，无跨租户路径或缓存复用
- [ ] 私有 URL 越权、过期、篡改签名和复制到其它账号均失败
- [ ] 网络面板中没有硬编码客户域名、真实租户或永久签名 URL
- [ ] 关键列表、详情、上传、预览页面有截图和真实资源加载断言
- [ ] `blob:` URL 及时释放，大文件预览不会持续占用内存
- [ ] 富文本协议/标签白名单可阻止 XSS

参见 `microi.skills/v8-file-upload/SKILL.md`、`microi.skills/microi-uniapp-frontend/SKILL.md` 和 `microi.skills/playwright-e2e/SKILL.md`。
