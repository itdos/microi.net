# yxer 共享规则

本文件是 `yxer` skill 的共享前置规则。只要任务涉及发布、草稿、素材、账号、排查、payload 修订，就应先读取本文件。

**CRITICAL - 本文档是共享规则唯一真源。若 QUICKSTART、domain 文档、workflow 文档和本文存在表述差异，以本文和对应 workflow 为准。**

## 唯一执行入口

- 真正执行一律走 `yxer` CLI
- 不要假设存在旧 Node 脚本入口
- 不要绕过 CLI 直连隐式 API

## 初始化与环境检查

首次使用、环境不明、或刚完成一次失败排查后，优先执行：

```bash
yxer doctor
yxer config get
```

如果当前环境尚未完成配置，再执行：

```bash
yxer config init --api-key <apiKey>
```

规则：

- `doctor` 失败时，先修环境，再继续业务流程
- 不要在环境异常时继续组装 payload

## 云发布与本机发布

- 用户未明确指定时，默认云发布
- 用户明确说“本机发布”“本地发布”“客户端发布”时，必须切到本机发布
- 本机发布前，应优先确认默认 `clientId` 是否已配置：

```bash
yxer config set-local-client-id <clientId>
```

规则：

- `validate`、`publish --dry-run`、正式 `publish` 必须使用同一套发布通道参数
- 云发布返回代理相关错误时，可建议切到本机发布
- 本机发布提示客户端不在线时，应提示用户启动并登录蚁小二客户端，或改回云发布

## 技能同步

```bash
yxer skill show
yxer update
yxer update --global
```

以下情况应提示重新同步：

- `yxer --version` 升级后
- 当前 skill 包中的 `SKILL.md` 更新后
- `skills/yixiaoer/references/` 中影响 Agent 行为的文档更新后
- `yxer doctor` 返回 `_notice.skills`

## 输出协议

### 账号候选

- 如果只有一个可用账号，可自动选择并明确告知用户
- 如果命中多个账号，必须结构化列出候选项，再让用户确认
- 如果没有 `status=1` 的账号，不要继续发布流程

### 校验与 dry-run

- `validate` 失败时，先展示错误要点，再回到 `prepare` / `schema get` / 查询结果修字段
- `publish --dry-run` 成功时，再进入正式发布
- 不要跳过 `validate` 或 `publish --dry-run`

### 表单会话来源校验

- 使用 `publish form choose` 写动态字段时，必须带 `--source-command` 记录产生候选的 `yxer query ... --json` 命令
- `publish form set` 只能写 form contract 声明过的路径；不要用未知路径试错
- `publish form choose` 只用于 `dynamicFieldExamples` 声明的动态字段；普通文本、枚举和值字段使用 `publish form set`
- 导出前应先执行 `yxer publish form verify <session.json>`；`review` 和 `export` 也会校验来源记录和当前 payload 是否一致
- 如果 `verify` 报来源缺失、账号不一致或 hash 不匹配，回到对应字段重新执行 `set` / `choose`，不要手改 session 或 payload 绕过

### 发布结果

- 成功时给出平台、类型、通道和关键结果
- 失败时给出错误摘要、当前阶段和下一步处理建议

## 危险动作协议

- 真正发布前，最小固定门禁是：
  1. 已有或已导出标准 `payload.json`
  2. `yxer validate`
  3. `yxer publish --dry-run`
  4. 用户授权后 `yxer publish`
- 当 payload 尚未完整、账号未确认、资源未上传或动态字段未查询时，先补完整组装路径：
  1. `yxer doctor`
  2. `yxer accounts list`
  3. `yxer prepare` 或 `yxer publish form start/inspect`
  4. `yxer schema fields`；只有需要完整骨架时再补 `yxer schema get`
  5. `yxer upload` / `yxer query ...`
  6. 组装或导出 `payload.json`
- 不允许跳过 `validate`
- 不允许把正式 `publish` 当成试错手段
