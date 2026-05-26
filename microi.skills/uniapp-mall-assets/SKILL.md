---
name: uniapp-mall-assets
description: 数字经济商城 uni-app H5（mci.lsg.uniapp）资源/图片路径与 FileServer 前缀强制规范。Use when rendering MainImg, Avatar, BannerImg, CardImage, MainImage, Cover or any user-uploaded asset path in uni-app `<image :src>` or PC mall pages.
---

# 商城前端：图片 / 资源路径规范

数据库里的图片/附件字段（`MainImg`, `Avatar`, `BannerImg`, `CardImage`, `Image`, `Cover` 等）几乎都保存的是**相对路径**，例如 `/lsg/mall/product/20260521/p1-01.jpg` 或 `mall/.../xxx.jpg`。

直接把这种路径写进 `<image :src="row.MainImg">` 等价于让浏览器访问 `https://host/lsg/mall/...`，**404**、图片不显示。

## 关键事实：FileServer 不是 API 服务

后端 `V8.SysConfig.FileServer` 对应**对象存储/CDN 公网域名**（如 `https://static.itdos.com`），与 API 网关 `https://api.xxx` 是**两个不同的域名**。

❌ 把 `/lsg/mall/...` 拼到 `${API_BASE}/file/microi/` 下是**错的**——本地接口服务下并没有这个文件，会 404。
✅ 必须拼到 `${FILE_SERVER}/`（OSS/CDN）。
✅ 私有文件需要签名 URL，由后端 `V8.Method.GetPrivateFileUrl({FilePathName})` 返回带 `Signature/Expires` 的临时 URL。

## 必须经过 sanitizeAssetUrl

`mci.lsg.uniapp/src/utils/api.js` 已经导出 `sanitizeAssetUrl(url)`，规则：

- `http(s)://`、`data:`、`blob:` → 原样返回。
- `/file/...` → `${API_BASE}/file/...`（API 服务的本地文件接口、二维码生成等）。
- `/{anything}/...` 或 `xxx/yyy.ext` 这类相对路径 → `${FILE_SERVER}/...`（OSS/CDN）。
- 第三方占位图（picsum/placehold/qrserver 等）→ 屏蔽返回空串。

`FILE_SERVER` 来源：`mall-api.config.js` 顶层 `fileServer` 字段（默认 `https://static.itdos.com`），可被 `VITE_MALL_FILE_SERVER` 覆盖。**新部署到其它租户/CDN 时必须更新此处**。

### ✅ 正确

```vue
<script setup>
import { sanitizeAssetUrl } from '@/utils/api.js';
function resolveImg(u) { return sanitizeAssetUrl(u); }
</script>
<template>
  <image v-if="p.MainImg" :src="resolveImg(p.MainImg)" mode="aspectFill" />
</template>
```

或在数据 fetch 后一次性归一化（首页 [index.vue](ai-helper/数字经济商城/mci.lsg.uniapp/src/pages/index/index.vue) 用的就是这种）：

```js
products.value = r.Data.map(p => ({ ...p, MainImg: sanitizeAssetUrl(p.MainImg) }));
```

### ❌ 错误（曾在 category/checkout/order-detail/order-list/product-detail/redeem-pickup/register/transfer 同时犯过）

```vue
<image :src="p.MainImg" />                    <!-- 404 -->
<image :src="uni.$mciFileBase + p.CardImage" /> <!-- $mciFileBase 不存在 -->
```

## 检查清单（添加新页面时必过）

1. 模板里每一处 `<image :src="...">` 引用的字段是否经过 `sanitizeAssetUrl` 处理？
2. `<img>`、`background-image: url(...)`、富文本 HTML 中的 src 同样要处理。
3. Avatar / Logo / 卡面图等用户上传字段统一走相同函数。
4. 不要直接拼 `API_BASE + path`，让 `sanitizeAssetUrl` 处理；它能识别已带 `http://` 的绝对地址。
5. Vue/uni-app SFC 写法用辅助函数 `resolveImg`，便于未来全局替换。

## 与 sys_menu 表单 V8 事件配合

在表单 V8 `InFormV8` 等事件里给字段补图片预览时，也要用同样规则。`<el-image>` / `<img>` / `mci-image` 都受影响。

## 全自动化测试强制截图（防回归）

E2E 测试必须在以下页面做全屏截图并复核：

- 首页、商品分类、商品详情、抢购详情、约单详情、订单详情、个人中心、库存转让区。
- 每个截图都要用 `view_image` 工具人眼检查"图片是否真实显示"。
- 若关键图片块出现纯背景渐变/首字母占位/空白，立即回到本 Skill 检查 `sanitizeAssetUrl` 是否覆盖。

参见 [microi.skills/playwright-e2e/SKILL.md](microi.skills/playwright-e2e/SKILL.md)。
