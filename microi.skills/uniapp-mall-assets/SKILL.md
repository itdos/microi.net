---
name: uniapp-mall-assets
description: Microi UniApp、H5、商城与 PC 页面中的上传图片、附件、FileServer、私有文件临时 URL 和富文本资源安全规范。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi UniApp / 商城资源路径规范

本 Skill 只描述平台通用资源规则。不得写入客户名称、真实 `OsClient`、客户应用路径、客户接口 Key 或特定商城结算规则。

## 先识别资源类型

Microi 上传字段存在四种必须长期兼容的存储形态，不能假设字段一定是字符串：

| 存储形态 | 示例 | 兼容要求 |
|---|---|---|
| 旧版绝对地址字符串 | `https://cdn.example.com/a.png` | 校验协议和允许域名后原样使用，禁止再次拼接 `FileServer` |
| 旧版相对路径字符串 | `/tenant/a.png` | 仅此类纯相对对象 Key 拼接当前租户 `FileServer` |
| 新版单图对象 | `{ FilePathName:'/tenant/a.png', Name:'a.png' }` | 提取路径字段；保留对象的名称、大小、Id 等元数据，不得把整个对象转成字符串 |
| 新版多图数组 | `[{ FilePathName:'/tenant/a.png' }, ...]` | 逐项解析并保持原顺序；单图展示取第一个有效路径，多图展示返回全部有效项 |

数据库或接口还可能返回上述对象/数组的 JSON 字符串，解析器也必须兼容。标准路径键按以下顺序识别：`Url`、`FileUrl`、`FileURL`、`PreviewUrl`、`PreviewURL`、`FullUrl`、`Path`、`FilePathName`、`FilePath`、`FullPath`、`Src`、`Href`，并兼容相应 camelCase 键。

页面不能把相对路径直接交给 `<image>` / `<img>`，也不能一律拼接 API Base。项目已使用 `microi.v8.js` 时，优先直接复用 `V8.extractUploadPath`、返回路径数组的 `V8.normalizeUploadValue`、保留 `{ item, path }` 元数据的 `V8.normalizeUploadEntries`、`V8.assetUrl` / `V8.resolveAssetUrl` 和 `V8.resolveFileUrl`，不得在业务页面另造一套不完整的解析规则。

| 类型 | 处理方式 |
|---|---|
| 已允许的 `https://` 绝对地址 | 校验协议和允许域名后使用 |
| 公有对象存储相对路径 | 拼接当前租户 `FileServer` |
| `/file/...` 平台本地文件路由 | 拼接当前 API Base |
| `/micro-app/v3/...` 应用稳定解析路由 | 拼接当前 API Base；这是动态指针路由，不是 HDFS 对象 Key，禁止拼接 `FileServer` |
| 私有对象 | 后端鉴权后签发短期 URL，前端只使用临时 URL |
| `blob:` | 仅用于本页创建且能及时 `revokeObjectURL` 的预览 |
| `data:` | 仅允许经过大小和 MIME 校验的图片预览；禁止用于富文本任意 HTML |

`FileServer` 是对象存储/CDN 地址，不等同于 API 服务。租户切换时必须使用当前 `OsClient` 的运行期配置，禁止在源码中写死域名或租户目录。

## 统一资源解析函数

未使用 `microi.v8.js` 的项目，应在共享请求/资源模块中实现等价的“提取上传路径 + 解析资源 URL”两层函数，所有页面复用同一逻辑：

