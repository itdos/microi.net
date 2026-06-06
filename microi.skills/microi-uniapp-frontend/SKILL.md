---
name: microi-uniapp-frontend
description: Microi 吾码 UniApp/H5 前端通用规范。Use when building or fixing any Microi uni-app/mobile H5 project that renders uploaded assets, avatars, mobile H5 pages, tabBar, fixed bottom bars, or explicit business asset selection.
---

# Microi UniApp 前端通用规范

本 Skill 适用于任何 Microi 吾码 UniApp/H5 项目，包括商城、OA、ERP、MES、CRM、互联网项目、预约项目等。不要把规则写成某一个业务应用专属规范。

## 资源 URL 必须集中解析

数据库中的图片、附件、头像、Logo、卡面图、单据图片等字段常见保存形式：

- 绝对地址：`https://...`
- API 本地文件路由：`/file/...`
- 对象存储相对路径：`/tenant/module/file.jpg` 或 `tenant/module/file.jpg`
- 上传组件 JSON：`[{"Path":"..."}]`、`{"Path":"..."}`、`{"FilePathName":"..."}`，也可能已经是对象/数组而不是字符串
- 历史脏数据或第三方占位图

页面模板不能直接写 `<image :src="row.Avatar">`、`<image :src="row.MainImg">`。必须在项目的 API/资源工具模块里提供统一解析函数，例如 `resolveAssetUrl`、`sanitizeAssetUrl`、`resolveFileUrl`、`resolveAvatarUrl`，并让页面只绑定已经归一化后的最终 URL。

资源解析函数必须先按 `microi.skills/v8-file-upload/SKILL.md` 的 `normalizeUploadValue` 思路处理 `ImgUpload` / `FileUpload` 字段：空值、`正在上传中...`、旧字符串路径、JSON 字符串对象、JSON 字符串数组、运行时对象、运行时数组都要兼容；取出 `Path` 后再进入 FileServer/API/私有签名 URL 逻辑。

推荐规则：

- `http(s)://`、`data:`、`blob:` 原样返回。
- `/file/...` 走 API 服务。
- `/tenant/...`、`tenant/...` 等对象存储路径走 `V8.SysConfig.FileServer` 对应的文件服务器/CDN。
- 私有文件使用后端签名 URL，例如 `V8.Method.GetPrivateFileUrl({ FilePathName })`，失败时再回退到公开文件服务器路径。
- 第三方占位图、已失效临时地址、空字符串统一清理为空，交给 UI 占位态。

## 头像必须异步统一解析

头像字段比普通图片更容易混合出现上传 JSON、私有路径、相对路径、历史字段名和脏数据。列表页、详情页、业务记录、审批记录、团队/会员卡片、聊天/消息等头像场景都必须走同一个头像解析入口。

正确模式：

```js
const rawAvatar = row.OwnerAvatar || row.UserAvatar || row.Avatar || member.Avatar || '';
row.OwnerAvatarUrl = await resolveAvatarUrl(rawAvatar);
```

模板只绑定最终字段：

```vue
<image v-if="row.OwnerAvatarUrl" :src="row.OwnerAvatarUrl" mode="aspectFill" />
```

禁止在模板中临时拼接文件服务器，禁止每个页面各写一套头像解析，禁止只在能查到关联用户时才解析接口已经返回的头像字段。

## 移动端富文本图文排版

商品详情、公告详情、活动说明、文章正文、协议说明等富文本在移动端渲染时，图片和文字不能使用同一套留白规则。

- 主图、详情长图、海报图可以 `width:100%` / `display:block` 满宽展示，不额外加左右 padding，避免图片显得缩小或边缘参差。
- 文字内容必须有独立容器，设置 `padding: 16px 18px`（或项目设计体系中的等价间距）、`box-sizing:border-box`、稳定 `line-height`，不能让标题、段落贴着卡片或屏幕边缘。
- 富文本生成器输出 HTML 时，推荐结构是“图片块 + 文本块”：图片块只包图片，文本块包标题、段落、规格说明、温馨提示。
- 段落使用 `margin:0 0 6px` 或相近节奏，最后一段可以去掉底部 margin；不要靠 `<br>` 堆间距。
- 移动端截图验收必须看文字是否贴边、是否横向溢出、是否被底部固定按钮遮挡。

参考结构：

