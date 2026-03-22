# 🤖 AI 编程全指南

> **在线 + 本地双模式 AI 编程，让 AI 充分了解你的 V8 API 与数据库结构，接口引擎代码生成准确率高达 99%**

---

## 🎯 为什么说 Microi吾码做到了真正的 AI + 低代码？

传统低代码的"AI 能力"停留在建表、建表单的表层，而 Microi吾码选择了一条更本质的路径：

**V8 接口引擎 = 标准 JavaScript 后端代码**，AI 最擅长的就是写代码。

- 接口引擎代码就是标准 JavaScript，AI 可以直接生成且正确率极高
- 将数据库表结构、字段含义、菜单关系一键喂给 AI，AI 就能精准理解你的业务数据
- **在线 AI 编程**：浏览器中用 DeepSeek / ChatGPT / Kimi 等工具写代码，复制粘贴到平台
- **本地 AI 编程**：VS Code + GitHub Copilot / Claude Code / Cursor，知识库自动注入，写代码 → 执行 → 调试全在编辑器内完成，无需离开
- **从 V8 代码中调用 AI 大模型**：在接口引擎里直接请求 DeepSeek 等接口，实现 ReAct 模式

> 博主某 MES 项目：500+ 张表，大量接口引擎由 AI 一次生成，准确率高达 **99%**。

---

## 💻 本地 AI 编程（VS Code 插件）

这是本次更新带来的全新一体化开发模式：**在 VS Code 中直接用 GitHub Copilot / Claude Code / Cursor 编写接口引擎，知识库自动注入，无需离开编辑器。**

### 工作原理

```
安装 VS Code 插件「Microi吾码」
        ↓
  登录并点击「拉取」
        ↓
  插件自动完成：
  ① 拉取所有接口引擎 .js 到本地
  ② 拉取所有 V8 事件 .js 到本地
  ③ 拉取数据库结构（表名 / 字段名 / 字段描述 / 菜单结构）
        ↓
  自动生成 AI 知识库文件（放在本地工作区）：
  • .github/copilot-instructions.md  ← GitHub Copilot 读取
  • CLAUDE.md                        ← Claude Code 读取
  • .cursorrules                     ← Cursor 读取

  知识库内容包含：
  ✅ V8 引擎全部 API（FormEngine / Db / Cache / Http / ApiEngine 等）
  ✅ _Where 查询条件语法
  ✅ 你的数据库所有表结构（表名 / 字段名 / 类型 / 业务说明）
  ✅ 菜单树结构（哪个菜单对应哪张表）
        ↓
  打开任意 .js 接口引擎文件
        ↓
  GitHub Copilot / Claude Code / Cursor 自动获得完整上下文
  → 直接 AI 辅助编写接口引擎代码，无需额外的"喂文档"步骤
        ↓
  保存 → 自动推送到数据库（或手动 Ctrl+S）
  远程执行 / 远程逐行调试，全在 VS Code 内完成
```

### 安装插件

在 VS Code 扩展市场搜索 **Microi吾码** 安装，或从 [OpenClaw](https://gitee.com/microi-net/microi.openclaw) 下载 `.vsix` 文件手动安装。

### 一键拉取 + 自动建立知识库

登录成功后，点击左侧 Microi 侧栏顶部的 **↓（拉取）** 按钮，或执行命令：

```
Microi: 拉取V8引擎代码
```

插件会自动完成以下操作（支持多服务器并发）：

| 步骤 | 内容 |
|---|---|
| ① 拉取接口引擎 | 所有 `ApiEngineKey.js` 保存到本地目录 |
| ② 拉取 V8 事件 | 所有表单 V8 事件 `.js` 保存到本地目录 |
| ③ 拉取数据库结构 | 表名、字段名、类型、说明、菜单树一并拉取 |
| ④ 自动生成知识库 | `copilot-instructions.md` / `CLAUDE.md` / `.cursorrules` |

知识库生成后，你在 VS Code 中打开任意 `.js` 文件，AI 助手已经了解：

- **V8 引擎完整 API**（不需要你手动告诉 AI 怎么用 `V8.FormEngine.GetTableData`）
- **你的数据库表结构**（AI 知道你的表叫什么，字段叫什么，业务含义是什么）
- **_Where 条件用法**（AI 能自动写出正确的查询条件）

### 写代码 → 执行 → 调试，全闭环

| 操作 | 方式 |
|---|---|
| AI 辅助写代码 | Copilot 自动补全，或在 Copilot Chat / Claude Code 输入需求 |
| 远程执行 | 右键 → `Microi: 远程执行当前接口引擎`（弹出参数输入框） |
| 逐行调试 | 右键 → `Microi: 远程逐行调试`，支持断点 / Step Over / 变量观察 |
| 推送保存 | 文件保存时自动同步到数据库，无需编译发布 |

<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" style="margin: 5px;">
<img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" style="margin: 5px;">

### 单独更新 AI 知识库

数据库结构发生变化后，无需重新拉取全部代码，单独执行：

```
Microi: 拉取数据库结构到AI知识库
```

即可更新三个知识库文件，让 AI 立即感知最新的表结构。

### 效率对比

| 开发模式 | 准备上下文 | 写代码 | 执行调试 | 推送部署 |
|---|---|---|---|---|
| 传统手写 | 无 | 手写 | 打开浏览器平台 | 浏览器平台 |
| 在线 AI 编程 | 手动上传文档 + db.json | AI + 复制粘贴 | 浏览器平台 | 浏览器平台 |
| **本地 AI 编程（推荐）** | **全自动，拉取时自动生成** | **AI 在 VS Code 实时辅助** | **VS Code 内执行/调试** | **保存自动推送** |
