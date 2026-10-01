# 草稿管理 (Draft Management)

在蚁小二生态中，存在两种“草稿”能力，需按目标选择：
- 保存到**蚁小二草稿箱**（`action: save-draft`）
- 保存到**目标平台草稿箱**（`action: publish` + `pubType: 0`）

## 触发场景 (Trigger)
- **意图辨析**：
  - **蚁小二草稿**：当用户希望先录入内容，待以后手动检查或由他人审核，不希望立即启动任何平台推送流程时。
  - **平台草稿**：当内容已比较完善，但由于平台规则（如视频号必须在手机端二次确认）或用户希望在平台后台进行最后的 SEO、话题优化时。
- **典型提示词**：
  - **蚁小二草稿**：“帮我把这个视频存为蚁小二的草稿”、“暂时不发布，先存草稿”、“存为 YXE 草稿”。
  - **平台草稿**：“把内容推送到抖音的草稿箱里”、“存为小红书草稿”、“推送到平台草稿箱”。
- **强制约束**：
  - 若用户说“存草稿”但未说明位置，Agent **必须询问用户** 明确意图（是存为“蚁小二草稿”还是“平台草稿”），严禁自行猜测或默认选择。
  - **蚁小二草稿**不消耗发布配额。
  - **平台草稿**消耗一次云发布/本机发布配额。

## 执行逻辑 (Logic Flow)
1. **意图深度研判**：根据提示词关键字选取模式。
2. **蚁小二草稿模式 (`action: save-draft`)**：
   - 构造 `action: "save-draft"`。
   - `contentPublishForm.pubType` 可设为 1 (发布) 或 0 (草稿)，后端仅做云端存储。
3. **平台草稿模式 (`action: publish` + `pubType: 0`)**：
   - 根级别注入 `action: "publish"`。
   - `accountForms` 内每个账号的 `contentPublishForm.pubType` 必须设为 `0`。
4. **指令执行**：调用 `yxer draft save <payload.json>` 保存蚁小二草稿；平台草稿仍走 `yxer publish`。
5. **状态反馈**：告知用户草稿保存位置及对应的 `taskSetId`。

## 快速区分 (Draft Types)

| 类型 | 蚁小二草稿 (YiXiaoEr Draft) | 平台草稿 (Platform Draft) |
| :--- | :--- | :--- |
| **定义** | 仅保存在蚁小二系统数据库中 | 发送到目标平台（如抖音、B站）的草稿箱 |
| **是否触发任务** | 否 (仅存储) | 是 (执行推送流程) |
| **调用 Action** | `save-draft` | `publish` |
| **核心参数** | `action: "save-draft"` | `contentPublishForm.pubType: 0` |
| **主要用途** | 跨端同步编辑、团队预审 | 将内容预推送到平台后台，方便手动二次微调 |

---

## 存为蚁小二草稿 (`isDraft: true`)

当需要将任务暂存到蚁小二系统的草稿列表，而不启动发布流程时使用。

### 参数列表 (Key Parameters)
| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`save-draft` |
| `publishType` | `string` | **是** | `video` (视频) 或 `article` (文章) |

### 调用指令 (Command)

```bash
yxer draft save draft-payload.json
```

`draft-payload.json` 中应包含原始发布结构，例如 `publishType`、`platforms`、`publishArgs`、`accountForms` 等字段；CLI 会自动按草稿模式提交。

若使用“标准请求体”格式，仍建议把共享资源放在 `publishArgs` 根级，例如 `cover`、`coverKey`、`content` / `video`，CLI 会在校验阶段自动补齐到对应 `accountForms[]`。

---

## 存为平台草稿 (`pubType: 0`)

当需要启动发布流程，但最终结果是在第三方平台后台看到草稿时使用。

### 调用指令 (Command)

```bash
# 平台草稿仍应收口到 yxer publish 流程
# 例如：yxer publish video 抖音 publish-payload.json
```

平台草稿同样支持标准请求体输入格式；但命令层仍是单平台执行，且平台草稿仍需在 `contentPublishForm.pubType` 中表达，而不是依赖顶层 `isDraft=true`。
