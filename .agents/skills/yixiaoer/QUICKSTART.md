# 蚁小二发布快速开始

**5 分钟完成首次发布**

本指南帮助 AI Agent 和人类用户快速完成第一次发布，跳过复杂的文档层级。

**使用边界：本文只提供最短上手路径，不替代正式规则。若与 [`references/yixiaoer-shared.md`](./references/yixiaoer-shared.md) 或 `references/workflows/` 中的 workflow 有冲突，以共享规则和 workflow 为准。**

---

## 🚀 5 步发布流程

### 1️⃣ 环境检查（30秒）

```bash
yxer doctor
yxer accounts list 抖音 --status 1 --json
```

**检查点：**
- ✅ `doctor` 返回 `ok: true`
- ✅ `accounts list` 至少返回一个 `status: 1` 的账号
- ❌ 如果失败，先执行 `yxer config init --api-key <apiKey>`

**保存信息：**
- `platformAccountId`（从 accounts list 获取）

---

### 2️⃣ 获取字段清单（1分钟）

```bash
# 推荐：先看字段列表（输出简洁）
yxer schema fields 抖音 video

# 备选：需要完整结构骨架时才执行
yxer schema get 抖音 video
```

**关注重点：**
- `required` 字段：必须填写
- `complex` 字段：需要查询命令获取（如 location, music, challenge）
- `queryCommands`：告诉你如何查询复杂字段

**保存信息：**
- 必填字段列表
- 复杂字段的查询命令

---

### 3️⃣ 准备资源（2分钟）

```bash
# 上传视频
yxer upload ./video.mp4

# 上传封面
yxer upload ./cover.jpg
```

**保存信息：**
- 视频上传返回的完整对象：`{key, size, width, height, duration, format}`
- 封面上传返回的完整对象：`{key, size, width, height, format}`

**⚠️ 重要：**
- 必须使用 CLI 返回的**完整对象**，不能只用 `key`
- 不能手动编造 `size/width/height` 等字段

---

### 4️⃣ 填写 payload（3分钟）

创建 `payload.json`：

```json
{
  "action": "publish",
  "publishType": "video",
  "platforms": ["抖音"],
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "<步骤1获取的账号ID>",
        "video": {
          "key": "<步骤3返回>",
          "size": 12345678,
          "width": 1080,
          "height": 1920,
          "duration": 15000,
          "format": "mp4"
        },
        "cover": {
          "key": "<步骤3返回>",
          "size": 234567,
          "width": 1080,
          "height": 1920,
          "format": "jpg"
        },
        "contentPublishForm": {
          "formType": "task",
          "title": "我的第一个视频",
          "description": "这是一个测试视频"
        }
      }
    ]
  }
}
```

**结构说明：**
- 顶层：`action`, `publishType`, `platforms`, `publishArgs`（固定结构）
- `publishArgs.accountForms[]`：账号级表单数组
- `contentPublishForm`：平台特定的业务字段

---

### 5️⃣ 校验和发布（1分钟）

```bash
# 校验 payload
yxer validate 抖音 video payload.json

# 预览（dry-run）
yxer publish video 抖音 payload.json --dry-run

# 正式发布
yxer publish video 抖音 payload.json
```

**注意：**
- 必须按顺序执行：validate → dry-run → publish
- 每次修改 payload 后都要重新 validate

---

## 🎯 常见场景

### 场景 1：添加地理位置

```bash
# 1. 查询位置
yxer query locations <account_id> --query 北京

# 2. 在 contentPublishForm 中添加
{
  "location": {
    "yixiaoerId": "<返回的ID>",
    "yixiaoerName": "<返回的名称>",
    "raw": {<返回的完整raw对象>}
  }
}
```

### 场景 2：添加背景音乐

```bash
# 1. 查询音乐
yxer query music <account_id> --query 歌曲名

# 2. 在 contentPublishForm 中添加
{
  "music": {
    "yixiaoerId": "<返回的ID>",
    "yixiaoerName": "<返回的名称>",
    "duration": 180000,
    "playUrl": "<返回的URL>",
    "raw": {<返回的完整raw对象>}
  }
}
```

### 场景 3：本机发布（客户端发布）

```bash
# 1. 配置 clientId（一次性）
yxer config set-local-client-id <clientId>

# 2. 发布时指定通道
yxer validate 抖音 video payload.json --publish-channel local
yxer publish video 抖音 payload.json --publish-channel local --dry-run
yxer publish video 抖音 payload.json --publish-channel local
```

---

## ⚠️ 常见错误速查

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| `missing publishArgs` | payload 结构不对 | 确保顶层有 `publishArgs` 字段 |
| `missing platformAccountId` | 缺少账号 ID | 从 `yxer accounts list` 获取 |
| `missing required field "title"` | 缺少必填字段 | 查看 `yxer schema fields` 的 `required` 列表 |
| `invalid resource key` | 资源未上传 | 先执行 `yxer upload <file>` |
| `unexpected field` | 字段名错误或不存在 | 对照 `yxer schema fields` 检查字段名 |
| `Schema validation failed` | 字段类型或值不对 | 查看错误信息中的 `suggestions` |

---

## 🔍 错误诊断检查清单

如果发布失败，按顺序检查：

- [ ] 已执行 `yxer doctor` 且返回成功
- [ ] 已执行 `yxer accounts list` 并确认有在线账号
- [ ] 已执行 `yxer schema fields` 查看字段定义
- [ ] payload 顶层包含 `publishArgs`
- [ ] 业务字段在 `publishArgs.accountForms[].contentPublishForm`
- [ ] 资源通过 `yxer upload` 上传并使用返回的**完整对象**
- [ ] 复杂对象（location/music等）通过查询命令获取
- [ ] 已执行 `yxer validate` 且通过
- [ ] 已执行 `yxer publish --dry-run` 预览

---

## 📚 进阶学习

完成首次发布后，可以继续学习：

### 不同发布类型

- **图文发布**：`references/workflows/publish-imageText.md`
- **文章发布**：`references/workflows/publish-article.md`

### 复杂功能

- **复杂字段查询**：`references/workflows/payload-sourcing.md`
- **发布通道选择**：`references/workflows/local-vs-cloud.md`
- **账号选择策略**：`references/workflows/account-selection.md`

### 平台差异

- **平台文档索引**：`references/platforms/index.md`
- **视频平台**：`references/platforms/video/`
- **图文平台**：`references/platforms/imageText/`
- **文章平台**：`references/platforms/article/`

---

## 💡 AI Agent 使用建议

如果你是 AI Agent，使用本指南时：

1. **优先阅读本文档**，而不是从 `SKILL.md` 开始读 7 个文档
2. **真正进入写操作前，仍必须回读** `references/yixiaoer-shared.md` 和对应 workflow
3. **优先使用 `schema fields`**，只在需要完整结构时才用 `schema get`
4. **关注错误信息中的 `suggestions`**，而不是自己猜测
5. **使用 CLI 返回的完整对象**，不要手动编造字段值
6. **遇到复杂字段时查看 `queryCommands`**，使用对应的查询命令

---

## 🎓 总结

**记住这 3 个核心原则：**

1. **结构标准化**：所有平台使用相同的 payload 结构
2. **字段从 CLI 获取**：资源和复杂对象必须通过 CLI 命令获取
3. **先 validate 后 publish**：永远不要跳过校验步骤

**5 分钟流程回顾：**
```
doctor → accounts list → schema fields → upload → fill payload → validate → dry-run → publish
```

祝你发布顺利！🎉
