---
name: microi-docs-coverage
description: Microi 中文官网文档与 Skills 能力覆盖审计。用于全面分析 microi.doc/docs/doc、核对官方能力和 V8 函数是否已进入 microi.skills、补充或重构 Skills、维护文档到 Skill 的责任映射，以及防止后续新增中文文档造成 AI 知识漏项。
---

# Microi 中文官网文档与 Skills 覆盖审计

当任务涉及“官网有但 AI 不知道”“全面同步官方文档到 Skills”“核对所有
V8 函数”或新增、调整官方中文文档时，使用本 Skill。

## 范围与事实源

- 扫描 `microi.doc/docs/doc/**/*.md`，但排除
  `microi.doc/docs/doc/about/update-log.md`。
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
