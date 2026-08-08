---
name: microi-codex-installer
description: 当用户要求安装、升级或诊断 Microi吾码 Codex 插件，或者 Codex 开始处理 Microi 平台任务但 `microi@microi-net` 插件能力缺失时使用。立即做只读检测；用户明确要求安装时可直接通过 @microi.net/cli 执行，普通对话中则先说明全局改动并取得一次明确授权，禁止静默安装。
---

# Microi吾码 Codex 插件安装

本技能负责发现、安装、升级和迁移 Microi吾码 Codex 插件。正式 marketplace 名称固定为 `microi-net`，插件选择器固定为 `microi@microi-net`，npm 包为 `@microi.net/codex-plugin`。

## 强制入口规则

- Codex 开始处理 Microi吾码低代码、V8、MCP、表单/模块/流程、微应用或平台源码任务时，先判断当前任务是否已经提供 `microi` 插件的 Skills/MCP/CLI 能力。
- 能力不明确时立即做只读检测，不得等到缺少工具或上下文后才检查。
- 用户明确说“安装/升级/启用吾码 Codex 插件”时，该请求本身就是安装授权；可直接执行安装命令，不再重复询问。
- 用户只是在进行普通 Microi 业务对话、尚未要求安装时，发现插件缺失后必须立即说明将修改 Codex 全局 marketplace、插件配置和本地缓存，并请求一次明确同意。未获同意不得安装、下载或改写全局配置。
- 用户拒绝或暂不安装时，继续使用工作区现有 `microi.skills`、`@microi.net/cli` 或 MCP 完成可完成的工作，不得阻塞或反复提示。

## 检测

优先使用已经安装的 CLI：

```bash
microi codex status --json
```

如果 `microi` 命令不存在，只可先运行不会下载包的本机只读检查：

```bash
codex plugin marketplace list
codex plugin list
```

成功状态必须同时满足：

- marketplace 为 `microi-net`；
- `microi@microi-net` 显示 `installed, enabled`；
- 已安装版本等于 CLI 内置 marketplace 的目标版本。

`microi-official` 和 `microi@microi-official` 仅是旧标识，不得写入新文档或新配置；安装器会在新版安装成功后迁移并清理旧标识。

## 获得授权后安装

已安装全局 CLI 时：

```bash
microi codex install --yes
```

没有全局 CLI，但用户已明确授权安装时：

```bash
npx --yes @microi.net/cli@latest codex install --yes
```

`--yes` 只表示当前用户已经授权这次全局修改，不得由 AI 在普通 Microi 对话中自行补上。只有版本不一致且普通安装不能升级、并确认目标 npm 包已经公开可读时，才使用：

```bash
microi codex install --yes --force
```

开发者从可信本地源码验收时，可以显式指定 marketplace 源：

```bash
microi codex install --yes --source <Microi.VSCode目录>
```

普通用户不得被引导到来历不明的 Git、本地目录或第三方 registry。不得通过 VPN、伪造地区/企业身份或共享账号绕过 OpenAI 地区与身份政策。

## 安装后验收

再次执行：

```bash
microi codex status --json
```

只有返回 `ok: true` 且选择器、状态和版本全部正确，才报告安装完成。随后明确提示用户新建 Codex 任务或重载 Codex；当前已经打开的任务通常不会热加载新增 Skills/MCP。

若 npm 返回 `E404`，说明 `@microi.net/codex-plugin` 的目标版本尚未公开或仍在传播。不得删除仍可用的旧插件、不得重复发布同一不可变版本，也不得声称安装成功。
