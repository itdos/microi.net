# Microi吾码官网与官方文档

Microi吾码是**开源 AI 开发框架**，融合 30+ 成熟引擎、AI 低代码、微服务与 V8 引擎；在平台能力高度复用的典型业务场景中，让 AI 开发更省 Token 10 倍+、速度提升 10 倍+，开箱即用、更快交付。

## 运行说明

## 请使用 node 18/20 版本运行
```bash
nvm use 18
```

## 本地运行

```bash
# 安装依赖
npm install

# 本地浏览
npm run dev
```

`npm run dev` 与 `npm run docs:dev` 直接启动文档开发服务，默认地址为 `http://localhost:61503/`。本地预览不依赖其它项目源码和插件打包副本是否同步。

完整内容检查涉及工作区源码和 Skills 同步，可在完整工作区中单独执行 `npm run check:content`；`npm run build` 与 `npm run docs:build` 仍会先执行这些检查，失败时中止正式构建。

## 发布部署

```bash
npm run build
```

构建完成后，在 `docs/.vitepress/dist` 目录下，会生成静态文件，可以直接部署到服务器上。

## SEO、AI 搜索与错误页

站点沿用 `https://www.microi.net` 为规范主域，文章沿用 `.html` 地址、目录首页使用末尾 `/`。`microi.net` 和 `doc.microi.net` 在 nginx 归一到主域；省略 `.html`、多余的末尾 `/` 和 `index.html` 在目标页面存在时通过 301 归一，并保留 query。失效地址返回真实 HTTP 404，同时展示含文档、首页和常用入口的官网错误页。不要将不存在的文档统一跳转到首页。

`robots.txt` 允许公开脚本、样式、字体、图片及中英文文档被抓取。登录、个人资料与仅靠查询参数打开的应用详情页保留正常访问，使用 `noindex, follow`，并从 sitemap 中排除。这个指令是搜索展示策略，不是权限控制。

文档摘要以本页正文为主，不强制拼接相同营销关键词。页面具有独立 canonical、真实存在的中英文 hreflang 对应关系、可见面包屑及同源 BreadcrumbList、文章真实修改时间、WebSite/Organization 信息。首屏 HTML 与站内切换共用同一份页面元数据，从错误页返回文档时也会清除旧的 noindex。英文 HTML 和 hreflang 使用 `en-US`；Open Graph locale 按协议保留 `en_US`。

每次构建从实际生成的公开文档、案例页自动创建 `/llms.txt`。它只提供规范链接和已有摘要，不复制私有源码或建立另一套事实来源。它是方便开发者向 AI 工具提供上下文的可选入口，不能保证收录、排名或 AI 引用；AI 搜索仍依赖正文可读、链接可发现、信息准确与爬虫可达。[Google 官方说明](https://developers.google.com/search/docs/appearance/ai-features)

```bash
npm run test:seo
npm run docs:build
# 必须对运行正式配置的 nginx 检查；Vite 开发服务器不验证生产状态码和跳转。
npm run check:seo:http -- --base http://127.0.0.1:61513 --check-alias-hosts
```

构建检查会交叉验证逐页 canonical 唯一性与正确性、描述重复、noindex、sitemap 目标、双向 hreflang、JSON-LD 和 AI 文档索引。HTTP 检查验证真实 301/404、完整 sitemap、参数保留和友好错误页。它们均不能替代百度搜索资源平台的真实索引和抓取日志。

### ESA 中转到群晖：上线前必须核对

1. **回源 Host**：`www.microi.net` 必须以 `Host: www.microi.net` 到达此 nginx，通常选择跟随请求 Host；群晖反向代理也须接受该主机名。若 ESA 固定将所有请求改成 `Host: microi.net`，源站会持续跳向 www，产生循环。先修正这一配置，或在 ESA 完成别名跳转并将规范请求以 www 回源。不要依赖客户端可伪造的任意转发 Header 决定可信主域。
2. **HTTPS 与证书**：在 ESA 访客侧强制 HTTPS；源站仍可按实际网络使用 HTTP。本文 nginx 不根据源站 `$scheme` 强制 HTTPS，以免代理后方循环；别名跳转使用固定 HTTPS 主域。
3. **404 透传**：关闭把源站 404 改写成首页或平台错误页的规则，保留源站状态码和响应体。部署后清理旧 robots、sitemap、HTML 和历史错误页的 ESA 缓存，再实际访问失效链接，确认既有官网 UI 又是 404。
4. **搜索引擎身份识别**：在安全分析/事件中查看 Baiduspider 是否命中 WAF、频控、JS Challenge 或验证码。结合 UA 与反向解析确认真实蜘蛛后，使用 ESA 合法搜索引擎识别能力处理误报；不要仅按任意自报 UA 放开整个站点，也不要全局关闭安全防护。[ESA Bots 说明](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/identify-and-handle-bots-traffic)
5. **AI 搜索爬虫**：检查 ESA 的 AI 爬虫策略是否另行阻断检索爬虫；robots 允许访问不能覆盖边缘层拦截。按业务选择允许的检索服务，区分用于搜索检索的爬虫与用于模型训练的爬虫，避免一次性改动所有策略。
6. **家庭源站稳定性**：查看 ESA 访问/回源日志的 403、429、5xx、超时与首次出现时间；对应检查群晖反向代理、容器日志、家庭网络断线、动态 IP/DDNS 和回源证书。不要通过改为公网直连群晖来绕开诊断。先定位回源或防护异常，再决定是否需要更稳定的托管源站。
7. **百度验证**：查看近 90 天索引量和搜索流量，对中英文文档执行百度抓取诊断；核对实际状态、页面正文及百度保存的 robots。普通浏览器或本机模拟 UA 访问成功，只能证明当前网络请求成功，不能证明百度真实 IP 未被拦截。

没有 ESA/百度后台与群晖访问权限时，只能完成公开抓取、源码及隔离 nginx 验收；不能把镜像构建或模拟爬虫成功写成生产环境已恢复收录。

## 执行翻译
```
node translate.mjs
```