```html
<section class="mci-rich-detail" style="background:#fff;overflow:hidden;">
  <p style="margin:0;text-align:center;">
    <img src="..." style="display:block;width:100%;max-width:100%;height:auto;" />
  </p>
  <div style="padding:16px 18px 18px;box-sizing:border-box;line-height:1.7;color:#1f2937;font-size:15px;">
    <h2 style="margin:0 0 10px;font-size:22px;line-height:1.28;">商品标题</h2>
    <p style="margin:0 0 6px;">所属专区：精选专区</p>
    <p style="margin:0;">商品图片与规格信息以实际维护为准。</p>
  </div>
</section>
```

## 移动端分类/双栏列表独立滚动

商品分类、知识库分类、通讯录分组、资产分类等“左侧分类 + 右侧列表”的移动端页面，根节点必须固定在一个视口内，不能让整页和内部列表同时滚动。

- 根页面使用 `height:100vh; overflow:hidden; display:flex; flex-direction:column;`。
- 分类主体使用 `flex:1; min-height:0; display:flex;`，并给底部 tabBar 预留 `padding-bottom: calc(tabBarHeight + env(safe-area-inset-bottom));`。
- 左侧分类和右侧列表分别用 `scroll-view scroll-y`，高度来自父级 `height:100%` / `flex:1; min-height:0`，不要用整页滚动承载右侧商品列表。
- 右侧分页必须绑定 `@scrolltolower`，设置合理 `lower-threshold`，并维护 `pageIndex/pageSize/loading/finished`，第一页重置列表，后续页追加列表。
- 切换左侧分类或顶部专区时，必须重置分页状态并重新加载第一页；不能沿用旧分类的 `finished` 或 `pageIndex`。
- 验收截图要重点看底部：内容不能被 tabBar 压住，页面底部不能出现整页滚动留下的大块空隙。

参考结构：

```vue
<view class="page-category">
  <view class="area-tabs">...</view>
  <view class="cat-body">
    <scroll-view class="cat-side" scroll-y>...</scroll-view>
    <scroll-view class="cat-content" scroll-y lower-threshold="120" @scrolltolower="loadMore">...</scroll-view>
  </view>
</view>
```

```scss
.page-category { height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.cat-body { flex: 1; min-height: 0; display: flex; padding-bottom: calc(104rpx + env(safe-area-inset-bottom)); }
.cat-side { width: 176rpx; height: 100%; }
.cat-content { flex: 1; min-width: 0; height: 100%; }
```

## 移动端资产/奖励流水展示

收益明细、积分明细、奖励明细、充值记录、订单流水等页面要面向用户展示“发生了什么”和“是否到账”，不要直接暴露后台调试字段。

- 每条记录必须显示完整时间（至少 `yyyy-MM-dd HH:mm:ss` 或同等精度），不能只显示日期加分钟片段。
- 有入账状态的记录必须用清晰标签展示，例如“待入账 / 已入账”；待入账金额颜色要与已入账区分，但仍保持可读。
- 推荐显示：类型、金额、完整时间、状态、贡献会员/交易对象、业务资产短码（如卡号/券码）和必要的标题。
- 不要在移动端直接显示内部 `RelOrderId`、服务费订单号、数据库 Id、调试来源操作、规则比例说明等后台字段，除非页面是面向运维的后台工具。
- 后端接口应先把 `TypeLabel`、`SettleStatusLabel`、`DisplayTime`、`ContributorName`、`CardNo` 等字段整理好，前端只做轻展示，避免多个页面各自拼接导致重复或口径不一致。

## H5 在 PC 浏览器必须自动模拟移动端

移动端 UniApp H5 被 PC 浏览器访问时，不能按桌面宽屏铺满。必须在全局样式里用媒体查询生成手机预览壳。

基础要求：

- `@media screen and (min-width: 768px)` 下把 `uni-app` 居中并限制到常见手机宽度，例如 `430px`。
- `html, body` 使用克制的桌面背景，`uni-app` 内保持移动端页面本身背景。
- 如果项目或主题给 `body.theme-light`、`body.theme-dark` 写了背景色，PC 媒体查询必须显式覆盖，避免手机壳外侧仍显示暗色或项目内装饰背景。
- 同步约束 `uni-page`、`uni-page-wrapper`、`uni-page-body` 的宽度。
- `uni-page-body` 给底部菜单和安全区预留 padding，避免内容或底部操作栏压住 tabBar。
- 所有 `position: fixed` 底部操作栏按同一手机壳宽度居中。
- 原生 `uni-tabbar` 和 `.uni-tabbar` 必须显式设置 `position: fixed`、`bottom: 0`、同宽居中和足够的 `z-index`，否则主体像手机壳但底部菜单可能丢失或铺满 PC 宽屏。
- 页面内 `position: fixed` 的装饰背景（如 aurora、粒子、全屏渐变）在 PC 壳模式下必须收回到 `uni-app/uni-page-body` 内，不能覆盖整块桌面背景。

