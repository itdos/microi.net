# 常见问题

## 如何让 VS Code 源代码管理生成中文且完整的 Git 提交消息？

VS Code 的源代码管理区域可能同时出现两个提交消息生成按钮，它们读取的配置不同：

| 按钮位置 | 提供者 | 对应配置 |
| --- | --- | --- |
| 提交消息输入框右侧的 `✨ 生成提交消息` | VS Code 内置 GitHub Copilot | `github.copilot.chat.*` |
| “更改”标题栏中的魔杖按钮 | OAI Compatible Copilot（OAICopilot）扩展 | `oaicopilot.*` |

如果希望两个按钮都生成简体中文提交消息，建议同时配置两组设置。

### 打开用户设置文件

最稳妥的方式是在 VS Code 中打开命令面板，然后执行 **首选项: 打开用户设置 (JSON)**：

- Windows：`Ctrl + Shift + P`
- macOS：`Shift + Command + P`

也可以直接打开对应文件。

#### Windows

VS Code 正式版默认路径：

```text
%APPDATA%\Code\User\settings.json
```

展开后通常是：

```text
C:\Users\<用户名>\AppData\Roaming\Code\User\settings.json
```

VS Code Insiders 默认路径：

```text
%APPDATA%\Code - Insiders\User\settings.json
```

#### macOS

VS Code 正式版默认路径：

```text
~/Library/Application Support/Code/User/settings.json
```

VS Code Insiders 默认路径：

```text
~/Library/Application Support/Code - Insiders/User/settings.json
```

::: tip 使用自定义 Profile 时
如果使用了 VS Code 配置文件（Profile），实际设置可能位于 `User/profiles/<ProfileId>/settings.json`。此时应优先通过命令面板执行 **首选项: 打开用户设置 (JSON)**，确保修改的是当前 Profile 正在使用的文件。
:::

### 推荐配置

将下面四个配置项合并到现有 `settings.json` 的最外层对象中。不要删除文件中已有的其它设置，并注意相邻配置项之间需要使用英文逗号分隔。

```json
{
  "oaicopilot.commitLanguage": "Chinese (Simplified)",
  "oaicopilot.commitMessagePrompt": "你是资深代码审阅者。请基于已提供的全部 Git diff 生成简体中文提交消息，并严格使用 Conventional Commits。先识别本次提交的总体业务目标和架构主线，再按功能域归纳主要改动；不要只概括少数新增工具文件，也不要机械逐文件罗列。标题格式为 type(scope): 中文标题，标题应描述核心交付成果。正文使用 5-8 条中文项目符号，在变更确实存在时覆盖核心架构与路由页面、业务流程与权限、公共组件与工具、登录与 SDK、安全区与主题、资源与包体优化、测试验收脚本、依赖与文档。移动或拆分文件应写为迁移或重构，不要误写为新增。只陈述 diff 能证明的事实，不得把新增测试脚本写成测试已经通过，不要输出英文解释。",
  "github.copilot.chat.localeOverride": "zh-CN",
  "github.copilot.chat.commitMessageGeneration.instructions": [
    {
      "text": "请始终使用简体中文生成 Git 提交消息，并严格遵循 Conventional Commits。生成前先综合所有可见的变更文件和 diff，识别本次提交的总体业务目标与架构主线，禁止只根据最后几个或少数新增工具文件生成局部摘要。标题固定为 type(scope): 中文标题，type 使用 feat、fix、refactor、docs、test、chore 等标准英文关键字，scope 可明确时填写；标题必须描述核心交付成果，避免‘添加工具和功能模块’等泛化表述。正文按功能域归纳 5-8 条中文项目符号，在相关变更确实存在时覆盖：核心架构与路由页面、业务流程与权限、公共组件与工具、登录与 Microi SDK、安全区与主题、静态资源与包体优化、测试验收脚本、依赖与文档。不要机械逐文件罗列；删除旧路径并在新路径出现同类实现时，应表述为迁移、拆分或重构，不要误写为新增。只陈述变更内容能够证明的事实，不得把新增或修改测试脚本表述为测试已经通过，不要输出英文解释或额外前言。"
    }
  ]
}
```

保存后执行以下操作：

1. 打开命令面板。
2. 执行 **开发人员: 重新加载窗口**。
3. 清空提交消息输入框中的旧内容。
4. 重新点击需要使用的提交消息生成按钮。

### 为什么已经生成中文，但内容仍不完整？

提交消息生成器只能总结实际放入模型上下文的变更。当待提交文件很多、文本 diff 很长，或包含大量图片、压缩包等二进制资源时，模型可能只能看到部分变更。提示词可以改善归纳方式，但不能突破扩展或模型的上下文上限。

遇到大型变更时，建议按业务目的分批暂存并分别生成提交消息，例如：

1. 核心业务、页面与公共组件。
2. 静态资源与包体优化。
3. 测试、验收脚本、依赖和文档。

当暂存区中已有文件时，提交消息生成器通常会优先总结暂存区，而不是把整个工作区的所有未提交内容混在一起。一个提交只包含一个清晰目的，也更便于代码审查、回滚和问题定位。

::: warning 不要虚构验证结果
提交消息只能描述代码变更能够证明的事实。新增或修改了测试脚本，可以写“新增测试脚本”或“完善验收检查”；只有真正执行并通过测试后，才能写“测试通过”。
:::

### 配置后仍然生成英文怎么办？

依次检查：

1. 确认点击的是哪一个生成按钮，以及对应配置是否已经填写。
2. 确认修改的是当前 VS Code Profile 的用户设置，而不是另一个 Profile 或另一个 VS Code 版本的设置文件。
3. 检查工作区 `.vscode/settings.json` 是否覆盖了用户级配置。
4. 确认 `settings.json` 没有缺少逗号、多余括号或其它 JSON 语法错误。
5. 重新加载 VS Code 窗口后再次生成。
6. 如果使用 OAICopilot，确认扩展已启用，并且至少有一个模型启用了提交消息生成功能。