```js
const uploadPathKeys = [
  'Url', 'FileUrl', 'FileURL', 'PreviewUrl', 'PreviewURL', 'FullUrl',
  'Path', 'FilePathName', 'FilePath', 'FullPath', 'Src', 'Href',
  'url', 'fileUrl', 'previewUrl', 'fullUrl', 'path', 'filePathName', 'filePath', 'fullPath', 'src', 'href'
];

export function extractUploadPath(raw, depth = 0) {
  if (depth > 4 || raw === null || raw === undefined) return '';
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const path = extractUploadPath(item, depth + 1);
      if (path) return path;
    }
    return '';
  }
  if (typeof raw === 'object') {
    for (const key of uploadPathKeys) {
      const path = extractUploadPath(raw[key], depth + 1);
      if (path) return path;
    }
    return '';
  }
  const value = String(raw).trim();
  if (!value) return '';
  if (/^[{[]/.test(value)) {
    try { return extractUploadPath(JSON.parse(value), depth + 1); } catch (_) {}
  }
  return value;
}

export function normalizeUploadValue(raw) {
  let value = raw;
  if (typeof value === 'string' && /^[{[]/.test(value.trim())) {
    try { value = JSON.parse(value); } catch (_) {}
  }
  const items = Array.isArray(value) ? value : [value];
  return items.map(item => ({ item, path: extractUploadPath(item) })).filter(entry => entry.path);
}

export function resolveAssetUrl(raw, {
  apiBase,
  fileServer,
  allowedHosts = []
}) {
  const value = extractUploadPath(raw);
  if (!value) return '';

  if (/^https:\/\//i.test(value)) {
    const host = new URL(value).hostname.toLowerCase();
    return allowedHosts.includes(host) ? value : '';
  }
  if (/^blob:/i.test(value)) return value;
  if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)) return value;
  if (value.startsWith('/file/')) return `${apiBase.replace(/\/$/, '')}${value}`;
  if (/^\/?micro-app\/v3(?:\/|$)/i.test(value)) {
    return `${apiBase.replace(/\/$/, '')}/${value.replace(/^\/+/, '')}`;
  }

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

## 大资源与小程序包体门禁

- Hero、Banner、资讯封面、视频、音频、字体和大型占位图等公开资源，先按真实显示尺寸压缩，再上传当前 `OsClient` 的公有 HDFS；数据库和配置只保存相对 `Path`，客户端运行时读取 `SysConfig.FileServer` 组成 CDN 地址。
- 发布前扫描真实小程序构建目录。单个非离线关键资源超过 `256 KB` 时默认不得进入主包；主包静态资源达到 `1.5 MB` 或距平台硬上限不足 `300 KB` 时必须中止上传并输出最大文件清单。
- 上传完成必须执行 CDN 匿名 GET 回读，验证 `200`、媒体类型、字节数，重要资源比对 SHA-256；同时回读业务字段确认已由 `/static/...` 改为 HDFS 相对路径。只有上传成功、数据库回读、CDN 回读和构建产物瘦身全部通过，才能关闭问题。
- 原始设计素材移到不会参与构建的资料目录；主包只保留轻量失败占位和离线关键图标。远程资源加载失败时显示该占位，禁止回退为同一张大图的本地副本。

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

- [ ] 公有对象、本地文件、`/micro-app/v3` 动态路由、私有对象、绝对 URL 的路径分支均有测试
- [ ] 绝对地址字符串、相对路径字符串、单图对象、多图数组及其 JSON 字符串均有测试
- [ ] 单图从数组取第一个有效路径，多图保持原顺序；解析 URL 时不丢失或改写上传对象元数据
- [ ] 切换两个 `OsClient` 后使用各自 `FileServer`，无跨租户路径或缓存复用
- [ ] 私有 URL 越权、过期、篡改签名和复制到其它账号均失败
- [ ] 网络面板中没有硬编码客户域名、真实租户或永久签名 URL
- [ ] 关键列表、详情、上传、预览页面有截图和真实资源加载断言
- [ ] `blob:` URL 及时释放，大文件预览不会持续占用内存
- [ ] 富文本协议/标签白名单可阻止 XSS

参见 `microi.skills/v8-file-upload/SKILL.md`、`microi.skills/microi-uniapp-frontend/SKILL.md` 和 `microi.skills/playwright-e2e/SKILL.md`。