参考样式：

```scss
@media screen and (min-width: 768px) {
  html,
  body {
    min-height: 100%;
    background:
      linear-gradient(135deg, rgba(255,255,255,.78), rgba(244,246,250,.92) 44%, rgba(236,239,245,.98)),
      radial-gradient(circle at 18% 16%, rgba(181,18,32,.07), transparent 32%),
      radial-gradient(circle at 84% 10%, rgba(216,162,58,.08), transparent 28%),
      #F3F5F9;
  }

  body { margin: 0; }

  uni-app {
    position: relative;
    display: block;
    width: min(430px, 100vw);
    min-height: 100vh;
    margin: 0 auto;
    overflow-x: hidden;
    background: var(--app-bg-base, #F7F8FB);
    box-shadow: 0 18px 54px rgba(28, 36, 52, .16);
  }

  uni-page,
  uni-page-wrapper,
  uni-page-body {
    width: 100% !important;
    max-width: 430px;
    margin: 0 auto;
  }

  uni-page-body {
    padding-bottom: calc(64px + env(safe-area-inset-bottom));
  }

  .bottom-bar {
    left: 50% !important;
    right: auto !important;
    width: calc(min(430px, 100vw) - 24px);
    transform: translateX(-50%);
  }

  uni-tabbar,
  uni-tabbar .uni-tabbar {
    position: fixed !important;
    left: 50% !important;
    right: auto !important;
    bottom: 0 !important;
    width: min(430px, 100vw) !important;
    transform: translateX(-50%);
    z-index: 99 !important;
  }
}
```

## 关键业务资产不得默认选中

凡是会扣减、消耗、转移、提交审批或触发财务后果的业务资产，都不能默认选中第一条。例如资产卡、余额账户、积分账户、优惠券、库存批次、付款账户、审批对象、设备工单等。

必须满足：

- 页面清楚提示需要手动选择。
- 用户主动点选后，提交按钮才可用。
- 已选资产刷新后失效时清空选择，不能自动换成第一条。
- 规则同时写在 UI 状态和提交前校验中。

## 数字、主题、上传与消息

- 资产金额、积分、余额、库存值、累计充值、收益等数字要按空间自适应格式化。金额很大时显示为 `1.23万`、`123万`、`1.2亿` 等，不能撑破卡片。
- 主题切换必须全局生效：`html/body/page/uni-page-body` 与每个页面根节点都要能继承主题变量，不能只在“我的”一个页面生效。
- 如果项目有 H5 自动翻译/MutationObserver 兜底，中文模式下不得把文本节点或属性恢复为旧的 `originalText`；中文模式只刷新原文缓存并退出，英文模式才写入翻译文本。否则异步接口把状态从“未认证”改为“认证已通过”后，自动翻译可能把 DOM 又改回旧状态。
- iOS Safari 上传图片后必须验证表单其它字段不丢失；上传组件只更新文件字段，不得重置整张表单对象。
- 消息、待办、审批、约单、审核类入口必须支持未读角标；已读后角标消失。
- 会员头像、买家/卖家头像、审批人头像、团队成员头像都走 `resolveAvatarUrl`，列表页和详情页必须显示一致。
- 私有图片、身份证照片、支付凭证等禁止匿名访问的文件，前端必须先换取临时 URL；不能直接把私有路径给 `<image>`。

## 验收要求

每次改动 UniApp/H5 前端后，至少做以下验证：

- 运行项目可用的窄范围诊断或构建命令。
- PC 宽屏访问 H5，截图确认页面在手机壳内、底部 tabBar 可见、固定底栏没有铺满桌面。
- 对关键图片和头像页面截图，确认显示真实图片而不是空白、首字母占位或失效图。
- 对关键业务资产选择流程，验证首次进入不自动选中，刷新后无效选择会被清空。
- 截图复核 PC 手机壳、底部 tabBar、主题背景、关键头像、私有图片、金额显示和未读角标。
