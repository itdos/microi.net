# yxer 上线流程

本文档用于说明 `yxer` CLI 和 `yixiaoer` skill 的标准上线流程，适合研发、测试、运维和实施同学协作使用。

## 1. 上线目标

本项目上线交付物包含两部分：

- `yxer` CLI：实际执行账号查询、资源上传、校验和发布
- `skills/yixiaoer`：提供给 AI agent 读取的技能规则和工作流

上线时必须保证两者版本一致，避免出现 CLI 已升级、skill 未同步的问题。

## 2. 发布前检查

上线前至少完成以下检查：

- `go test ./...`
- `go build -o bin/yxer.exe .`
- `bin\\yxer.exe --version`
- `bin\\yxer.exe skill show`
- `bin\\yxer.exe doctor`

建议同时人工检查以下内容：

- `README.md` 是否已更新
- `skills/yixiaoer/SKILL.md` 是否已同步当前版本说明
- `skills/yixiaoer/references/cli/`、`skills/yixiaoer/references/workflows/` 是否与本次功能一致
- `schemas/` 是否覆盖本次变更涉及的平台字段

## 3. 标准上线步骤

### 步骤 1：代码冻结

- 合并本次要上线的功能、文档和 schema
- 确认没有未评审的临时调试代码
- 确认 `git status` 干净或仅保留已知发布文件

### 步骤 2：执行测试

在项目根目录执行：

```bash
go test ./...
```

如测试失败，不进入后续上线步骤。

### 步骤 3：构建 CLI

```bash
go build -o bin/yxer.exe .
```

如需要给其他环境发包，建议同时生成版本目录，例如：

```text
release/
  yxer-cli-<version>-windows-amd64/
    yxer.exe
    README.md
    skills/yixiaoer/references/
```

### 步骤 4：冒烟验证

至少验证以下命令：

```bash
bin\yxer.exe --version
bin\yxer.exe skill show
bin\yxer.exe update --check
bin\yxer.exe doctor
```

如有可用测试账号，建议再补一轮无副作用验证：

```bash
bin\yxer.exe accounts list 抖音 --json
bin\yxer.exe prepare 抖音 video
bin\yxer.exe schema get 抖音 video
bin\yxer.exe validate 抖音 video .\tests\fixtures\cli\test-cli-payload.json
bin\yxer.exe publish video 抖音 .\tests\fixtures\cli\test-cli-payload.json --dry-run
```

说明：

- `doctor` 用于检查配置和 skill 漂移
- `skill show` 用于确认技能目录和同步命令
- `update --check` 用于确认当前版本状态

### 步骤 5：同步 Skill

在发布包对应目录执行：

```bash
bin\yxer.exe skill sync
```

如需全局安装 skill：

```bash
bin\yxer.exe skill sync --global
```

### 步骤 6：发布交付物

建议至少交付以下内容：

- `yxer.exe`
- `README.md`
- `skills/yixiaoer/references/go-live-process.md`
- `skills/yixiaoer/references/usage-workflow.md`
- `skills/yixiaoer/references/keyword-reference.md`
- `skills/yixiaoer/SKILL.md`
- `references/cli/`
- `skills/yixiaoer/references/workflows/`
- `schemas/`

## 4. 建议交付方式

用户侧统一通过 npm 成品包安装 CLI：

```bash
npm install -g @yixiaoermail/cli
yxer --version
yxer config init --api-key <apiKey>
yxer skill sync
yxer doctor
```

源码构建仅用于研发、测试或 npm 成品包制作，不作为普通用户安装入口。

## 5. 回滚流程

若上线后发现问题，按以下顺序回滚：

1. 停止分发新版本 `yxer.exe`
2. 恢复上一个稳定版本的 CLI 包
3. 重新执行对应版本的 `yxer skill sync`
4. 用 `yxer doctor` 检查 skill 是否与 CLI 重新对齐

如果只是 skill 文档漂移，但 CLI 本体无问题，可只回滚 skill 包并重新同步。

## 6. 上线验收标准

满足以下条件即可判定可上线：

- 单元测试通过
- `yxer.exe` 可正常运行并输出版本
- `yxer skill show` 可正确识别技能目录
- `yxer doctor` 无阻断性错误
- 安装、同步、使用流程文档齐全
- CLI 与 skill 版本一致

## 7. 风险提示

- 用户环境依赖 npm 全局安装 `@yixiaoermail/cli`
- Skill 的实际执行依赖外部 `npx skills add` 工具，目标环境必须具备 Node.js 和 `npx`
- 若只替换 `yxer.exe` 但未同步 skill，AI agent 可能继续使用旧规则
