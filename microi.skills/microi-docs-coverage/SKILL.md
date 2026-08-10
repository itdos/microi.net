---
name: microi-docs-coverage
description: Microi 中文官网文档与 Skills 能力覆盖审计。用于全面分析 microi.doc/docs/doc 与 docs/case、核对官方能力和 V8 函数是否已进入 microi.skills、补充或重构 Skills、维护文档到 Skill 的责任映射，以及防止后续新增中文文档造成 AI 知识漏项。
---

# Microi 中文官网文档与 Skills 覆盖审计

当任务涉及“官网有但 AI 不知道”“全面同步官方文档到 Skills”“核对所有
V8 函数”或新增、调整官方中文文档时，使用本 Skill。

## 范围与事实源

- 能力映射扫描 `microi.doc/docs/doc/**/*.md`，但排除受发版规则保护的
  `microi.doc/docs/doc/about/update-log.md`；视觉与可读性审计还必须包含
  `microi.doc/docs/case/**/*.md`。
- `index.md`、`apps.md`、`app-detail.md`、`profile.md`、`login.md` 与
  `contact/index.md` 是由专用 Vue 组件承载的站点交互页，必须单独登记并按各自
  页面契约验收，不能静默漏扫，也不能机械套用正文档排版。
- 不扫描、不手工维护 `microi.doc/docs/en/`；英文站由中文站统一翻译。
- `references/capability-map.md` 维护每篇中文文档的责任 Skill。
- 文档描述能力边界，当前源码、接口定义、组件清单和 MCP Schema 决定真实签名。
- 不把客户表名、业务字段、扩展数据库名称或示例返回字段误判为平台 API。

## 审计流程

1. 运行自动审计：

   ```powershell
   node microi.skills/microi-docs-coverage/scripts/audit-doc-skill-coverage.mjs
   ```

2. 先解决“未映射文档”和“无效责任 Skill”。每篇中文文档都必须在能力映射中
   有明确负责人；宣传、培训、FAQ 等非 API 页面也要标明信息型覆盖。
3. 查看“未覆盖 V8 API、其它具名 API、MCP 工具”。逐项回到中文文档和
   当前源码确认：
   - 真实平台 API：补到对应 Skill 或 `v8-utilities` 索引。
   - 业务数据路径：归一为 `V8.Form`、`V8.Param` 等上下文对象。
   - 动态扩展名：归一为 `V8.Dbs`，不要固化客户数据库名称。
   - 文档旧名或错误：以源码为准，说明兼容边界；不要为让审计通过而虚构 API。
4. 把高频决策和最小安全示例写进 `SKILL.md`；完整方法表、平台差异、硬件/
   部署验收写进 `references/`，保持渐进披露。
5. 更新 `references/capability-map.md`，重新运行审计，直到严格检查通过。
6. 对每个新增或改动的 Skill 运行 `skill-creator` 的 `quick_validate.py`，
   再执行 `git diff --check` 和相对链接检查。

## 中文文档视觉与可读性契约（强制）

文档正确但密密麻麻仍属于未完成。修改 `microi.doc/docs/doc/**/*.md` 或
`microi.doc/docs/case/**/*.md` 时同时遵守：

- 正文使用清晰的 H1/H2/H3 层级和 80–90 字符左右的阅读宽度；连续长段落拆为短段、列表、对比表、步骤、流程或有语义的卡片。不要为了“丰富”把每句话都做成卡片。
- 首屏先回答“这是什么、有什么价值、怎么选择”，再展开原理和完整参数；长篇高级细节可使用可访问的 `details/summary` 渐进披露。
- 三个以上可比较能力优先使用表格或网格卡片；三步以上的依赖流程优先使用流程图/步骤带。图标必须帮助辨识，不能只作装饰噪声。
- 颜色至少区分主能力、成功、警告、风险，但正文对比度必须满足易读要求；不能只靠颜色表达状态。亮色、暗色、窄屏和 `prefers-reduced-motion` 都要有样式。
- 真实案例截图进入 `docs/public/images/...`，使用稳定英文文件名、有效 `alt` 和简短图注；图片不得代替关键文字说明，移动端不得横向撑破页面。
- 整站共同规则优先落在 VitePress 主题层 `mci-site.scss` / `doc-readable.scss`，页面独有展示放独立 SCSS；禁止为几十篇 Markdown 机械复制内联 `<style>`。
- 新页面可复用 `.mci-doc-grid`、`.mci-doc-card`、`.mci-doc-chip`；产品页需要独立视觉时使用页面 marker + `body:has(...)` 限定作用域，不能污染登录页、首页或英文生成页。
- 改动后运行 `npm run check:readability` 与 `npm run check:content`，再在真实浏览器至少检查一个桌面宽度和一个移动宽度，覆盖亮/暗主题、代码块、表格、图片、侧栏与锚点。
- `microi.doc/docs/en/` 由脚本生成，不手工同步样式化内容；日常文档工作继续禁止修改 `about/update-log.md`。

