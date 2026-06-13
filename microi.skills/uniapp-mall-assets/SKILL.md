---
name: uniapp-mall-assets
description: 数字经济商城 uni-app H5（mci.lsg.uniapp）资源/图片路径与 FileServer 前缀强制规范。用于在 uni-app `<image :src>` 或 PC 商城页面渲染 MainImg、Avatar、BannerImg、CardImage、MainImage、Cover 或任何用户上传资源路径。
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

## 商品详情富文本排版

商品详情富文本里，图片满宽通常是合理的，但文字不能贴边。生成或清洗 `DetailHtml` 时必须把图片和文字分块：

- 图片块：`img` 用 `display:block;width:100%;max-width:100%;height:auto;`，外层 `p` 的 `margin` 设为 `0`。
- 文字块：标题、专区、分类、售价、规格说明、温馨提示等统一包进文本容器，使用 `padding:16px 18px 18px;box-sizing:border-box;line-height:1.7;`。
- 不得在详情文案或图片文件名里暴露供价、成本价、倍率、导入批次、生成规则等后台信息。
- 截图验收时同时看图片是否真实加载、文字是否贴边、长标题是否换行后仍在容器内。

## 与 sys_menu 表单 V8 事件配合

在表单 V8 `InFormV8` 等事件里给字段补图片预览时，也要用同样规则。`<el-image>` / `<img>` / `mci-image` 都受影响。

## 全自动化测试强制截图（防回归）

E2E 测试必须在以下页面做全屏截图并复核：

- 首页、商品分类、商品详情、抢购详情、约单详情、订单详情、个人中心、库存转让区。
- 每个截图都要用 `view_image` 工具人眼检查"图片是否真实显示"。
- 若关键图片块出现纯背景渐变/首字母占位/空白，立即回到本 Skill 检查 `sanitizeAssetUrl` 是否覆盖。

参见 [microi.skills/playwright-e2e/SKILL.md](microi.skills/playwright-e2e/SKILL.md)。

## 商品购买入口规范

商城项目里“加入购物车”和“立即购买”必须是两条不同入口：

- “加入购物车”只调用购物车新增接口，并停留当前页或提示成功。
- “立即购买”不得自动加入购物车，必须携带当前 `ProductId/SkuId/Quantity` 进入结算页，例如 `/pages/order/checkout?mode=buyNow&productId=...&qty=1`。
- 结算页必须识别 `mode=buyNow`，只加载当前商品；从购物车进入时才读取购物车列表/勾选项。
- 后端结算接口需要同时支持购物车 `CartIds` 和直购 `ProductId/Quantity`，直购成功后不得删除或影响购物车其它商品。
- 专区支付必须按商品属性隔离：提货卡专区只能扣提货卡余额并生成提货扣除记录；兑换金专区只能扣兑换金并生成兑换金流水。不同支付专区商品不得混合结算。
- 自动化测试至少覆盖：未登录点击加入购物车跳登录、登录后加入购物车可见、立即购买不会调用 `mall_cart_add`、立即购买结算页只出现当前商品、结算接口按专区扣减对应资产。