自动可读性检查只能阻止缺少 H1、超长连续文字块或整站主题契约丢失，不能证明页面真正好看。最终仍要查看渲染结果，不能用构建成功替代视觉验收。

全站任务必须进一步执行以下闭环，禁止把“扫描到若干 `/doc` 文件”等同于
“全部中文阅读页已完善”：

1. 在 `docs/.vitepress/theme/doc-visual-profiles.js` 为每个 `/doc` 与 `/case` 中文阅读页明确选择 `overview`、`guide`、`reference`、`policy` 或 `showcase`。新增、删除、移动文档时，页面清单与视觉档案必须同步闭环；专用站点交互页需显式登记为独立范围，英文路由不得进入该表。
2. 运行 `npm run audit:visual` 查看逐页报告。强制检查应覆盖唯一 H1、首屏引导、章节密度、连续正文、页面类型对应的表格/列表/代码/图片/提示/自定义布局、图片 `alt` 和主题契约；交付前应达到 0 条阻断和 0 条密度建议。
3. 中文样式若用 `html:lang(zh) { ... }` 包裹，根暗色选择器必须写成 `&.dark`，使 Sass 编译为 `html:lang(zh).dark`；写 `.dark` 会错误编译为后代选择器并导致暗色覆盖失效。所有自定义浅/暗背景都必须与前景、次要文字、边框成对切换，并用测试验证正文至少达到 WCAG AA 4.5:1。
4. 在浏览器遍历全部中文阅读路由（包括 `/doc` 与 `/case`），检查页面类型类、唯一 H1、页面级横向溢出和明显低对比文字；再从五种视觉类型各选代表页，覆盖桌面/移动与亮色/暗色截图。专用站点交互页按自身组件测试与代表截图验收。只有已登记范围全部通过，才可描述为“全站视觉验收完成”。
5. 静态脚本、Sass 编译、单元测试、VitePress 构建和浏览器截图是不同证据层。任何一层因资源保护或环境问题跳过，最终必须明确写出，不能用其它层替代。

## 自动审计能证明什么

脚本验证：

- 中文文档清单与责任映射闭环；
- 映射中没有已删除文档或不存在的 Skill；
- 文档出现的标准化 `V8.*` 名称至少在某个 Skill Markdown 中出现；
- 文档出现的 `System`、`DiyCommon`、`SqlFunc`、`SqlSubQuery`、
  `V8ExtensionRegistry` 具名 API 至少在某个 Skill 中出现；
- 文档出现的 `microi_*` MCP 工具名至少在某个 Skill 中出现；
- 文档出现的平台 HTTP 路由和平台全局函数至少在某个 Skill 中出现；
- 当前前端组件清单中的全部 `Control` 已进入表单组件参考；
- `v8-print.js`、`ble/tsc.js`、`ble/esc.js` 的公开蓝牙入口和全部构建器方法，
  已同时进入中文官方文档、蓝牙 Skills 与前端 Monaco API 提示；
- `diy.common.js`、`diy-form.vue`、`diy-table.vue` 仍真实调用
  `initV8Print`，且三处挂载范围已写入官方文档与 Skill；
- 动态业务路径被单独列出，便于人工复核。

脚本不能证明：

- Skill 的语义、示例、安全约束一定正确；
- 文档本身没有过时；
- 浏览器、蓝牙设备、打印机、数据库或多节点部署已经实测。

因此每轮全面同步还要做源码核对和按风险分层的真实验收，不能只追求字符串
覆盖率。

## 补充内容的归属

- 前端通用 API、扫码、消息、表格/表单助手：`v8-utilities`、
  `v8-frontend-events`。
- 蓝牙直连运行、连接与批量语义：
  `v8-frontend-events/references/bluetooth-print.md`；TSC/ESC 源码方法与编码：
  `v8-frontend-events/references/bluetooth-print-api.md`；服务端模板打印仍归
  `print-engine`。
- 后端通用上下文、Method、Base64、加密：`v8-utilities`。
- 表单设计器和字段组件：`microi-form-engine`。
- 菜单、模块与页面入口：`module-engine`。
- 部署、运行、配置和升级：`microi-deployment`。
- Dos.ORM 与扩展数据库：`dos-orm`。
- 微服务/前端微应用：`microi-microservice`。
- 其它专项能力优先补到已有同名 Engine/V8 Skill，避免再建内容重叠的 Skill。

## 禁止事项

- 不复制整篇官网文档到一个巨型 Skill。
- 不用叶子方法同名匹配掩盖对象归属错误。
- 不把 `V8.Form.OrderNo`、`V8.Param.id` 等业务字段当成平台函数。
- 不为了本次普通补充修改版本更新日志、英文文档或 Skills 版本清单。
- 不声称静态审计等于真实硬件、浏览器、远端或生产验收。
